import type { SyncStatus } from '@/components/ui/Badge';

/**
 * Gemeinsame Platzhalterdaten für den Stationsbereich, damit Cockpit,
 * Sync-Status und Match-Erfassung dieselben Demo-Zahlen zeigen. Kein
 * Datenlayer — siehe README, Abschnitt "Tatsächlicher Implementierungsstand".
 */

export type MeasurementType = 'number' | 'outcome';

export type DemoTeam = { id: string; name: string };

export type DemoGame = {
  name: string;
  measurement: string;
  materials: string;
  durationSeconds: number;
  rules: string;
};

export const demoGames: Record<string, DemoGame> = {
  Brennball: {
    name: 'Brennball',
    measurement: 'Treffer, höher gewinnt',
    materials: '2 Bälle, 6 Hütchen',
    durationSeconds: 900,
    rules:
      'Zwei Teams treten gegeneinander an. Ein Treffer wird gezählt, sobald die angreifende Mannschaft das Ziel erreicht, bevor der Ball im Korb landet. Nach jedem Durchgang wechseln Angriff und Verteidigung.',
  },
  'Fähnchen klauen': {
    name: 'Fähnchen klauen',
    measurement: 'Sieg, Unentschieden, Niederlage',
    materials: '12 Fähnchen, 4 Hütchen',
    durationSeconds: 600,
    rules:
      'Jedes Team verteidigt die eigenen Fähnchen und versucht, die des anderen Teams zu erreichen. Wer im gegnerischen Feld abgeschlagen wird, geht zurück zur eigenen Grundlinie. Gewonnen hat, wer am Ende mehr Fähnchen besitzt.',
  },
  Kamelspiel: {
    name: 'Kamelspiel',
    measurement: 'Platzierung',
    materials: '1 Ball je Gruppe',
    durationSeconds: 600,
    rules:
      'Alle Teams spielen gleichzeitig gegeneinander. Ausgeschiedene Spielerinnen und Spieler setzen sich an den Rand. Das Team, das zuletzt übrig bleibt, gewinnt; ein Unentschieden ist nicht vorgesehen.',
  },
};

export const findGame = (name?: string) => (name ? demoGames[name] : undefined);

export type DayEntry =
  | {
      kind: 'assignment';
      id: string;
      block: string;
      start: string;
      end: string;
      station: string;
      game: string;
      groups: number;
    }
  | { kind: 'break'; id: string; block: string; start: string; end: string }
  | { kind: 'off'; id: string; block: string; start: string; end: string };

/** Vollständiger Tag der gewählten Person, inklusive Pausen und Blöcken ohne Einsatz. */
export const dayPlan: DayEntry[] = [
  {
    kind: 'assignment',
    id: 'b1',
    block: 'Block 1',
    start: '09:00',
    end: '10:30',
    station: 'Station 1 · Wiese',
    game: 'Brennball',
    groups: 3,
  },
  { kind: 'break', id: 'p1', block: 'Pause', start: '10:30', end: '11:00' },
  {
    kind: 'assignment',
    id: 'b2',
    block: 'Block 2',
    start: '11:00',
    end: '12:30',
    station: 'Station 3 · Wald',
    game: 'Fähnchen klauen',
    groups: 3,
  },
  { kind: 'break', id: 'p2', block: 'Mittagspause', start: '12:30', end: '14:00' },
  { kind: 'off', id: 'b3', block: 'Block 3', start: '14:00', end: '15:30' },
  {
    kind: 'assignment',
    id: 'b4',
    block: 'Block 4',
    start: '15:30',
    end: '17:00',
    station: 'Station 1 · Wiese',
    game: 'Brennball',
    groups: 3,
  },
];

export const findDayEntry = (id?: string | null) =>
  id ? dayPlan.find((entry) => entry.id === id) : undefined;

export const toMinutes = (time: string) => {
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
};

export type EntryState = 'past' | 'now' | 'future';

