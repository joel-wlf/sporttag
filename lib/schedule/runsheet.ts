import { cellKey, type Matrix, type MatrixTeam } from '@/lib/schedule/matrix';

export type RunsheetRow = {
  block: number | null;
  round: number | null;
  start: string;
  end: string;
  /** „Spiel“, „Pause“ oder „frei“ (Team hat in dieser Runde keinen Einsatz). */
  kind: 'play' | 'break' | 'free';
  station: string;
  location: string;
  game: string;
  opponents: string;
};

export type TeamRunsheet = { team: MatrixTeam; rows: RunsheetRow[] };

type StationInfo = { id: string; name: string; location?: string | null };

export function formatClock(iso: string, timeZone: string): string {
  return new Date(iso).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit', timeZone });
}

/** Laufzettel je Team, chronologisch, nur aus der Planungsmatrix abgeleitet. */
export function buildRunsheets(input: {
  matrix: Matrix;
  teams: MatrixTeam[];
  stations: StationInfo[];
  gameNames: Map<string, string>;
  timeZone: string;
}): TeamRunsheet[] {
  const { matrix, stations, gameNames, timeZone } = input;
  const teamName = new Map(input.teams.map((t) => [t.id, t.name]));
  const teams = [...input.teams].sort(
    (a, b) => (a.number ?? Number.MAX_SAFE_INTEGER) - (b.number ?? Number.MAX_SAFE_INTEGER) || a.name.localeCompare(b.name, 'de'),
  );
  const blockOfRow = new Map<string, number>();
  let currentBlock: number | null = null;
  for (const row of matrix.rows) {
    if (row.kind === 'block') currentBlock = row.blockNumber;
    else if (row.kind === 'play') blockOfRow.set(row.round.id, currentBlock ?? 0);
  }

  return teams.map((team) => {
    const rows: RunsheetRow[] = [];
    for (const row of matrix.rows) {
      if (row.kind === 'block') continue;
      const start = formatClock(row.round.starts_at, timeZone);
      const end = formatClock(row.round.ends_at, timeZone);
      if (row.kind === 'break') {
        rows.push({ block: null, round: null, start, end, kind: 'break', station: '', location: '', game: 'Pause', opponents: '' });
        continue;
      }
      const cell = stations
        .map((s) => matrix.cells.get(cellKey(row.round.id, s.id)))
        .find((c) => c?.teamIds.includes(team.id));
      const block = blockOfRow.get(row.round.id) ?? null;
      if (!cell) {
        rows.push({ block, round: row.roundNumber, start, end, kind: 'free', station: '', location: '', game: 'frei', opponents: '' });
        continue;
      }
      const station = stations.find((s) => s.id === cell.stationId);
      rows.push({
        block,
        round: row.roundNumber,
        start,
        end,
        kind: 'play',
        station: station?.name ?? '',
        location: station?.location ?? '',
        game: cell.gameId ? (gameNames.get(cell.gameId) ?? '') : '',
        opponents: cell.teamIds
          .filter((id) => id !== team.id)
          .map((id) => teamName.get(id) ?? '')
          .join(', '),
      });
    }
    return { team, rows };
  });
}

/** Excel-Blattnamen: höchstens 31 Zeichen, ohne `[]:*?/\`, eindeutig. */
export function sheetNames(names: string[], reserved: string[] = []): string[] {
  const used = new Set(reserved.map((n) => n.toLowerCase()));
  return names.map((raw) => {
    const base = (raw.replace(/[[\]:*?/\\]/g, '').trim() || 'Team').slice(0, 31);
    let name = base;
    for (let i = 2; used.has(name.toLowerCase()); i += 1) {
      const suffix = ` ${i}`;
      name = base.slice(0, 31 - suffix.length) + suffix;
    }
    used.add(name.toLowerCase());
    return name;
  });
}
