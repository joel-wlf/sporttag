import type { ActiveCheckinRow, CurrentResultValueRow, OpenSubmissionRow } from '@/lib/api/live';
import type { DeviceSyncRow } from '@/lib/api/devices';
import type { BlockRow, MatchParticipantRow, MatchRow, RoundRow, StationSetupRow } from '@/lib/api/schedule';
import type { EventGameRow } from '@/lib/api/games';
import type { StationRow } from '@/lib/api/stations';
import type { Tables } from '@/lib/database.types';

/** Ab wann ein Gerät als "möglicherweise offline" gilt bzw. eine Runde als verspätet. */
export const STALE_DEVICE_MS = 5 * 60 * 1000;
export const LATE_ROUND_MS = 5 * 60 * 1000;

export type LiveStatus =
  | 'conflict'
  | 'late'
  | 'unstaffed'
  | 'stale'
  | 'running'
  | 'ready'
  | 'done'
  | 'cancelled'
  | 'idle';

export const liveStatusOrder: LiveStatus[] = [
  'conflict',
  'late',
  'unstaffed',
  'stale',
  'running',
  'ready',
  'done',
  'cancelled',
  'idle',
];

export const liveStatusLabel: Record<LiveStatus, string> = {
  conflict: 'Klärung nötig',
  late: 'Verspätet',
  unstaffed: 'Ohne Betreuung',
  stale: 'Gerät ohne Meldung',
  running: 'Läuft',
  ready: 'Bereit',
  done: 'Fertig',
  cancelled: 'Abgesagt',
  idle: 'Kein Match',
};

export type LiveTone = 'danger' | 'warning' | 'primary' | 'accent' | 'success' | 'subtle';

export const liveStatusTone: Record<LiveStatus, LiveTone> = {
  conflict: 'danger',
  late: 'danger',
  unstaffed: 'warning',
  stale: 'warning',
  running: 'primary',
  ready: 'accent',
  done: 'success',
  cancelled: 'subtle',
  idle: 'subtle',
};

/** Wählt die aktuell laufende Runde, sonst die nächste, sonst die letzte. */
export function pickCurrentRound<R extends { starts_at: string; ends_at: string; position: number }>(
  rounds: R[],
  now: Date,
): R | null {
  if (rounds.length === 0) return null;
  const sorted = [...rounds].sort((a, b) => a.position - b.position);
  const nowMs = now.getTime();
  const running = sorted.find((r) => new Date(r.starts_at).getTime() <= nowMs && nowMs <= new Date(r.ends_at).getTime());
  if (running) return running;
  const upcoming = sorted.find((r) => new Date(r.starts_at).getTime() > nowMs);
  if (upcoming) return upcoming;
  return sorted[sorted.length - 1];
}

export type StationLive = {
  station: StationRow;
  round: RoundRow | null;
  block: BlockRow | null;
  setup: StationSetupRow | null;
  game: EventGameRow | null;
  match: MatchRow | null;
  teams: { id: string; name: string; number: number | null; color: string | null }[];
  checkins: ActiveCheckinRow[];
  device: DeviceSyncRow | null;
  openSubmissions: OpenSubmissionRow[];
  status: LiveStatus;
  /** Kompakter Live-Punktestand, z. B. „12:8“, sobald ein Ergebnis vorliegt. */
  scoreLabel: string | null;
};

export function buildStationLive({
  stations,
  round,
  blocks,
  stationSetups,
  matches,
  matchParticipants,
  teams,
  games,
  activeCheckins,
  devices,
  openSubmissions,
  currentResultValues,
  now,
}: {
  stations: StationRow[];
  round: RoundRow | null;
  blocks: BlockRow[];
  stationSetups: StationSetupRow[];
  matches: MatchRow[];
  matchParticipants: MatchParticipantRow[];
  teams: Tables<'teams'>[];
  games: EventGameRow[];
  activeCheckins: ActiveCheckinRow[];
  devices: DeviceSyncRow[];
  openSubmissions: OpenSubmissionRow[];
  currentResultValues: CurrentResultValueRow[];
  now: Date;
}): StationLive[] {
  const block = round ? (blocks.find((b) => b.id === round.block_id) ?? null) : null;

  return stations.map((station) => {
    const setup = block
      ? (stationSetups.find((s) => s.block_id === block.id && s.station_id === station.id) ?? null)
      : null;
    const game = setup ? (games.find((g) => g.id === setup.event_game_id) ?? null) : null;
    const match = round && setup ? (matches.find((m) => m.round_id === round.id && m.station_setup_id === setup.id) ?? null) : null;
    const participants = match
      ? matchParticipants.filter((p) => p.match_id === match.id).sort((a, b) => a.slot - b.slot)
      : [];
    const matchTeams = participants
      .map((p) => teams.find((t) => t.id === p.team_id))
      .filter((t): t is Tables<'teams'> => Boolean(t))
      .map((t) => ({ id: t.id, name: t.name, number: t.number, color: t.color }));

    const checkins = setup ? activeCheckins.filter((c) => c.station_setup_id === setup.id) : [];
    const device = checkins.length > 0 ? (devices.find((d) => d.access_id === checkins[0].device_access_id) ?? null) : null;
    const submissions = match ? openSubmissions.filter((s) => s.match_id === match.id) : [];
    const scoreLabel = match ? scoreLabelFor(match, participants, currentResultValues) : null;

    const status = deriveStatus({ setup, match, checkins, device, submissions, round, now });

    return {
      station,
      round,
      block,
      setup,
      game,
      match,
      teams: matchTeams,
      checkins,
      device,
      openSubmissions: submissions,
      status,
      scoreLabel,
    };
  });
}

