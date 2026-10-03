import { Pressable, Text, View } from 'react-native';
import { Icon } from '@/components/ui/Icon';
import { useTokens } from '@/components/ui/theme';
import { haptic } from '@/lib/haptics';
import type { TeamRow } from '@/lib/api/teams';
import { formatSkill, type TeamIndicator, type TeamStats } from '@/lib/teams/balance';
import { TeamIndicators } from './TeamField';

/**
 * Auswahl eines Teams als Liste (inklusive „Ohne Team“). Optional mit
 * Kennzahlen und Hinweisen je Team, damit beim Zuordnen sichtbar ist, wo der
 * Spieler am meisten hilft.
 */
export function TeamPicker({
  label,
  teams,
  value,
  onChange,
  stats,
  indicators,
}: {
  label?: string;
  teams: TeamRow[];
  value: string | null;
  onChange: (teamId: string | null) => void;
  stats?: Map<string, TeamStats>;
  indicators?: Map<string, TeamIndicator[]>;
}) {
  const tokens = useTokens();
  const options: { id: string | null; title: string; color?: string | null }[] = [
    { id: null, title: 'Ohne Team' },
    ...teams.map((t) => ({ id: t.id, title: t.number ? `${t.number} · ${t.name}` : t.name, color: t.color })),
  ];
  return (
    <View className="gap-2">
      {label ? <Text className="text-[13px] font-bold text-ink">{label}</Text> : null}
      <View accessibilityRole="radiogroup" className="gap-2">
        {options.map((option) => {
          const selected = option.id === value;
          const s = option.id ? stats?.get(option.id) : undefined;
          const hints = option.id ? indicators?.get(option.id) : undefined;
          return (
            <Pressable
              accessibilityRole="radio"
              accessibilityState={{ selected }}
              className={[
                'gap-2 rounded-2xl border px-4 py-3 active:opacity-80',
                selected ? 'border-primary bg-primary-soft' : 'border-line bg-surface',
              ].join(' ')}
              key={option.id ?? 'none'}
              onPress={() => onChange(option.id)}
              onPressIn={() => haptic('selection')}
            >
              <View className="flex-row items-center gap-2">
                {option.id ? (
                  <View
                    className="h-3 w-3 rounded-full border border-line"
                    style={{ backgroundColor: option.color || tokens.secondary }}
                  />
                ) : null}
                <Text className={['flex-1 text-[14px] font-bold', selected ? 'text-primary' : 'text-ink'].join(' ')}>
                  {option.title}
                </Text>
                {s ? (
                  <Text className="text-[12px] text-subtle">
                    {s.count} Sp. · Ø {formatSkill(s.skillAvg)}
                  </Text>
                ) : null}
                {selected ? <Icon color={tokens.primary} name="check-circle" size={18} /> : null}
              </View>
              {hints && hints.some((h) => h.key !== 'ok') ? <TeamIndicators indicators={hints} /> : null}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
