import { supabase } from '@/lib/supabase';
import * as store from './store';
import { sha256 } from './identity';
import type {
  DayEntry,
  PackageGame,
  PackageMatch,
  PackageStation,
  PackageStationSetup,
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

// ---------------------------------------------------------------------------
// Auswahlfunktionen
// ---------------------------------------------------------------------------

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
