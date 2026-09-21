export type MatrixRound = {
  id: string;
  block_id: string;
  kind: string;
  position: number;
  starts_at: string;
  ends_at: string;
  duration_minutes: number | null;
};
export type MatrixBlock = { id: string; kind: string; position: number; starts_at: string; ends_at: string };
export type MatrixSetup = { id: string; block_id: string; station_id: string; event_game_id: string };
export type MatrixMatch = { id: string; round_id: string; station_setup_id: string; status: string };
export type MatrixParticipant = { match_id: string; team_id: string; slot: number };
export type MatrixStation = { id: string; name: string };
export type MatrixGame = { id: string; name: string; min_teams: number; max_teams: number };
export type MatrixTeam = { id: string; name: string; number: number | null; color: string | null };

export type PlayRow = {
  kind: 'play';
  round: MatrixRound;
  roundNumber: number;
  blockId: string;
};
export type BreakRow = { kind: 'break'; round: MatrixRound };
export type BlockHeader = { kind: 'block'; block: MatrixBlock; blockNumber: number };
export type MatrixRow = PlayRow | BreakRow | BlockHeader;

export type Cell = {
  roundId: string;
  stationId: string;
  blockId: string;
  gameId: string | null;
  teamIds: string[];
};

export type Matrix = {
  rows: MatrixRow[];
  stations: MatrixStation[];
  /** Spiel je Block und Station. */
  games: Map<string, string>;
  /** Zelle je Runde und Station. */
  cells: Map<string, Cell>;
  playRounds: PlayRow[];
};

export const cellKey = (roundId: string, stationId: string) => `${roundId}:${stationId}`;
export const setupKey = (blockId: string, stationId: string) => `${blockId}:${stationId}`;

export function buildMatrix(input: {
  blocks: MatrixBlock[];
  rounds: MatrixRound[];
  setups: MatrixSetup[];
  matches: MatrixMatch[];
  participants: MatrixParticipant[];
  stations: MatrixStation[];
}): Matrix {
  const blocks = [...input.blocks].sort((a, b) => a.position - b.position);
  const blockOrder = new Map(blocks.map((b, i) => [b.id, i]));
  const rounds = [...input.rounds].sort(
    (a, b) => (blockOrder.get(a.block_id) ?? 0) - (blockOrder.get(b.block_id) ?? 0) || a.position - b.position,
  );

  const games = new Map<string, string>();
  const setupById = new Map(input.setups.map((s) => [s.id, s]));
  for (const s of input.setups) games.set(setupKey(s.block_id, s.station_id), s.event_game_id);

  const teamsByMatch = new Map<string, string[]>();
  for (const p of [...input.participants].sort((a, b) => a.slot - b.slot)) {
    const list = teamsByMatch.get(p.match_id) ?? [];
    list.push(p.team_id);
    teamsByMatch.set(p.match_id, list);
  }
  const matchByCell = new Map<string, string[]>();
  for (const m of input.matches) {
    if (m.status === 'cancelled') continue;
    const setup = setupById.get(m.station_setup_id);
    if (!setup) continue;
    matchByCell.set(cellKey(m.round_id, setup.station_id), teamsByMatch.get(m.id) ?? []);
  }

  const rows: MatrixRow[] = [];
  const cells = new Map<string, Cell>();
  const playRounds: PlayRow[] = [];
  let roundNumber = 0;
  let blockNumber = 0;
  let lastBlock: string | null = null;

  for (const round of rounds) {
    if (round.kind === 'break') {
      rows.push({ kind: 'break', round });
      lastBlock = null;
      continue;
    }
    if (round.block_id !== lastBlock) {
      const block = blocks.find((b) => b.id === round.block_id);
      if (block) {
        blockNumber += 1;
        rows.push({ kind: 'block', block, blockNumber });
      }
      lastBlock = round.block_id;
    }
    roundNumber += 1;
    const row: PlayRow = { kind: 'play', round, roundNumber, blockId: round.block_id };
    rows.push(row);
    playRounds.push(row);
    for (const station of input.stations) {
      cells.set(cellKey(round.id, station.id), {
        roundId: round.id,
        stationId: station.id,
        blockId: round.block_id,
        gameId: games.get(setupKey(round.block_id, station.id)) ?? null,
        teamIds: matchByCell.get(cellKey(round.id, station.id)) ?? [],
      });
    }
  }

  return { rows, stations: input.stations, games, cells, playRounds };
}

