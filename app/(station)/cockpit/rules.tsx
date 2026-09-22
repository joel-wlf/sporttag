import { useLocalSearchParams } from 'expo-router';
import { Text, View } from 'react-native';
import { Screen } from '@/components/layout/Screen';
import { MissingPackage } from '@/components/station/MissingPackage';
import { EmptyState } from '@/components/ui/EmptyState';
import { Icon, type IconName } from '@/components/ui/Icon';
import { useTokens } from '@/components/ui/theme';
import { useStationSession } from '@/providers/StationSessionProvider';

export default function CockpitRulesScreen() {
  const tokens = useTokens();
  const { gameId } = useLocalSearchParams<{ gameId?: string }>();
  const { pkg } = useStationSession();

  const game = pkg?.event_games.find((g) => g.id === gameId) ?? pkg?.event_games[0];

  if (!pkg) {
    return (
      <Screen density="compact" size="narrow">
        <MissingPackage title="Keine Regeln" />
      </Screen>
    );
  }

  if (!game) {
    return (
      <Screen density="compact" size="narrow">
        <EmptyState description="Für diese Veranstaltung sind keine Spiele hinterlegt." icon="package" title="Keine Regeln" />
      </Screen>
    );
  }

  const chips: { icon: IconName; label: string }[] = [
    ...(game.default_duration_seconds
      ? [{ icon: 'clock' as const, label: `${Math.round(game.default_duration_seconds / 60)} Min.` }]
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
    <Screen density="compact" size="narrow">
      <Text className="text-xl font-extrabold text-ink">{game.name}</Text>

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

      <Text className="text-base leading-7 text-ink">{game.rules || 'Keine Regeltexte hinterlegt.'}</Text>
      {game.referee_notes ? (
        <View className="gap-1 rounded-card border border-line bg-surface p-4">
          <Text className="text-xs font-extrabold uppercase tracking-[0.5px] text-subtle">Hinweise für die Leitung</Text>
          <Text className="text-sm leading-6 text-ink">{game.referee_notes}</Text>
        </View>
      ) : null}
    </Screen>
  );
}
