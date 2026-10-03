import { Text, View } from 'react-native';
import { Icon } from '@/components/ui/Icon';
import { useTokens } from '@/components/ui/theme';
import { liveStatusIcon, liveStatusLabel, type LiveStatus } from '@/lib/live/derive';
import { statusColor } from './liveStatusColor';

/**
 * Dieselben Statusnamen und Symbole wie Pins und Stationsliste. Früher standen
 * hier Farbnamen („Problem“, „Achtung“), die in der Liste nicht vorkamen.
 */
const entries: { statuses: LiveStatus[]; label: string }[] = [
  {
    statuses: ['late', 'conflict'],
    label: `${liveStatusLabel.late} / ${liveStatusLabel.conflict}`,
  },
  { statuses: ['unstaffed'], label: liveStatusLabel.unstaffed },
  { statuses: ['stale'], label: liveStatusLabel.stale },
  { statuses: ['running'], label: liveStatusLabel.running },
  { statuses: ['ready'], label: liveStatusLabel.ready },
  { statuses: ['done'], label: liveStatusLabel.done },
  {
    statuses: ['idle', 'cancelled'],
    label: `${liveStatusLabel.idle} / ${liveStatusLabel.cancelled}`,
  },
];

/** Zeigt nur Status, die gerade auf der Karte vorkommen (auf dem iPhone sonst vier Zeilen). */
export function MapLegend({ present, showScore }: { present: LiveStatus[]; showScore: boolean }) {
  const tokens = useTokens();
  const visible = entries.filter((e) => e.statuses.some((s) => present.includes(s)));
  return (
    <View className="flex-row flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
      {visible.map((e) => (
        <View className="flex-row items-center gap-1.5" key={e.label}>
          <View
            className="h-[18px] w-[18px] items-center justify-center rounded-full"
            style={{ backgroundColor: statusColor(tokens, e.statuses[0]) }}
          >
            <Icon
              color={tokens.onPrimary}
              name={liveStatusIcon[e.statuses[0]]}
              size={11}
              strokeWidth={2.2}
            />
          </View>
          <Text className="text-[12px] font-semibold text-subtle">{e.label}</Text>
        </View>
      ))}
      {showScore ? (
        <View className="flex-row items-center gap-1.5">
          <View className="rounded-full px-1.5" style={{ backgroundColor: tokens.accent }}>
            <Text className="text-[11px] font-black text-ink">3:1</Text>
          </View>
          <Text className="text-[12px] font-semibold text-subtle">Punktestand</Text>
        </View>
      ) : null}
    </View>
  );
}
