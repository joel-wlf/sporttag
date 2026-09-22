import { useEffect, useMemo, useRef } from 'react';
import { Pressable, ScrollView, Text, useWindowDimensions, View } from 'react-native';
import { Icon } from '@/components/ui/Icon';
import { useTokens, type ThemeTokens } from '@/components/ui/theme';
import {
  delayTone,
  formatDelay,
  formatDuration,
  legPhaseLabel,
  type LegPhase,
  type Timeline,
} from '@/lib/live/timeline';

/**
 * Zeitleiste des Veranstaltungstags als Gantt-Diagramm. Sie zeigt nicht, wie
 * spät es ist, sondern wie der Tag tatsächlich läuft: wo eine Gruppe wartet,
 * wo eine Station leer steht und wie weit sich die Gruppen gegeneinander
 * verschoben haben. Der helle Balken ist der Plan, der kräftige das Ist —
 * die Lücke dazwischen ist der Overhead (docs/datenkonzept.md 11.7).
 */

const LABEL_WIDTH = 132;
const ROW_HEIGHT = 40;
const AXIS_HEIGHT = 26;
const PX_PER_MINUTE = 5;
const MIN_BAR_WIDTH = 4;

// Vertikale Ansicht (schmale Bildschirme): Zeit läuft von oben nach unten,
// Stationen/Gruppen liegen als Spalten nebeneinander.
const AXIS_WIDTH = 52;
const COLUMN_WIDTH = 104;
const HEADER_HEIGHT = 44;

export type GanttMode = 'station' | 'team';

type Bar = {
  key: string;
  plannedStart: number;
  plannedEnd: number;
  actualStart: number | null;
  actualEnd: number | null;
  phase: LegPhase;
  label: string;
  caption: string | null;
};

type Row = {
  key: string;
  title: string;
  subtitle: string | null;
  tone: 'default' | 'ahead' | 'slipping' | 'late';
  bars: Bar[];
};

function phaseFill(tokens: ThemeTokens, phase: LegPhase): string {
  switch (phase) {
    case 'waiting':
      return tokens.warning;
    case 'playing':
      return tokens.primary;
    case 'played':
      return tokens.accent;
    case 'released':
      return tokens.success;
    case 'cancelled':
      return tokens.muted;
    case 'planned':
      return tokens.border;
  }
}

function formatClock(value: number, timezone: string) {
  try {
    return new Intl.DateTimeFormat('de-DE', { hour: '2-digit', minute: '2-digit', timeZone: timezone }).format(
      new Date(value),
    );
  } catch {
    return new Intl.DateTimeFormat('de-DE', { hour: '2-digit', minute: '2-digit' }).format(new Date(value));
  }
}

/** Viertelstunden-Raster; beschriftet wird nur die volle halbe Stunde. */
function buildTicks(domainStart: number, domainEnd: number) {
  const step = 15 * 60_000;
  const first = Math.ceil(domainStart / step) * step;
  const ticks: { value: number; major: boolean }[] = [];
  for (let t = first; t <= domainEnd; t += step) {
    ticks.push({ value: t, major: new Date(t).getMinutes() % 30 === 0 });
  }
  return ticks;
}

