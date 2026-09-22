import { supabase } from '@/lib/supabase';
import * as store from './store';
import { sha256 } from './identity';
import type {
  DayEntry,
  PackageBlock,
  PackageGame,
  PackageMatch,
  PackageStation,
  PackageStationSetup,
  ResultPayloadValue,
  StationPackage,
} from './types';

/**
 * Lädt, prüft und speichert das vollständige Offline-Paket
 * (`get_station_package`) sowie die Auswahlfunktionen, die `demoData.ts`
 * ersetzen. Siehe docs/datenkonzept.md Abschnitt 11.1 und 12.
 */

export async function downloadPackage(eventId: string): Promise<StationPackage> {
  const { data, error } = await supabase.rpc('get_station_package', { p_event_id: eventId });
  if (error) throw error;
  const pkg = data as unknown as StationPackage;
  const hash = await sha256(JSON.stringify(pkg));
  await store.savePackage(eventId, pkg, hash);
  await store.setLastDownloadAt(eventId, new Date().toISOString());
  return pkg;
}

export async function getStoredPackage(eventId: string) {
  return store.loadPackage(eventId);
}

export async function getAnyStoredPackage() {
  return store.loadAnyPackage();
}

export type RemoteLiveState = {
  matchId: string;
  values: ResultPayloadValue[];
  startedAt: string | null;
  updatedAt: string;
};

/**
 * Liest die geteilten Live-Zwischenstände eines Events (mehrere Geräte
 * derselben Station sehen denselben Stand). RLS begrenzt den Zugriff über
 * `private.has_event_access`. Siehe docs/datenkonzept.md Abschnitt 11.6.
 */
export async function fetchLiveStates(eventId: string): Promise<RemoteLiveState[]> {
  const { data, error } = await supabase
    .from('match_live_states')
    .select('match_id, values, started_at, updated_at')
    .eq('event_id', eventId);
  if (error) throw error;
  return (data ?? []).map((row) => ({
    matchId: row.match_id,
    values: (row.values as ResultPayloadValue[] | null) ?? [],
    startedAt: row.started_at,
    updatedAt: row.updated_at,
  }));
}

export type RemoteTeamVisit = {
  participantId: string;
  matchId: string;
  teamId: string;
  arrivedAt: string | null;
  releasedAt: string | null;
  updatedAt: string;
};

/**
 * Liest den geteilten Laufzettel eines Events. Ein Gerät, das eine Station
 * übernimmt, sieht damit die bereits erfassten Ankünfte des Vorgängergeräts
 * (docs/datenkonzept.md Abschnitt 11.7).
 */
export async function fetchTeamVisits(eventId: string): Promise<RemoteTeamVisit[]> {
  const { data, error } = await supabase
    .from('team_station_visits')
    .select('participant_id, match_id, team_id, arrived_at, released_at, updated_at')
    .eq('event_id', eventId);
  if (error) throw error;
  return (data ?? []).map((row) => ({
    participantId: row.participant_id,
    matchId: row.match_id,
    teamId: row.team_id,
    arrivedAt: row.arrived_at,
    releasedAt: row.released_at,
    updatedAt: row.updated_at,
  }));
}

// ---------------------------------------------------------------------------
// Auswahlfunktionen
// ---------------------------------------------------------------------------

export const blockKindLabels: Record<PackageBlock['kind'], string> = {
  play: 'Spielblock',
  break: 'Pause',
  final: 'Abschluss',
  special: 'Besonders',
};

/** Blöcke haben keinen Namen; die Anzeige ergibt sich aus Art und Position. */
export function blockLabel(block: PackageBlock): string {
  return `${blockKindLabels[block.kind] ?? block.kind} ${block.position}`;
}

export function gameForSetup(pkg: StationPackage, setup: PackageStationSetup): PackageGame | undefined {
  return pkg.event_games.find((g) => g.id === setup.event_game_id);
}

