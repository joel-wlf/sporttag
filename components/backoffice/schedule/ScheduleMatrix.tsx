import { Pressable, ScrollView, Text, View } from 'react-native';
import { Icon } from '@/components/ui/Icon';
import { useTokens } from '@/components/ui/theme';
import { cellKey, type Matrix, type MatrixGame, type MatrixTeam, setupKey } from '@/lib/schedule/matrix';

const TIME_COL = 148;
const STATION_COL = 196;

export type CellFlag = 'repeatGame' | null;

export function formatTime(iso: string, timeZone: string): string {
  return new Date(iso).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit', timeZone });
}

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
  const width = TIME_COL + matrix.stations.length * STATION_COL + STATION_COL;

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator>
      <View style={{ width }}>
        {/* Kopfzeile: Stationen */}
        <View className="flex-row border-b border-line">
          <View className="justify-end px-3 py-3" style={{ width: TIME_COL }}>
            <Text className="text-[11px] font-bold uppercase tracking-[0.4px] text-subtle">Zeit</Text>
          </View>
          {matrix.stations.map((station) => (
            <Pressable
              accessibilityRole="button"
              className="justify-end px-3 py-3 active:opacity-70"
              key={station.id}
              onPress={() => onPressStation(station.id)}
              style={{ width: STATION_COL }}
            >
              <Text className="text-[14px] font-bold text-ink" numberOfLines={1}>
                {station.name}
              </Text>
            </Pressable>
          ))}
          <Pressable
            accessibilityLabel="Stationen unter Gelände & Stationen verwalten"
            accessibilityRole="link"
            className="flex-row items-center gap-1.5 px-3 py-3 active:opacity-70"
            onPress={onAddStation}
            style={{ width: STATION_COL }}
          >
            <Icon color={tokens.primary} name="map-pin" size={16} />
            <Text className="text-[14px] font-bold text-primary">Stationen</Text>
          </Pressable>
        </View>

        {matrix.rows.map((row) => {
          if (row.kind === 'block') {
            const blockRounds = matrix.playRounds.filter((r) => r.blockId === row.block.id);
            const first = blockRounds[0];
            const last = blockRounds[blockRounds.length - 1];
            return (
              <View className="flex-row bg-surface-muted" key={`block-${row.block.id}`}>
                <View className="justify-center px-3 py-2" style={{ width: TIME_COL }}>
                  <Text className="text-[12px] font-bold uppercase tracking-[0.4px] text-primary">Block {row.blockNumber}</Text>
                  {first && last ? (
                    <Text className="text-[11px] text-subtle">
                      {formatTime(first.round.starts_at, timeZone)}–{formatTime(last.round.ends_at, timeZone)}
                    </Text>
                  ) : null}
                </View>
                {matrix.stations.map((station) => {
                  const gameId = matrix.games.get(setupKey(row.block.id, station.id));
                  const game = gameId ? games.get(gameId) : undefined;
                  return (
                    <View className="p-1.5" key={station.id} style={{ width: STATION_COL }}>
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
                className="flex-row items-center border-b border-line active:opacity-80"
                key={row.round.id}
                onPress={() => onPressRow(row.round.id)}
              >
                <View className="px-3 py-2" style={{ width: TIME_COL }}>
                  <Text className="text-[13px] font-bold text-subtle">Pause</Text>
                  <Text className="text-[12px] text-subtle">
                    {formatTime(row.round.starts_at, timeZone)}–{formatTime(row.round.ends_at, timeZone)}
                  </Text>
                </View>
                <View className="flex-1 flex-row items-center gap-2 px-3 py-2">
                  <Icon name="pause" size={14} />
                  <Text className="text-[13px] text-subtle">Pause · Spielwechsel an allen Stationen</Text>
                </View>
              </Pressable>
            );
          }

          return (
            <View className="flex-row border-b border-line" key={row.round.id}>
              <Pressable
                accessibilityRole="button"
                className="justify-center px-3 py-2 active:opacity-70"
                onPress={() => onPressRow(row.round.id)}
                style={{ width: TIME_COL }}
              >
                <Text className="text-[14px] font-bold text-ink">Runde {row.roundNumber}</Text>
                <Text className="text-[12px] text-subtle">
                  {formatTime(row.round.starts_at, timeZone)}–{formatTime(row.round.ends_at, timeZone)}
                  {row.round.duration_minutes ? ` · ${row.round.duration_minutes} min` : ''}
                </Text>
              </Pressable>
              {matrix.stations.map((station) => {
                const cell = matrix.cells.get(cellKey(row.round.id, station.id));
                const flags = cellFlags.get(cellKey(row.round.id, station.id));
                const disabled = !cell?.gameId;
                return (
                  <View className="p-1.5" key={station.id} style={{ width: STATION_COL }}>
                    <Pressable
                      accessibilityLabel={`Runde ${row.roundNumber}, ${station.name}`}
                      accessibilityRole="button"
                      className={[
                        'min-h-[52px] justify-center gap-1 rounded-lg border px-2 py-1.5',
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
                            <View className="flex-row items-center gap-1.5" key={teamId}>
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
    </ScrollView>
  );
}
