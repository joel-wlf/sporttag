import type { CurrentResultValueRow } from '@/lib/api/live';
import type { ResultPointRow, ResultSubmissionRow } from '@/lib/api/results';
import type { BlockRow, MatchParticipantRow, MatchRow, RoundRow, StationSetupRow } from '@/lib/api/schedule';
import type { EventGameRow } from '@/lib/api/games';
import type { StationRow } from '@/lib/api/stations';
import type { TeamRow } from '@/lib/api/teams';
import type { ResultPayload, ResultPayloadValue } from '@/lib/station/types';

/**
 * Ableitungen für das Modul "Ergebnisse & Tabelle": Statuslogik, Filter und
 * lesbare Darstellung der Ergebnis-Payloads (docs/datenkonzept.md
 * Abschnitt 4 und 5). Reine Funktionen, analog zu lib/live/derive.ts.
 */

export type ResultStatus = 'open' | 'accepted' | 'corrected' | 'withdrawn' | 'needs_review' | 'conflict' | 'cancelled';

export const resultStatusLabel: Record<ResultStatus, string> = {
  open: 'Kein Ergebnis',
  accepted: 'Angenommen',
  corrected: 'Korrigiert',
  withdrawn: 'Zurückgezogen',
  needs_review: 'Klärung nötig',
  conflict: 'Konflikt',
  cancelled: 'Abgesagt',
};

export type ResultTone = 'danger' | 'warning' | 'primary' | 'accent' | 'success' | 'subtle';

export const resultStatusTone: Record<ResultStatus, ResultTone> = {
  open: 'subtle',
  accepted: 'success',
  corrected: 'accent',
  withdrawn: 'subtle',
  needs_review: 'warning',
  conflict: 'danger',
  cancelled: 'subtle',
};

export type ResultRowParticipant = { participantId: string; team: TeamRow | null; slot: number };

export type ResultRow = {
  match: MatchRow;
  round: RoundRow | null;
  block: BlockRow | null;
  station: StationRow | null;
  game: EventGameRow | null;
  participants: ResultRowParticipant[];
  currentValues: CurrentResultValueRow[];
  openSubmissions: ResultSubmissionRow[];
  status: ResultStatus;
};

export function buildResultRows({
  matches,
  rounds,
  blocks,
  stationSetups,
  stations,
  matchParticipants,
  teams,
  games,
  submissions,
  currentResultValues,
}: {
  matches: MatchRow[];
  rounds: RoundRow[];
  blocks: BlockRow[];
  stationSetups: StationSetupRow[];
  stations: StationRow[];
  matchParticipants: MatchParticipantRow[];
  teams: TeamRow[];
  games: EventGameRow[];
  submissions: ResultSubmissionRow[];
  currentResultValues: CurrentResultValueRow[];
}): ResultRow[] {
  return matches.map((match) => {
    const round = rounds.find((r) => r.id === match.round_id) ?? null;
    const block = round ? (blocks.find((b) => b.id === round.block_id) ?? null) : null;
    const setup = stationSetups.find((s) => s.id === match.station_setup_id) ?? null;
    const station = setup ? (stations.find((s) => s.id === setup.station_id) ?? null) : null;
    const game = setup ? (games.find((g) => g.id === setup.event_game_id) ?? null) : null;
    const participants: ResultRowParticipant[] = matchParticipants
      .filter((p) => p.match_id === match.id)
      .sort((a, b) => a.slot - b.slot)
      .map((p) => ({ participantId: p.id, team: teams.find((t) => t.id === p.team_id) ?? null, slot: p.slot }));
    const currentValues = currentResultValues.filter((v) => v.match_id === match.id);
    const openSubmissions = submissions.filter((s) => s.match_id === match.id && (s.status === 'conflict' || s.status === 'needs_review'));

    let status: ResultStatus;
    if (match.status === 'cancelled') status = 'cancelled';
    else if (openSubmissions.some((s) => s.status === 'conflict')) status = 'conflict';
    else if (openSubmissions.some((s) => s.status === 'needs_review')) status = 'needs_review';
    else if (match.current_result_version === 0) status = 'open';
    else if (currentValues.length === 0) status = 'withdrawn';
    else if (match.current_result_version > 1) status = 'corrected';
    else status = 'accepted';

    return { match, round, block, station, game, participants, currentValues, openSubmissions, status };
  });
}