export function TimelineGantt({
  timeline,
  mode,
  now,
  timezone,
  onSelectStation,
  selectedStationId,
  vertical = false,
}: {
  timeline: Timeline;
  mode: GanttMode;
  now: Date;
  timezone: string;
  onSelectStation?: (stationId: string) => void;
  selectedStationId?: string | null;
  /** Auf schmalen Bildschirmen läuft die Zeit von oben nach unten statt von links nach rechts. */
  vertical?: boolean;
}) {
  const tokens = useTokens();
  const scrollRef = useRef<ScrollView>(null);
  const verticalScrollRef = useRef<ScrollView>(null);
  const positioned = useRef(false);
  const { height: windowHeight } = useWindowDimensions();
  // Begrenzt die vertikale Ansicht auf ein handliches Fenster, statt die ganze
  // Seite über Stunden leerer Zeit hinweg zu strecken – man scrollt innerhalb
  // der Karte, nicht auf der ganzen Seite.
  const verticalPaneHeight = Math.round(Math.min(560, Math.max(320, windowHeight * 0.55)));

  const { domainStart, domainEnd } = timeline;
  const totalMinutes = Math.max(30, (domainEnd - domainStart) / 60_000);
  const trackWidth = Math.round(totalMinutes * PX_PER_MINUTE);
  const x = (value: number) => ((value - domainStart) / 60_000) * PX_PER_MINUTE;

  const rows: Row[] = useMemo(() => {
    if (mode === 'station') {
      return timeline.stations.map((station) => ({
        key: station.stationId,
        title: station.stationName,
        subtitle: formatDuration(station.idleMs) ? `${formatDuration(station.idleMs)} Leerlauf` : null,
        tone: 'default' as const,
        bars: station.bars.map((bar) => ({
          key: bar.key,
          plannedStart: bar.plannedStart,
          plannedEnd: bar.plannedEnd,
          actualStart: bar.actualStart,
          actualEnd: bar.actualEnd,
          phase: bar.phase,
          label: bar.label,
          caption:
            bar.phase === 'waiting' && bar.arrivedCount < bar.teamCount
              ? `${bar.arrivedCount}/${bar.teamCount} da`
              : null,
        })),
      }));
    }
    return timeline.teams.map((team) => {
      const tone = delayTone(team.delayMs);
      return {
        key: team.teamId,
        title: team.teamNumber ? `${team.teamNumber} · ${team.teamName}` : team.teamName,
        subtitle: formatDelay(team.delayMs),
        tone: tone === 'onTime' ? ('default' as const) : tone,
        bars: team.legs.map((leg) => ({
          key: leg.key,
          plannedStart: leg.plannedStart,
          plannedEnd: leg.plannedEnd,
          actualStart: leg.arrivedAt,
          actualEnd: leg.releasedAt,
          phase: leg.phase,
          label: leg.stationName,
          caption: formatDuration(leg.waitMs) ? `wartet ${formatDuration(leg.waitMs)}` : null,
        })),
      };
    });
  }, [mode, timeline]);

  const nowX = x(now.getTime());

  // Einmalig auf das Jetzt scrollen, danach bleibt die Position der Bedienung.
  useEffect(() => {
    if (positioned.current || rows.length === 0) return;
    positioned.current = true;
    if (vertical) {
      const target = HEADER_HEIGHT + nowX - verticalPaneHeight / 2;
      verticalScrollRef.current?.scrollTo({ y: Math.max(0, target), animated: false });
    } else {
      scrollRef.current?.scrollTo({ x: Math.max(0, nowX - 160), animated: false });
    }
  }, [nowX, rows.length, vertical, verticalPaneHeight]);

  if (rows.length === 0) {
    return (
      <Text className="px-1 py-6 text-center text-[13px] text-subtle">
        Sobald Runden geplant sind und Gruppen einchecken, entsteht hier die Zeitleiste.
      </Text>
    );
  }

  const ticks = buildTicks(domainStart, domainEnd);

  const subtitleClass: Record<Row['tone'], string> = {
    default: 'text-subtle',
    ahead: 'text-success',
    slipping: 'text-warning',
    late: 'text-danger',
  };

  if (vertical) {
    return (
      <ScrollView ref={verticalScrollRef} showsVerticalScrollIndicator style={{ maxHeight: verticalPaneHeight }}>
        <View className="flex-row">
          <View style={{ width: AXIS_WIDTH }}>
            <View style={{ height: HEADER_HEIGHT }} />
            <View style={{ height: trackWidth }}>
              {ticks.map((tick) => (
                <View className="absolute left-0 right-0" key={tick.value} style={{ top: x(tick.value) }}>
                  <View className="border-t" style={{ borderColor: tick.major ? tokens.border : tokens.surfaceMuted }} />
                  {tick.major ? (
                    <Text className="absolute right-1 -top-2 text-[10px] font-bold text-subtle">
                      {formatClock(tick.value, timezone)}
                    </Text>
                  ) : null}
                </View>
              ))}
            </View>
          </View>

          <ScrollView horizontal showsHorizontalScrollIndicator>
            <View>
              <View className="flex-row border-b border-line" style={{ height: HEADER_HEIGHT }}>
                {rows.map((row) => {
                  const selected = mode === 'station' && row.key === selectedStationId;
                  return (
                    <Pressable
                      accessibilityRole={onSelectStation && mode === 'station' ? 'button' : undefined}
                      className={['items-center justify-end rounded-t-xl px-1 pb-1', selected ? 'bg-primary-soft' : ''].join(' ')}
                      disabled={mode !== 'station' || !onSelectStation}
                      key={row.key}
                      onPress={() => onSelectStation?.(row.key)}
                      style={{ width: COLUMN_WIDTH, height: HEADER_HEIGHT }}
                    >
                      <Text className="text-center text-[11px] font-bold text-ink" numberOfLines={2}>
                        {row.title}
                      </Text>
                      {row.subtitle ? (
                        <Text
                          className={['text-center text-[10px] font-semibold', subtitleClass[row.tone]].join(' ')}
                          numberOfLines={1}
                        >
                          {row.subtitle}
                        </Text>
                      ) : null}
                    </Pressable>
                  );
                })}
              </View>

              <View className="flex-row" style={{ height: trackWidth }}>
                {rows.map((row) => (
                  <View className="border-r border-line/40" key={row.key} style={{ width: COLUMN_WIDTH, height: trackWidth }}>
                    {ticks.map((tick) => (
                      <View
                        className="absolute left-0 right-0 border-t"
                        key={tick.value}
                        style={{ top: x(tick.value), borderColor: tick.major ? tokens.border : tokens.surfaceMuted }}
                      />
                    ))}

                    {row.bars.map((bar) => {
                      const plannedTop = x(bar.plannedStart);
                      const plannedHeight = Math.max(MIN_BAR_WIDTH, x(bar.plannedEnd) - plannedTop);
                      // Ein laufender Aufenthalt wächst bis jetzt weiter.
                      const actualEnd = bar.actualEnd ?? (bar.actualStart !== null ? now.getTime() : null);
                      const actualTop = bar.actualStart !== null ? x(bar.actualStart) : null;
                      const actualHeight =
                        actualTop !== null && actualEnd !== null ? Math.max(MIN_BAR_WIDTH, x(actualEnd) - actualTop) : 0;

                      return (
                        <View key={bar.key}>
                          <View
                            className="absolute rounded-md border border-dashed"
                            style={{
                              top: plannedTop,
                              height: plannedHeight,
                              left: 6,
                              right: 6,
                              borderColor: tokens.border,
                              backgroundColor: tokens.surfaceMuted,
                            }}
                          />
                          {actualTop !== null ? (
                            <View
                              className="absolute justify-center overflow-hidden rounded-md px-1"
                              style={{
                                top: actualTop,
                                height: actualHeight,
                                left: 10,
                                right: 10,
                                backgroundColor: phaseFill(tokens, bar.phase),
                                opacity: bar.phase === 'cancelled' ? 0.4 : 1,
                              }}
                            >
                              {actualHeight > 26 ? (
                                <Text className="text-[10px] font-black" numberOfLines={1} style={{ color: tokens.onPrimary }}>
                                  {bar.caption ?? bar.label}
                                </Text>
                              ) : null}
                            </View>
                          ) : null}
                        </View>
                      );
                    })}
                  </View>
                ))}
              </View>

              {nowX >= 0 && nowX <= trackWidth ? (
                <View
                  className="absolute right-0"
                  pointerEvents="none"
                  style={{ left: 0, top: HEADER_HEIGHT + nowX, height: 2, backgroundColor: tokens.danger }}
                />
              ) : null}
            </View>
          </ScrollView>
        </View>
      </ScrollView>
    );
  }

  return (
    <View className="flex-row">
      <View style={{ width: LABEL_WIDTH }}>
        <View className="justify-end pb-1" style={{ height: AXIS_HEIGHT }}>
          <Text className="text-2xs font-black tracking-[0.6px] text-subtle">
            {mode === 'station' ? 'STATION' : 'GRUPPE'}
          </Text>
        </View>
        {rows.map((row) => {
          const selected = mode === 'station' && row.key === selectedStationId;
          return (
            <Pressable
              accessibilityRole={onSelectStation && mode === 'station' ? 'button' : undefined}
              className={['justify-center rounded-l-xl pr-2', selected ? 'bg-primary-soft' : ''].join(' ')}
              disabled={mode !== 'station' || !onSelectStation}
              key={row.key}
              onPress={() => onSelectStation?.(row.key)}
              style={{ height: ROW_HEIGHT }}
            >
              <Text className="text-[12px] font-bold text-ink" numberOfLines={1}>
                {row.title}
              </Text>
              {row.subtitle ? (
                <Text className={['text-[11px] font-semibold', subtitleClass[row.tone]].join(' ')} numberOfLines={1}>
                  {row.subtitle}
                </Text>
              ) : null}
            </Pressable>
          );
        })}
      </View>

      <ScrollView horizontal ref={scrollRef} showsHorizontalScrollIndicator>
        <View style={{ width: trackWidth }}>
          <View className="border-b border-line" style={{ height: AXIS_HEIGHT }}>
            {ticks.map((tick) => (
              <View className="absolute bottom-0 top-0" key={tick.value} style={{ left: x(tick.value) }}>
                <View className="flex-1 border-l" style={{ borderColor: tick.major ? tokens.border : tokens.surfaceMuted }} />
                {tick.major ? (
                  <Text className="absolute left-1 top-0.5 text-[10px] font-bold text-subtle">
                    {formatClock(tick.value, timezone)}
                  </Text>
                ) : null}
              </View>
            ))}
          </View>

          {rows.map((row) => (
            <View className="border-b border-line/40" key={row.key} style={{ height: ROW_HEIGHT }}>
              {ticks.map((tick) => (
                <View
                  className="absolute bottom-0 top-0 border-l"
                  key={tick.value}
                  style={{ left: x(tick.value), borderColor: tick.major ? tokens.border : tokens.surfaceMuted }}
                />
              ))}

              {row.bars.map((bar) => {
                const plannedLeft = x(bar.plannedStart);
                const plannedWidth = Math.max(MIN_BAR_WIDTH, x(bar.plannedEnd) - plannedLeft);
                // Ein laufender Aufenthalt wächst bis jetzt weiter.
                const actualEnd = bar.actualEnd ?? (bar.actualStart !== null ? now.getTime() : null);
                const actualLeft = bar.actualStart !== null ? x(bar.actualStart) : null;
                const actualWidth =
                  actualLeft !== null && actualEnd !== null ? Math.max(MIN_BAR_WIDTH, x(actualEnd) - actualLeft) : 0;

                return (
                  <View key={bar.key}>
                    <View
                      className="absolute rounded-md border border-dashed"
                      style={{
                        left: plannedLeft,
                        width: plannedWidth,
                        top: 6,
                        height: ROW_HEIGHT - 12,
                        borderColor: tokens.border,
                        backgroundColor: tokens.surfaceMuted,
                      }}
                    />
                    {actualLeft !== null ? (
                      <View
                        className="absolute justify-center overflow-hidden rounded-md px-1.5"
                        style={{
                          left: actualLeft,
                          width: actualWidth,
                          top: 10,
                          height: ROW_HEIGHT - 20,
                          backgroundColor: phaseFill(tokens, bar.phase),
                          opacity: bar.phase === 'cancelled' ? 0.4 : 1,
                        }}
                      >
                        {actualWidth > 46 ? (
                          <Text className="text-[10px] font-black" numberOfLines={1} style={{ color: tokens.onPrimary }}>
                            {bar.caption ?? bar.label}
                          </Text>
                        ) : null}
                      </View>
                    ) : null}
                  </View>
                );
              })}
            </View>
          ))}

          {nowX >= 0 && nowX <= trackWidth ? (
            <View
              className="absolute bottom-0"
              pointerEvents="none"
              style={{ left: nowX, top: 0, width: 2, backgroundColor: tokens.danger }}
            />
          ) : null}
        </View>
      </ScrollView>
    </View>
  );
}