export type TeamStatus = 'ok' | 'selected' | 'blocked' | 'repeatGame' | 'repeatOpponent';
export type TeamOption = { team: MatrixTeam; status: TeamStatus; reason?: string };

/** Bewertet jedes Team für eine Zelle. `selection` sind die aktuell gewählten Teams der Zelle. */
export function teamOptionsForCell(
  matrix: Matrix,
  cell: Cell,
  teams: MatrixTeam[],
  selection: string[],
  gameNames: Map<string, string>,
  stationNames: Map<string, string>,
): TeamOption[] {
  const inRound = new Map<string, string>();
  const playedGame = new Set<string>();
  const opponents = new Map<string, Set<string>>();

  for (const other of matrix.cells.values()) {
    if (other.roundId === cell.roundId && other.stationId === cell.stationId) continue;
    if (other.roundId === cell.roundId) {
      for (const t of other.teamIds) inRound.set(t, other.stationId);
    }
    if (cell.gameId && other.gameId === cell.gameId) {
      for (const t of other.teamIds) playedGame.add(t);
    }
    for (const t of other.teamIds) {
      const set = opponents.get(t) ?? new Set<string>();
      for (const o of other.teamIds) if (o !== t) set.add(o);
      opponents.set(t, set);
    }
  }

  return teams.map((team) => {
    if (selection.includes(team.id)) return { team, status: 'selected' as const };
    const busyAt = inRound.get(team.id);
    if (busyAt) {
      return { team, status: 'blocked' as const, reason: `Spielt in dieser Runde schon an ${stationNames.get(busyAt) ?? 'einer anderen Station'}` };
    }
    if (cell.gameId && playedGame.has(team.id)) {
      return { team, status: 'repeatGame' as const, reason: `Hat ${gameNames.get(cell.gameId) ?? 'dieses Spiel'} schon gespielt` };
    }
    const met = selection.filter((s) => opponents.get(team.id)?.has(s));
    if (met.length > 0) {
      return { team, status: 'repeatOpponent' as const, reason: 'Hat gegen ein gewähltes Team schon gespielt' };
    }
    return { team, status: 'ok' as const };
  });
}

export type Coverage = {
  teamId: string;
  matches: number;
  gamesPlayed: Map<string, number>;
  missingGames: string[];
  idleRounds: number;
};

export function coverage(matrix: Matrix, teams: MatrixTeam[], gameIds: string[]): Coverage[] {
  const usedGames = gameIds.filter((g) => [...matrix.games.values()].includes(g));
  return teams.map((team) => {
    const gamesPlayed = new Map<string, number>();
    let matches = 0;
    const busyRounds = new Set<string>();
    for (const cell of matrix.cells.values()) {
      if (!cell.teamIds.includes(team.id)) continue;
      matches += 1;
      busyRounds.add(cell.roundId);
      if (cell.gameId) gamesPlayed.set(cell.gameId, (gamesPlayed.get(cell.gameId) ?? 0) + 1);
    }
    return {
      teamId: team.id,
      matches,
      gamesPlayed,
      missingGames: usedGames.filter((g) => !gamesPlayed.has(g)),
      idleRounds: matrix.playRounds.length - busyRounds.size,
    };
  });
}

export type Warning = { key: string; message: string };

export function scheduleWarnings(
  matrix: Matrix,
  teams: MatrixTeam[],
  gameNames: Map<string, string>,
): Warning[] {
  const warnings: Warning[] = [];
  const teamName = new Map(teams.map((t) => [t.id, t.name]));
  for (const c of coverage(matrix, teams, [...gameNames.keys()])) {
    for (const [gameId, count] of c.gamesPlayed) {
      if (count > 1) {
        warnings.push({
          key: `game:${c.teamId}:${gameId}`,
          message: `${teamName.get(c.teamId)} spielt ${gameNames.get(gameId) ?? 'ein Spiel'} ${count}×`,
        });
      }
    }
  }
  return warnings;
}

export type ProposedCell = { roundId: string; stationId: string; teamIds: string[] };

/**
 * Füllt leere Zellen mit Teams. Harte Regel: ein Team pro Runde nur einmal.
 * Weiche Regeln (gewichtet): Spiel noch nicht gespielt, Gegner noch nicht getroffen,
 * wenige bisherige Einsätze. Deterministisch.
 */
