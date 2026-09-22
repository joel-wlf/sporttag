import { Pressable, Text, View } from 'react-native';
import { useTokens } from '@/components/ui/theme';
import { liveGroupOf, type LiveGroup, type StationLive } from '@/lib/live/derive';

export type LiveFilter = 'all' | LiveGroup;

const chips: { key: LiveFilter; label: string }[] = [
  { key: 'all', label: 'Alle' },
  { key: 'attention', label: 'Probleme' },
  { key: 'running', label: 'Läuft' },
  { key: 'ready', label: 'Bereit' },
  { key: 'done', label: 'Fertig' },
];

/** Filter und Kennzahlen zugleich: jede Zahl ist antippbar und filtert die Liste. */
export function LiveFilterChips({
  rows,
  value,
  onChange,
}: {
  rows: StationLive[];
  value: LiveFilter;
  onChange: (next: LiveFilter) => void;
}) {
  const tokens = useTokens();
  const count = (key: LiveFilter) => (key === 'all' ? rows.length : rows.filter((r) => liveGroupOf[r.status] === key).length);

  return (
    <View className="flex-row flex-wrap gap-2">
      {chips.map((chip) => {
        const active = value === chip.key;
        const n = count(chip.key);
        const alarm = chip.key === 'attention' && n > 0;
        return (
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            className={[
              'flex-row items-center gap-2 rounded-full border px-3.5 py-2',
              active ? 'border-primary bg-primary' : alarm ? 'border-danger bg-danger-soft' : 'border-line bg-surface',
            ].join(' ')}
            key={chip.key}
            onPress={() => onChange(chip.key)}
          >
            <Text className={['text-[13px] font-bold', active ? 'text-on-primary' : alarm ? 'text-danger' : 'text-ink'].join(' ')}>
              {chip.label}
            </Text>
            <View
              className="min-w-[22px] items-center rounded-full px-1.5 py-0.5"
              style={{ backgroundColor: active ? tokens.onPrimary : alarm ? tokens.danger : tokens.surfaceMuted }}
            >
              <Text
                className="text-[12px] font-black"
                style={{ color: active ? tokens.primary : alarm ? tokens.onPrimary : tokens.text }}
              >
                {n}
              </Text>
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}