/** Kurze Erklärung der Balkenfarben, direkt unter dem Diagramm. */
export function GanttLegend({ mode }: { mode: GanttMode }) {
  const tokens = useTokens();
  const items: { color: string; label: string }[] = [
    { color: tokens.surfaceMuted, label: 'Plan' },
    { color: tokens.warning, label: legPhaseLabel.waiting },
    { color: tokens.primary, label: legPhaseLabel.playing },
    { color: tokens.accent, label: legPhaseLabel.played },
    { color: tokens.success, label: legPhaseLabel.released },
  ];
  return (
    <View className="flex-row flex-wrap items-center gap-x-4 gap-y-1.5 px-1">
      {items.map((item) => (
        <View className="flex-row items-center gap-1.5" key={item.label}>
          <View className="h-2.5 w-4 rounded-sm" style={{ backgroundColor: item.color }} />
          <Text className="text-[11px] font-semibold text-subtle">{item.label}</Text>
        </View>
      ))}
      <View className="flex-row items-center gap-1.5">
        <View className="h-3 w-0.5" style={{ backgroundColor: tokens.danger }} />
        <Text className="text-[11px] font-semibold text-subtle">jetzt</Text>
      </View>
      <View className="flex-row items-center gap-1.5">
        <Icon color={tokens.subtle} name="clock" size={12} />
        <Text className="text-[11px] text-subtle">
          {mode === 'station' ? 'Lücke zwischen zwei Balken = Station steht leer' : 'Lücke zwischen zwei Balken = Weg zur nächsten Station'}
        </Text>
      </View>
    </View>
  );
}
