/**
 * Typen für das lokale Stationsgerät: Offline-Paket (Spiegel von
 * `get_station_package`), Journal und Sync-Zustand. Siehe
 * docs/datenkonzept.md Abschnitt 11 und 12.
 */

export type PackageEvent = {
  id: string;
  name: string;
  motto: string | null;
  event_date: string;
  timezone: string;
  status: string;
  plan_version: number;
  staff_assignment_mode: 'station' | 'game';
  venue_north: number | null;
  venue_south: number | null;
  venue_east: number | null;
  venue_west: number | null;
};

export type PackageTeam = { id: string; name: string; number: number | null; color: string | null };

export type PackageStation = {
  id: string;
  name: string;
  location: string | null;
  latitude: number;
  longitude: number;
  arrival_notes: string | null;
};

export type PackageScoringRule = { id: string; name: string; mode: string; config: Record<string, unknown> };

export type PackageGame = {
  id: string;
  name: string;
  description: string;
  rules: string;
  referee_notes: string;
  materials: string;
  default_duration_seconds: number | null;
  measurement_type: 'outcome' | 'number';
  unit: string | null;
  comparison_direction: 'higher' | 'lower';
  min_teams: number;
  max_teams: number;
  allow_ties: boolean;
  tools_config: ToolConfig[];
  scoring_rule_id: string | null;
};

export type ToolConfig =
  | { key: string; type: 'timer'; label: string; seconds: number }
  | { key: string; type: 'stopwatch'; label: string }
  | { key: string; type: 'counter'; label: string; start?: number; step?: number };

export type PackageBlock = {
  id: string;
  name: string;
  kind: 'play' | 'break' | 'final' | 'special';
  position: number;
  starts_at: string;
  ends_at: string;
};

export type PackageRound = {
  id: string;
  block_id: string;
  label: string;
  position: number;
  kind: 'play' | 'break';
  starts_at: string;
  ends_at: string;
};

export type PackageStationSetup = {
  id: string;
  block_id: string;
  station_id: string;
  event_game_id: string;
  notes: string | null;
};

export type PackageStaff = { id: string; display_name: string; notes: string | null };

export type PackageStationAssignment = { id: string; staff_id: string; station_setup_id: string };
export type PackageGameAssignment = { id: string; staff_id: string; event_game_id: string };

export type PackageMatchParticipant = { id: string; team_id: string; slot: number };

export type PackageMatch = {
  id: string;
  round_id: string;
  station_setup_id: string;
  status: 'scheduled' | 'ready' | 'in_progress' | 'completed' | 'cancelled';
  counts_for_ranking: boolean;
  current_result_version: number;
  scoring_rule_id: string | null;
  participants: PackageMatchParticipant[];
};

export type PackageResultValue = {
  match_id: string;
  version: number;
  recorded_at: string;
  participant_id: string;
  team_id: string;
  measured_value: number | null;
  placement: number | null;
};

export type StationPackage = {
  server_time: string;
  event: PackageEvent;
  teams: PackageTeam[];
  stations: PackageStation[];
  scoring_rules: PackageScoringRule[];
  event_games: PackageGame[];
  blocks: PackageBlock[];
  rounds: PackageRound[];
  station_setups: PackageStationSetup[];
  event_staff: PackageStaff[];
  station_assignments: PackageStationAssignment[];
  game_assignments: PackageGameAssignment[];
  matches: PackageMatch[];
  current_result_values: PackageResultValue[];
};

/** Ein Tageseintrag für eine Person: Einsatz, Pause oder Block ohne Einsatz. */
export type DayEntry =
  | { kind: 'assignment'; id: string; setupId: string; block: PackageBlock; round: PackageRound | null; station: PackageStation; game: PackageGame }
  | { kind: 'break'; id: string; block: PackageBlock }
  | { kind: 'off'; id: string; block: PackageBlock };

export type OutboxKind = 'checkin' | 'result';
export type OutboxState = 'pending' | 'sending' | 'received';

export type LocalCheckin = {
  id: string;
  eventId: string;
  stationSetupId: string;
  checkedInAt: string;
  checkedOutAt: string | null;
  staffIds: string[];
};

export type ResultPayloadValue = { participant_id: string; measured_value?: number; placement?: number };
export type ResultPayload = { values: ResultPayloadValue[] };

export type LocalResultSubmission = {
  requestId: string;
  eventId: string;
  matchId: string;
  checkinId: string;
  localSequence: number;
  baseResultVersion: number;
  planVersion: number;
  payload: ResultPayload;
  payloadHash: string;
  capturedAt: string;
  reason: string | null;
};

export type OutboxEntry = {
  requestId: string;
  kind: OutboxKind;
  position: number;
  state: OutboxState;
  attemptCount: number;
  nextAttemptAt: string | null;
  lastError: string | null;
  receiptStatus: string | null;
};

export type SyncCounts = {
  pending: number;
  sending: number;
  review: number;
  synced: number;
};