export function filterResultRows(
  rows: ResultRow[],
  filter: { status?: ResultStatus | 'all'; stationId?: string | 'all'; teamId?: string | 'all'; roundId?: string | 'all' },
): ResultRow[] {
  return rows.filter((row) => {
    if (filter.status && filter.status !== 'all' && row.status !== filter.status) return false;
    if (filter.stationId && filter.stationId !== 'all' && row.station?.id !== filter.stationId) return false;
    if (filter.roundId && filter.roundId !== 'all' && row.round?.id !== filter.roundId) return false;
    if (filter.teamId && filter.teamId !== 'all' && !row.participants.some((p) => p.team?.id === filter.teamId)) return false;
    return true;
  });
}

function formatMeasuredValue(value: number, unit: string | null): string {
  const text = Number.isInteger(value) ? String(value) : value.toFixed(2).replace('.', ',');
  return unit ? `${text} ${unit}` : text;
}

/** Ein Wert aus einer Payload oder aus current_result_values, lesbar dargestellt. */
function formatEntry(entry: { measured_value: number | null; placement: number | null }, unit: string | null): string {
  if (entry.measured_value !== null) return formatMeasuredValue(entry.measured_value, unit);
  if (entry.placement !== null) return `${entry.placement}.`;
  return '–';
}

/** Kompakte Klartext-Zeile einer Payload, z. B. „Team A 1. · Team B 2.“. */
export function describePayload(payload: ResultPayload, participants: ResultRowParticipant[], game: EventGameRow | null): string {
  const unit = game?.unit ?? null;
  const parts = participants.map((p) => {
    const value = payload.values.find((v) => v.participant_id === p.participantId);
    const label = p.team?.name ?? 'Unbekannt';
    if (!value) return `${label}: –`;
    return `${label} ${formatEntry({ measured_value: value.measured_value ?? null, placement: value.placement ?? null }, unit)}`;
  });
  return parts.join(' · ');
}

/** Klartext des aktuell angenommenen Ergebnisses einer Zeile, z. B. für die Ergebnisliste. */
export function describeCurrentValues(row: ResultRow): string {
  if (row.currentValues.length === 0) return '–';
  const payload: ResultPayload = {
    values: row.currentValues.map((v) => ({
      participant_id: v.participant_id,
      measured_value: v.measured_value ?? undefined,
      placement: v.placement ?? undefined,
    })),
  };
  return describePayload(payload, row.participants, row.game);
}

export type DiffEntry = {
  participantId: string;
  teamName: string;
  currentText: string;
  submittedText: string;
  changed: boolean;
};

/** Vergleich je Team zwischen dem aktuell angenommenen Stand und einer Abgabe, für den Konfliktvergleich. */
export function diffSubmission(
  currentValues: CurrentResultValueRow[],
  submissionValues: ResultPayloadValue[],
  participants: ResultRowParticipant[],
  game: EventGameRow | null,
): DiffEntry[] {
  const unit = game?.unit ?? null;
  return participants.map((p) => {
    const current = currentValues.find((v) => v.participant_id === p.participantId);
    const submitted = submissionValues.find((v) => v.participant_id === p.participantId);
    const currentText = current ? formatEntry(current, unit) : '–';
    const submittedText = submitted ? formatEntry({ measured_value: submitted.measured_value ?? null, placement: submitted.placement ?? null }, unit) : '–';
    return {
      participantId: p.participantId,
      teamName: p.team?.name ?? 'Unbekannt',
      currentText,
      submittedText,
      changed: currentText !== submittedText,
    };
  });
}

export const resultStatusOrder: ResultStatus[] = ['conflict', 'needs_review', 'open', 'accepted', 'corrected', 'withdrawn', 'cancelled'];

/** Liest eine gespeicherte Payload (Json-Spalte) als ResultPayload, defensiv gegen leere/fremde Formen. */
export function parsePayload(payload: unknown): ResultPayload {
  const values = (payload as { values?: unknown } | null)?.values;
  return { values: Array.isArray(values) ? (values as ResultPayloadValue[]) : [] };
}

export type TeamBreakdownEntry = {
  matchId: string;
  stationName: string;
  gameName: string;
  valueText: string;
  points: number;
};

/** Punkte-Aufschlüsselung eines Teams je Match, für den Tabellenplatz-Aufriss. */
export function buildTeamBreakdown(teamId: string, points: ResultPointRow[], rows: ResultRow[]): TeamBreakdownEntry[] {
  return points
    .filter((p) => p.team_id === teamId && p.match_id)
    .map((p) => {
      const row = rows.find((r) => r.match.id === p.match_id);
      const unit = row?.game?.unit ?? null;
      return {
        matchId: p.match_id as string,
        stationName: row?.station?.name ?? '–',
        gameName: row?.game?.name ?? '–',
        valueText: formatEntry({ measured_value: p.measured_value, placement: p.placement }, unit),
        points: p.points ?? 0,
      };
    });
}