export const entryState = (entry: DayEntry, nowMinutes: number): EntryState => {
  if (nowMinutes >= toMinutes(entry.end)) return 'past';
  if (nowMinutes >= toMinutes(entry.start)) return 'now';
  return 'future';
};

export type DemoMatch = {
  id: string;
  time: string;
  round: string;
  station: string;
  block: string;
  game: string;
  teams: DemoTeam[];
  measurementType: MeasurementType;
  unit?: string;
  comparisonDirection?: 'higher' | 'lower';
  allowTies: boolean;
  status: 'scheduled' | 'in_progress' | 'completed';
  result?: { values?: Record<string, number>; placements?: Record<string, number> };
  syncStatus?: SyncStatus;
};

export const demoMatches: DemoMatch[] = [
  {
    id: '1',
    time: '10:15',
    round: 'R2',
    station: 'Station 1',
    block: 'Block 1',
    game: 'Brennball',
    teams: [
      { id: 't1', name: 'Team 1' },
      { id: 't2', name: 'Team 2' },
    ],
    measurementType: 'number',
    unit: 'Treffer',
    comparisonDirection: 'higher',
    allowTies: true,
    status: 'in_progress',
  },
  {
    id: '2',
    time: '10:35',
    round: 'R2',
    station: 'Station 1',
    block: 'Block 1',
    game: 'Brennball',
    teams: [
      { id: 't3', name: 'Team 3' },
      { id: 't4', name: 'Team 4' },
    ],
    measurementType: 'outcome',
    allowTies: true,
    status: 'scheduled',
  },
  {
    id: '3',
    time: '10:55',
    round: 'R3',
    station: 'Station 1',
    block: 'Block 1',
    game: 'Kamelspiel',
    teams: [
      { id: 't1', name: 'Team 1' },
      { id: 't2', name: 'Team 2' },
      { id: 't3', name: 'Team 3' },
      { id: 't4', name: 'Team 4' },
    ],
    measurementType: 'outcome',
    allowTies: false,
    status: 'scheduled',
  },
  {
    id: '4',
    time: '09:15',
    round: 'R1',
    station: 'Station 1',
    block: 'Block 1',
    game: 'Brennball',
    teams: [
      { id: 't2', name: 'Team 2' },
      { id: 't3', name: 'Team 3' },
    ],
    measurementType: 'number',
    unit: 'Treffer',
    comparisonDirection: 'higher',
    allowTies: true,
    status: 'completed',
    result: { values: { t2: 15, t3: 21 } },
    syncStatus: 'pending',
  },
  {
    id: '5',
    time: '08:35',
    round: 'R1',
    station: 'Station 1',
    block: 'Block 1',
    game: 'Brennball',
    teams: [
      { id: 't1', name: 'Team 1' },
      { id: 't4', name: 'Team 4' },
    ],
    measurementType: 'number',
    unit: 'Treffer',
    comparisonDirection: 'higher',
    allowTies: true,
    status: 'completed',
    result: { values: { t1: 18, t4: 12 } },
    syncStatus: 'synced',
  },
  {
    id: '6',
    time: '08:15',
    round: 'R1',
    station: 'Station 1',
    block: 'Block 1',
    game: 'Brennball',
    teams: [
      { id: 't2', name: 'Team 2' },
      { id: 't1', name: 'Team 1' },
    ],
    measurementType: 'number',
    unit: 'Treffer',
    comparisonDirection: 'higher',
    allowTies: true,
    status: 'completed',
    result: { values: { t2: 9, t1: 9 } },
    syncStatus: 'review',
  },
];

export const findMatch = (id?: string) => demoMatches.find((match) => match.id === id);

export const pendingMatches = demoMatches.filter(
  (match) => match.syncStatus === 'pending' || match.syncStatus === 'review',
);

export const pendingSyncCount = pendingMatches.length;

export const syncSummary = {
  saved: demoMatches.filter((m) => m.syncStatus).length,
  pending: demoMatches.filter((m) => m.syncStatus === 'pending').length,
  synced: demoMatches.filter((m) => m.syncStatus === 'synced').length,
};
