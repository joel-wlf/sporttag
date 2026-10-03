import { Text, View } from 'react-native';
import { Icon, type IconName } from '@/components/ui/Icon';
import { useTokens } from '@/components/ui/theme';
import type { PackageGame } from '@/lib/station/types';

/** Regeltext, Wertungsart und Hinweise eines Spiels — im Regel-Tab und als Sheet aus dem Match. */
export function GameRules({ game }: { game: PackageGame }) {
  const tokens = useTokens();
  const chips: { icon: IconName; label: string }[] = [
    ...(game.default_duration_seconds
      ? [
          {
            icon: 'clock' as const,
            label: `${Math.round(game.default_duration_seconds / 60)} Min.`,
          },
        ]
      : []),
    {
      icon: 'results',
      label:
        game.measurement_type === 'number'
          ? `${game.unit ?? 'Wert'}, ${game.comparison_direction === 'lower' ? 'niedriger gewinnt' : 'höher gewinnt'}`
          : game.max_teams > 2
            ? 'Platzierung'
            : game.allow_ties
              ? 'Sieg, Unentschieden, Niederlage'
              : 'Sieg oder Niederlage',
    },
    ...(game.materials ? [{ icon: 'package' as const, label: game.materials }] : []),
  ];

  return (
    <>
      <Text accessibilityRole="header" className="text-xl font-extrabold text-ink">
        {game.name}
      </Text>

      <View className="flex-row flex-wrap gap-2">
        {chips.map((chip) => (
          <View
            className="flex-row items-center gap-1.5 rounded-full bg-surface-muted px-3 py-1.5"
            key={chip.label}
          >
            <Icon color={tokens.subtle} name={chip.icon} size={14} />
            <Text className="text-xs font-semibold text-subtle">{chip.label}</Text>
          </View>
        ))}
      </View>

      <Text className="text-base leading-7 text-ink">
        {game.rules || 'Keine Regeltexte hinterlegt.'}
      </Text>
      {game.referee_notes ? (
        <View className="gap-1 rounded-card border border-line bg-surface p-4">
          <Text className="text-xs font-extrabold uppercase tracking-[0.5px] text-subtle">
            Hinweise für die Leitung
          </Text>
          <Text className="text-sm leading-6 text-ink">{game.referee_notes}</Text>
        </View>
      ) : null}
    </>
  );
}
