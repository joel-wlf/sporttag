import { Pressable, ScrollView, Text, View, useWindowDimensions } from 'react-native';
import { Icon } from '@/components/ui/Icon';
import { useTokens } from '@/components/ui/theme';
import { cellKey, type Matrix, type MatrixGame, type MatrixTeam, setupKey } from '@/lib/schedule/matrix';

export type CellFlag = 'repeatGame' | null;

export function formatTime(iso: string, timeZone: string): string {
  return new Date(iso).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit', timeZone });
}

/** Kopfzeile, Blockzeile und Pausenzeile haben feste Höhen; Spielrunden wachsen mit der Teamzahl. */
const HEADER_H = 44;
const BLOCK_H = 52;
const BREAK_H = 48;
const TEAM_LINE_H = 18;
const TEAM_LINE_GAP = 4;

type Row = Matrix['rows'][number];

/**
 * Zeitplan als Matrix: Zeilen sind Runden, Spalten Stationen. Die Runden-
 * spalte steht fest, nur die Stationen scrollen seitlich – auf dem iPhone
 * verschwand sonst beim Wischen die Angabe, welche Zeile welche Runde ist.
 * Beide Seiten nutzen dieselben, aus dem Inhalt berechneten Zeilenhöhen.
 */
export function ScheduleMatrix({
  matrix,
  games,
  teams,
  timeZone,
  cellFlags,
  onPressRow,
  onPressCell,
  onPressGame,
  onPressStation,
  onAddStation,
}: {
  matrix: Matrix;
  games: Map<string, MatrixGame>;
  teams: Map<string, MatrixTeam>;
  timeZone: string;
  cellFlags: Map<string, Set<string>>;
  onPressRow: (roundId: string) => void;
  onPressCell: (roundId: string, stationId: string) => void;
  onPressGame: (blockId: string, stationId: string) => void;
  onPressStation: (stationId: string) => void;
  onAddStation: () => void;
}) {
  const tokens = useTokens();
  const { width: windowWidth } = useWindowDimensions();
  const compact = windowWidth < 700;
  const timeCol = compact ? 104 : 148;
  const stationCol = compact ? 156 : 196;

  const rowHeight = (row: Row): number => {
    if (row.kind === 'block') return BLOCK_H;
    if (row.kind === 'break') return BREAK_H;
    let most = 1;
    for (const station of matrix.stations) {
      const count = matrix.cells.get(cellKey(row.round.id, station.id))?.teamIds.length ?? 0;
      if (count > most) most = count;
    }
    // p-1.5 außen + py-1.5 innen, je Team eine Zeile.
    return Math.max(64, 24 + most * TEAM_LINE_H + (most - 1) * TEAM_LINE_GAP);
  };

  const rowKey = (row: Row) => (row.kind === 'block' ? `block-${row.block.id}` : row.round.id);

  // --- feste Spalte links ---------------------------------------------------
  const fixedColumn = (
    <View className="border-r border-line" style={{ width: timeCol }}>
      <View className="justify-end border-b border-line px-3 pb-2" style={{ height: HEADER_H }}>
        <Text className="text-[11px] font-bold uppercase tracking-[0.4px] text-subtle">Runde</Text>
      </View>
      {matrix.rows.map((row) => {
        const height = rowHeight(row);
        if (row.kind === 'block') {
          const blockRounds = matrix.playRounds.filter((r) => r.blockId === row.block.id);
          const first = blockRounds[0];
          const last = blockRounds[blockRounds.length - 1];
          return (
            <View className="justify-center bg-surface-muted px-3" key={rowKey(row)} style={{ height }}>
              <Text className="text-[12px] font-bold uppercase tracking-[0.4px] text-primary">Block {row.blockNumber}</Text>
              {first && last ? (
                <Text className="text-[11px] text-subtle" numberOfLines={1}>
                  {formatTime(first.round.starts_at, timeZone)}–{formatTime(last.round.ends_at, timeZone)}
                </Text>
              ) : null}
            </View>
          );
        }
        const isBreak = row.kind === 'break';
        return (
          <Pressable
            accessibilityHint="Dauer ändern, Zeilen einfügen oder löschen"
            accessibilityLabel={isBreak ? 'Pause' : `Runde ${row.roundNumber}`}
            accessibilityRole="button"
            className="justify-center border-b border-line px-3 active:opacity-70"
            key={rowKey(row)}
            onPress={() => onPressRow(row.round.id)}
            style={{ height }}
          >
            <Text className={['text-[14px] font-bold', isBreak ? 'text-subtle' : 'text-ink'].join(' ')}>
              {isBreak ? 'Pause' : `Runde ${row.roundNumber}`}
            </Text>
            <Text className="text-[12px] text-subtle" numberOfLines={2}>
              {formatTime(row.round.starts_at, timeZone)}–{formatTime(row.round.ends_at, timeZone)}
              {!isBreak && row.round.duration_minutes ? ` · ${row.round.duration_minutes} min` : ''}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );

  // --- scrollbare Stationsspalten -------------------------------------------
  const width = matrix.stations.length * stationCol + stationCol;
  const scrollingColumns = (
    <View style={{ width }}>
      <View className="flex-row border-b border-line" style={{ height: HEADER_H }}>
        {matrix.stations.map((station) => (
          <Pressable
            accessibilityHint="Station bearbeiten"
            accessibilityRole="button"
            className="justify-end px-3 pb-2 active:opacity-70"
            key={station.id}
            onPress={() => onPressStation(station.id)}
            style={{ width: stationCol }}
          >
            <Text className="text-[14px] font-bold text-ink" numberOfLines={1}>
              {station.name}
            </Text>
          </Pressable>
        ))}
        <Pressable
          accessibilityLabel="Stationen unter Gelände & Stationen verwalten"
          accessibilityRole="link"
          className="flex-row items-end gap-1.5 px-3 pb-2 active:opacity-70"
          onPress={onAddStation}
          style={{ width: stationCol }}
        >
          <Icon color={tokens.primary} name="map-pin" size={16} />
          <Text className="text-[14px] font-bold text-primary">Stationen</Text>
        </Pressable>
      </View>

      {matrix.rows.map((row) => {
        const height = rowHeight(row);
        if (row.kind === 'block') {
          return (
            <View className="flex-row bg-surface-muted" key={rowKey(row)} style={{ height }}>
              {matrix.stations.map((station) => {
                const gameId = matrix.games.get(setupKey(row.block.id, station.id));
                const game = gameId ? games.get(gameId) : undefined;
                return (
                  <View className="justify-center p-1.5" key={station.id} style={{ width: stationCol }}>
                    <Pressable
                      accessibilityLabel={`Spiel für ${station.name} in Block ${row.blockNumber}`}
                      accessibilityRole="button"
                      className={[
                        'min-h-[36px] flex-row items-center justify-between gap-2 rounded-lg border px-2.5',
                        game ? 'border-line bg-surface' : 'border-dashed border-primary bg-transparent',
                      ].join(' ')}
                      onPress={() => onPressGame(row.block.id, station.id)}
                    >
                      <Text className={['flex-1 text-[13px] font-semibold', game ? 'text-ink' : 'text-primary'].join(' ')} numberOfLines={1}>
                        {game ? game.name : 'Spiel wählen'}
                      </Text>
                      <Icon name="chevron-down" size={14} />
                    </Pressable>
                  </View>
                );
              })}
            </View>
          );
        }

        if (row.kind === 'break') {
          return (
            <Pressable
              accessibilityLabel="Pause bearbeiten"
              accessibilityRole="button"
              className="flex-row items-center gap-2 border-b border-line px-3 active:opacity-80"
              key={rowKey(row)}
              onPress={() => onPressRow(row.round.id)}
              style={{ height }}
            >
              <Icon name="pause" size={14} />
              <Text className="text-[13px] text-subtle">Pause · Spielwechsel an allen Stationen</Text>
            </Pressable>
          );
        }

        return (
          <View className="flex-row border-b border-line" key={rowKey(row)} style={{ height }}>
            {matrix.stations.map((station) => {
              const cell = matrix.cells.get(cellKey(row.round.id, station.id));
              const flags = cellFlags.get(cellKey(row.round.id, station.id));
              const disabled = !cell?.gameId;
              return (
                <View className="p-1.5" key={station.id} style={{ width: stationCol }}>
                  <Pressable
                    accessibilityLabel={`Runde ${row.roundNumber}, ${station.name}`}
                    accessibilityRole="button"
                    className={[
                      'flex-1 justify-center gap-1 rounded-lg border px-2 py-1.5',
                      !cell?.gameId
                        ? 'border-line bg-surface-muted opacity-60'
                        : cell.teamIds.length === 0
                          ? 'border-dashed border-line bg-transparent active:bg-primary-soft'
                          : 'border-line bg-surface active:opacity-80',
                    ].join(' ')}
                    disabled={disabled}
                    onPress={() => onPressCell(row.round.id, station.id)}
                  >
                    {!cell?.gameId ? (
                      <Text className="text-[11px] text-subtle">Kein Spiel</Text>
                    ) : cell.teamIds.length === 0 ? (
                      <Text className="text-[12px] text-subtle">+ Teams</Text>
                    ) : (
                      cell.teamIds.map((teamId, index) => {
                        const team = teams.get(teamId);
                        const warn = flags?.has(teamId);
                        return (
                          <View className="flex-row items-center gap-1.5" key={teamId} style={{ height: TEAM_LINE_H }}>
                            {index > 0 ? <Text className="text-[11px] text-subtle">vs</Text> : null}
                            <View className="h-2 w-2 rounded-full" style={{ backgroundColor: team?.color ?? tokens.secondary }} />
                            <Text className={['flex-1 text-[13px] font-semibold', warn ? 'text-warning' : 'text-ink'].join(' ')} numberOfLines={1}>
                              {team?.name ?? 'Team'}
                            </Text>
                            {warn ? <Icon color={tokens.warning} name="alert" size={13} /> : null}
                          </View>
                        );
                      })
                    )}
                  </Pressable>
                </View>
              );
            })}
          </View>
        );
      })}
    </View>
  );

  return (
    <View className="flex-row">
      {fixedColumn}
      <ScrollView className="flex-1" horizontal showsHorizontalScrollIndicator>
        {scrollingColumns}
      </ScrollView>
    </View>
  );
}