export function stationForSetup(pkg: StationPackage, setup: PackageStationSetup): PackageStation | undefined {
  return pkg.stations.find((s) => s.id === setup.station_id);
}

export function matchesForSetup(pkg: StationPackage, setupId: string): PackageMatch[] {
  return pkg.matches
    .filter((m) => m.station_setup_id === setupId)
    .sort((a, b) => {
      const roundA = pkg.rounds.find((r) => r.id === a.round_id);
      const roundB = pkg.rounds.find((r) => r.id === b.round_id);
      return (roundA?.starts_at ?? '').localeCompare(roundB?.starts_at ?? '');
    });
}

export function teamName(pkg: StationPackage, teamId: string) {
  return pkg.teams.find((t) => t.id === teamId)?.name ?? 'Unbekanntes Team';
}

export function staffNotes(pkg: StationPackage, staffId: string) {
  return pkg.event_staff.find((s) => s.id === staffId)?.notes ?? null;
}

/**
 * Setups, die eine Person je Block betreut — abhängig vom Zuordnungsmodus
 * des Events (Station oder Spiel, siehe docs/datenkonzept.md Abschnitt 13).
 */
export function setupsForStaff(pkg: StationPackage, staffId: string): PackageStationSetup[] {
  if (pkg.event.staff_assignment_mode === 'game') {
    const gameIds = new Set(pkg.game_assignments.filter((ga) => ga.staff_id === staffId).map((ga) => ga.event_game_id));
    return pkg.station_setups.filter((su) => gameIds.has(su.event_game_id));
  }
  const setupIds = new Set(pkg.station_assignments.filter((sa) => sa.staff_id === staffId).map((sa) => sa.station_setup_id));
  return pkg.station_setups.filter((su) => setupIds.has(su.id));
}

/** Vollständiger Tagesplan einer Person: alle Blöcke, inklusive Pausen und Blöcken ohne Einsatz. */
export function dayPlan(pkg: StationPackage, staffId: string): DayEntry[] {
  const mySetups = new Set(setupsForStaff(pkg, staffId).map((s) => s.id));
  const blocks = [...pkg.blocks].sort((a, b) => a.position - b.position);

  const entries: DayEntry[] = [];
  for (const block of blocks) {
    if (block.kind === 'break') {
      entries.push({ kind: 'break', id: block.id, block });
      continue;
    }
    const setupsInBlock = pkg.station_setups.filter((su) => su.block_id === block.id && mySetups.has(su.id));
    if (setupsInBlock.length === 0) {
      entries.push({ kind: 'off', id: block.id, block });
      continue;
    }
    for (const setup of setupsInBlock) {
      const station = stationForSetup(pkg, setup);
      const game = gameForSetup(pkg, setup);
      if (!station || !game) continue;
      const round = pkg.rounds.find((r) => r.block_id === block.id && r.kind === 'play') ?? null;
      entries.push({
        kind: 'assignment',
        id: `${block.id}:${setup.id}`,
        setupId: setup.id,
        block,
        round,
        station,
        game,
      });
    }
  }
  return entries;
}

export function findDayEntry(entries: DayEntry[], id?: string | null) {
  return id ? entries.find((e) => e.id === id) : undefined;
}

export function formatTime(iso: string, timezone: string) {
  try {
    return new Intl.DateTimeFormat('de-DE', { hour: '2-digit', minute: '2-digit', timeZone: timezone }).format(new Date(iso));
  } catch {
    return new Intl.DateTimeFormat('de-DE', { hour: '2-digit', minute: '2-digit' }).format(new Date(iso));
  }
}

export type EntryState = 'past' | 'now' | 'future';

export function entryState(entry: DayEntry, now: Date): EntryState {
  const start = new Date(entry.block.starts_at).getTime();
  const end = new Date(entry.block.ends_at).getTime();
  const t = now.getTime();
  if (t >= end) return 'past';
  if (t >= start) return 'now';
  return 'future';
}