export function autoFill(
  matrix: Matrix,
  teams: MatrixTeam[],
  games: Map<string, MatrixGame>,
): ProposedCell[] {
  const playedGame = new Map<string, Set<string>>();
  const met = new Map<string, Set<string>>();
  const load = new Map<string, number>();
  const add = <K, V>(map: Map<K, Set<V>>, key: K, value: V) => {
    const set = map.get(key) ?? new Set<V>();
    set.add(value);
    map.set(key, set);
  };
  const record = (teamIds: string[], gameId: string | null) => {
    for (const t of teamIds) {
      load.set(t, (load.get(t) ?? 0) + 1);
      if (gameId) add(playedGame, t, gameId);
      for (const o of teamIds) if (o !== t) add(met, t, o);
    }
  };
  for (const cell of matrix.cells.values()) record(cell.teamIds, cell.gameId);

  const order = [...teams].sort((a, b) => (a.number ?? 0) - (b.number ?? 0) || a.name.localeCompare(b.name));
  const proposals: ProposedCell[] = [];

  const score = (teamId: string, gameId: string, chosen: string[]) => {
    let value = (load.get(teamId) ?? 0) * 10;
    if (playedGame.get(teamId)?.has(gameId)) value += 1000;
    for (const c of chosen) if (met.get(teamId)?.has(c)) value += 100;
    return value;
  };

  const fillRound = (cells: Cell[], busyAtStart: Set<string>) => {
    const busy = new Set(busyAtStart);
    const result: ProposedCell[] = [];
    let cost = 0;
    for (const cell of cells) {
      const game = games.get(cell.gameId as string);
      if (!game) continue;
      const size = Math.max(game.min_teams, Math.min(game.max_teams, 2));
      const chosen: string[] = [];
      while (chosen.length < size) {
        let best: string | null = null;
        let bestScore = Infinity;
        for (const team of order) {
          if (busy.has(team.id) || chosen.includes(team.id)) continue;
          const value = score(team.id, game.id, chosen);
          if (value < bestScore) {
            bestScore = value;
            best = team.id;
          }
        }
        if (!best) break;
        cost += bestScore;
        chosen.push(best);
        busy.add(best);
      }
      if (chosen.length < game.min_teams) {
        chosen.forEach((t) => busy.delete(t));
        cost += 5000;
        continue;
      }
      result.push({ roundId: cell.roundId, stationId: cell.stationId, teamIds: chosen });
    }
    return { result, cost };
  };

  for (const row of matrix.playRounds) {
    const busy = new Set<string>();
    const empty: Cell[] = [];
    for (const station of matrix.stations) {
      const cell = matrix.cells.get(cellKey(row.round.id, station.id));
      if (!cell) continue;
      cell.teamIds.forEach((t) => busy.add(t));
      if (cell.teamIds.length === 0 && cell.gameId) empty.push(cell);
    }
    if (empty.length === 0) continue;

    let best = fillRound(empty, busy);
    for (const ordering of orderings(empty)) {
      const attempt = fillRound(ordering, busy);
      if (attempt.cost < best.cost) best = attempt;
    }
    for (const cell of best.result) {
      record(cell.teamIds, matrix.cells.get(cellKey(cell.roundId, cell.stationId))?.gameId ?? null);
      proposals.push(cell);
    }
  }
  return proposals;
}

/** Alle Reihenfolgen bis 6 Zellen, darüber nur Rotationen (deterministisch, begrenzt). */
function orderings<T>(items: T[]): T[][] {
  if (items.length <= 6) {
    const out: T[][] = [];
    const permute = (rest: T[], acc: T[]) => {
      if (rest.length === 0) return void out.push(acc);
      rest.forEach((item, i) => permute([...rest.slice(0, i), ...rest.slice(i + 1)], [...acc, item]));
    };
    permute(items, []);
    return out;
  }
  return items.map((_, i) => [...items.slice(i), ...items.slice(0, i)]);
}

/** Aktuelle Zeilenfolge als Eingabe für schedule_apply_layout. */
export type LayoutRow = { round_id?: string; kind: 'play' | 'break'; duration_minutes?: number | null };

export function layoutFromMatrix(matrix: Matrix): LayoutRow[] {
  return matrix.rows
    .filter((r): r is PlayRow | BreakRow => r.kind !== 'block')
    .map((r) => ({ round_id: r.round.id, kind: r.kind, duration_minutes: r.round.duration_minutes }));
}