function formatScoreValue(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

/** Kompakter Live-Punktestand je Match, in Team-/Slot-Reihenfolge, z. B. „12:8“ oder „1./2.“. */
function scoreLabelFor(
  match: MatchRow,
  participants: MatchParticipantRow[],
  currentResultValues: CurrentResultValueRow[],
): string | null {
  if (participants.length === 0) return null;
  const rows = currentResultValues.filter((v) => v.match_id === match.id);
  if (rows.length === 0) return null;

  const parts = participants.map((p) => {
    const row = rows.find((v) => v.team_id === p.team_id);
    if (!row) return '–';
    if (row.measured_value !== null) return formatScoreValue(row.measured_value);
    if (row.placement !== null) return `${row.placement}.`;
    return '–';
  });
  if (parts.every((p) => p === '–')) return null;
  return parts.join(':');
}

function deriveStatus({
  setup,
  match,
  checkins,
  device,
  submissions,
  round,
  now,
}: {
  setup: StationSetupRow | null;
  match: MatchRow | null;
  checkins: ActiveCheckinRow[];
  device: DeviceSyncRow | null;
  submissions: OpenSubmissionRow[];
  round: RoundRow | null;
  now: Date;
}): LiveStatus {
  if (!setup || !round || !match) return 'idle';
  if (submissions.length > 0) return 'conflict';
  if (match?.status === 'cancelled') return 'cancelled';
  if (match?.status === 'completed' || (match && match.current_result_version > 0)) return 'done';
  if (match?.status === 'in_progress') {
    if (device?.last_seen_at && now.getTime() - new Date(device.last_seen_at).getTime() > STALE_DEVICE_MS) return 'stale';
    return 'running';
  }
  const roundStarted = new Date(round.starts_at).getTime() <= now.getTime();
  const late = roundStarted && now.getTime() - new Date(round.starts_at).getTime() > LATE_ROUND_MS;
  if (checkins.length === 0) {
    return late ? 'late' : 'unstaffed';
  }
  if (device?.last_seen_at && now.getTime() - new Date(device.last_seen_at).getTime() > STALE_DEVICE_MS) return 'stale';
  if (late) return 'late';
  return 'ready';
}

export const matchStatusLabel: Record<string, string> = {
  scheduled: 'Geplant',
  ready: 'Bereit',
  in_progress: 'Läuft',
  completed: 'Beendet',
  cancelled: 'Abgesagt',
};

function minutesSince(iso: string, now: Date): number {
  return Math.max(0, Math.round((now.getTime() - new Date(iso).getTime()) / 60000));
}

/** Klartext, warum eine Station ihren Status hat – vor allem für Problemfälle. */
export function statusReason(row: StationLive, now: Date): string | null {
  switch (row.status) {
    case 'conflict':
      return 'Ergebnisabgabe widerspricht sich und muss geklärt werden';
    case 'late':
      return row.round
        ? `Runde läuft seit ${minutesSince(row.round.starts_at, now)} min, Match noch nicht gestartet`
        : 'Match noch nicht gestartet';
    case 'unstaffed':
      return 'Noch niemand an dieser Station eingecheckt';
    case 'stale':
      return row.device?.last_seen_at
        ? `Gerät seit ${minutesSince(row.device.last_seen_at, now)} min ohne Meldung – evtl. offline`
        : 'Gerät meldet sich nicht';
    case 'ready':
      return 'Betreuung ist da, Match wartet auf Start';
    case 'running':
      return row.match?.actual_started_at ? `Läuft seit ${minutesSince(row.match.actual_started_at, now)} min` : 'Match läuft';
    case 'done':
      return 'Ergebnis liegt vor';
    case 'cancelled':
      return 'Match wurde abgesagt';
    case 'idle':
      return row.setup ? 'In dieser Runde kein Match' : 'In diesem Block kein Spiel';
  }
}

export type LiveGroup = 'attention' | 'running' | 'ready' | 'done' | 'other';

export const liveGroupOf: Record<LiveStatus, LiveGroup> = {
  conflict: 'attention',
  late: 'attention',
  unstaffed: 'attention',
  stale: 'attention',
  running: 'running',
  ready: 'ready',
  done: 'done',
  cancelled: 'other',
  idle: 'other',
};

export const liveGroupLabel: Record<LiveGroup, string> = {
  attention: 'Braucht Aufmerksamkeit',
  running: 'Läuft gerade',
  ready: 'Bereit',
  done: 'Fertig',
  other: 'Ohne Match / abgesagt',
};

export const liveGroupOrder: LiveGroup[] = ['attention', 'running', 'ready', 'done', 'other'];

/** "noch 7 min", "startet in 12 min" oder "beendet" für die gewählte Runde. */
export function roundProgress(round: { starts_at: string; ends_at: string }, now: Date): string {
  const start = new Date(round.starts_at).getTime();
  const end = new Date(round.ends_at).getTime();
  const t = now.getTime();
  if (t < start) return `startet in ${Math.ceil((start - t) / 60000)} min`;
  if (t <= end) return `läuft · noch ${Math.ceil((end - t) / 60000)} min`;
  return 'beendet';
}
