import { Text, View } from 'react-native';
import { useTokens } from '@/components/ui/theme';
import type { LiveTone } from '@/lib/live/derive';
import { toneColor } from './liveStatusColor';

const entries: { tone: LiveTone; label: string }[] = [
  { tone: 'danger', label: 'Problem' },
  { tone: 'warning', label: 'Achtung' },
  { tone: 'primary', label: 'Läuft' },
  { tone: 'accent', label: 'Bereit' },
  { tone: 'success', label: 'Fertig' },
  { tone: 'subtle', label: 'Kein Match' },
];

export function MapLegend() {
  const tokens = useTokens();
  return (
    <View className="flex-row flex-wrap items-center gap-x-4 gap-y-1.5 px-4 py-3">
      {entries.map((e) => (
        <View className="flex-row items-center gap-1.5" key={e.tone}>
          <View className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: toneColor(tokens, e.tone) }} />
          <Text className="text-[11px] font-semibold text-subtle">{e.label}</Text>
        </View>
      ))}
      <View className="flex-row items-center gap-1.5">
        <View className="rounded-full px-1.5" style={{ backgroundColor: tokens.accent }}>
          <Text className="text-[10px] font-black text-ink">3:1</Text>
        </View>
        <Text className="text-[11px] font-semibold text-subtle">Punktestand</Text>
      </View>
    </View>
  );
}
