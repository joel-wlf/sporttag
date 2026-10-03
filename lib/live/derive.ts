import type { ActiveCheckinRow, CurrentResultValueRow, MatchLiveStateRow, OpenSubmissionRow } from '@/lib/api/live';
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

/**
 * Symbol je Status für Kartenpins und Legende: Status nie nur über Farbe
 * (Rot/Gold und die beiden Grüntöne sind auf Satellitenbild kaum zu trennen).
 */
export const liveStatusIcon: Record<LiveStatus, 'alert' | 'users' | 'wifi-off' | 'play' | 'clock' | 'check' | 'minus'> = {
  conflict: 'alert',
  late: 'alert',
  unstaffed: 'users',
  stale: 'wifi-off',
  running: 'play',
  ready: 'clock',
  done: 'check',
  cancelled: 'minus',
  idle: 'minus',
};

/** Wählt die aktuell laufende Runde, sonst die nächste, sonst die letzte. */
export function pickCurrentRound<R extends { starts_at: string; ends_at: string; position: number }>(
  rounds: R[],
  now: Date,
): R | null {
  if (rounds.length === 0) return null;
  // Nach Zeit, nicht nach `position`: die beginnt je Block neu, sodass nach der
  // letzten Runde sonst eine Runde aus einem früheren Block als „letzte“ galt.
  const sorted = [...rounds].sort((a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime());
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

/**
 * Das Match, an dem eine Station tatsächlich steht — nicht das der geplanten
 * Runde. Runden verschieben sich am Tag gegeneinander (datenkonzept.md 11.7):
 * eine Station spielt noch R1, während der Plan schon R2 zeigt, eine andere
 * ist schon bei R3. Reihenfolge: laufendes Match, sonst das früheste fällige
 * ohne Ergebnis (die Station hängt), sonst das nächste offene (die Station
 * ist voraus), sonst das letzte (alles erledigt).
 */
export function progressMatchForSetup(
  setupId: string,
  matches: MatchRow[],
  rounds: RoundRow[],
  liveStates: MatchLiveStateRow[],
  now: Date,
): { match: MatchRow; round: RoundRow } | null {
  const own = matches
    .filter((m) => m.station_setup_id === setupId)
    .map((match) => ({ match, round: rounds.find((r) => r.id === match.round_id) }))
    .filter((x): x is { match: MatchRow; round: RoundRow } => Boolean(x.round))
    .sort((a, b) => new Date(a.round.starts_at).getTime() - new Date(b.round.starts_at).getTime());
  if (own.length === 0) return null;
  // Offen ist, was weder abgeschlossen noch abgesagt ist. Nicht über die
  // Ergebnisversion: nach einem Rückzug ist sie > 0, das Match aber wieder
  // offen und muss neu erfasst werden.
  const open = own.filter(
    (x) => x.match.status !== 'completed' && x.match.status !== 'cancelled',
  );
  const running = open.find(
    (x) =>
      x.match.status === 'in_progress' ||
      liveStates.some((s) => s.match_id === x.match.id && Boolean(s.started_at)),
  );
  if (running) return running;
  const overdue = open.find((x) => new Date(x.round.starts_at).getTime() <= now.getTime());
  if (overdue) return overdue;
  if (open.length > 0) return open[0];
  return own[own.length - 1];
}

export function buildStationLive({
  stations,
  round,
  rounds,
  followProgress = false,
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
  liveStates,
  now,
}: {
  stations: StationRow[];
  round: RoundRow | null;
  /** Alle Runden; nötig, wenn `followProgress` gesetzt ist. */
  rounds?: RoundRow[];
  /**
   * `true` (Ansicht „Jetzt“): je Station das tatsächlich anstehende Match
   * statt des Matches der geplanten Runde. Beim Blättern bleibt die Planansicht.
   */
  followProgress?: boolean;
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
  liveStates: MatchLiveStateRow[];
  now: Date;
}): StationLive[] {
  const block = round ? (blocks.find((b) => b.id === round.block_id) ?? null) : null;

  return stations.map((station) => {
    const setup = block
      ? (stationSetups.find((s) => s.block_id === block.id && s.station_id === station.id) ?? null)
      : null;
    const game = setup ? (games.find((g) => g.id === setup.event_game_id) ?? null) : null;
    const progress =
      followProgress && setup && rounds ? progressMatchForSetup(setup.id, matches, rounds, liveStates, now) : null;
    const rowRound = progress?.round ?? round;
    const match = progress
      ? progress.match
      : round && setup
        ? (matches.find((m) => m.round_id === round.id && m.station_setup_id === setup.id) ?? null)
        : null;
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
    const liveState = match ? (liveStates.find((s) => s.match_id === match.id) ?? null) : null;
    const liveValues = ((liveState?.values as LiveValue[] | null) ?? []).filter(Boolean);
    const scoreLabel = match ? scoreLabelFor(match, participants, liveValues, currentResultValues) : null;

    const status = deriveStatus({
      setup,
      match,
      checkins,
      device,
      submissions,
      round: rowRound,
      liveStarted: Boolean(liveState?.started_at),
      now,
    });

    return {
      station,
      round: rowRound,
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

type LiveValue = { participant_id: string; measured_value?: number | null; placement?: number | null };

/**
 * Kompakter Live-Punktestand je Match, in Team-/Slot-Reihenfolge, z. B. „12:8“
 * oder „1./2.“. Bevorzugt den fortlaufenden Live-Stand der Geräte, solange das
 * Match noch nicht abgeschlossen ist; danach gilt das bestätigte Ergebnis.
 */
function scoreLabelFor(
  match: MatchRow,
  participants: MatchParticipantRow[],
  liveValues: LiveValue[],
  currentResultValues: CurrentResultValueRow[],
): string | null {
  if (participants.length === 0) return null;
  const confirmed = currentResultValues.filter((v) => v.match_id === match.id);
  const rows: LiveValue[] =
    match.status !== 'completed' && liveValues.length > 0 ? liveValues : confirmed;
  if (rows.length === 0) return null;

  const parts = participants.map((p) => {
    const row = rows.find((v) => v.participant_id === p.id);
    if (!row) return '–';
    if (row.measured_value != null) return formatScoreValue(row.measured_value);
    if (row.placement != null) return `${row.placement}.`;
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
  liveStarted,
  now,
}: {
  setup: StationSetupRow | null;
  match: MatchRow | null;
  checkins: ActiveCheckinRow[];
  device: DeviceSyncRow | null;
  submissions: OpenSubmissionRow[];
  round: RoundRow | null;
  liveStarted: boolean;
  now: Date;
}): LiveStatus {
  if (!setup || !round || !match) return 'idle';
  if (submissions.length > 0) return 'conflict';
  if (match?.status === 'cancelled') return 'cancelled';
  // Nur abgeschlossen ist erledigt; nach einem Rückzug (Version > 0, Status
  // wieder geplant) muss die Station neu erfassen.
  if (match.status === 'completed') return 'done';
  if (liveStarted) return 'running';
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
      if (!row.round) return 'Match noch nicht gestartet';
      // Nach Rundenende nicht mehr „läuft seit …“: dort fehlt dann das Ergebnis.
      return now.getTime() > new Date(row.round.ends_at).getTime()
        ? `Runde seit ${minutesSince(row.round.ends_at, now)} min vorbei, Match nie gestartet`
        : `Runde läuft seit ${minutesSince(row.round.starts_at, now)} min, Match noch nicht gestartet`;
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
  attention: 'Achtung',
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
