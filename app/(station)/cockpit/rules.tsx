import { useLocalSearchParams } from 'expo-router';
import { Text, View } from 'react-native';
import { Screen } from '@/components/layout/Screen';
import { demoGames, demoMatches, findGame } from '@/components/station/demoData';
import { Icon, type IconName } from '@/components/ui/Icon';
import { useTokens } from '@/components/ui/theme';

export default function CockpitRulesScreen() {
  const tokens = useTokens();
  const { game: gameParam } = useLocalSearchParams<{ game?: string }>();
  const runningGame = demoMatches.find((match) => match.status === 'in_progress')?.game;
  const game = findGame(gameParam) ?? findGame(runningGame) ?? demoGames.Brennball;

  const chips: { icon: IconName; label: string }[] = [
    { icon: 'clock', label: `${Math.round(game.durationSeconds / 60)} Min.` },
    { icon: 'results', label: game.measurement },
    { icon: 'package', label: game.materials },
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

      <Text className="text-base leading-7 text-ink">{game.rules}</Text>
    </Screen>
  );
}
