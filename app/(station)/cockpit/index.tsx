import { useLocalSearchParams, useRouter } from 'expo-router';
import { Pressable, Text, View } from 'react-native';
import { Screen } from '@/components/layout/Screen';
import { ContextBar } from '@/components/station/ContextBar';
import { demoMatches, pendingSyncCount } from '@/components/station/demoData';
import { Icon } from '@/components/ui/Icon';
import { useTokens } from '@/components/ui/theme';
import { haptic } from '@/lib/haptics';

const matchScore = (match: (typeof demoMatches)[number]) => {
  if (match.measurementType !== 'number' || !match.result?.values) return null;
  return match.teams.map((team) => match.result?.values?.[team.id] ?? '–').join(' : ');
};

export default function CockpitMatchesScreen() {
  const router = useRouter();
  const tokens = useTokens();
  const { station, block, game } = useLocalSearchParams<{
    station?: string;
    block?: string;
    game?: string;
  }>();
  const matches = [...demoMatches].sort((a, b) => a.time.localeCompare(b.time));
  const running = matches.find((match) => match.status === 'in_progress');

  return (
    <Screen density="compact">
      <ContextBar
        onBack={() => router.navigate('/assignment')}
        pendingSync={pendingSyncCount}
        subtitle={game}
        title={[block, station].filter(Boolean).join(' · ') || 'Station'}
      />

      {running ? (
        <Pressable
          accessibilityRole="button"
          className="gap-2 rounded-card bg-primary p-4 active:opacity-90"
          onPress={() =>
            router.push({ pathname: '/match/[matchId]', params: { matchId: running.id, station, block, game } })
          }
          onPressIn={() => haptic('heavy')}
        >
          <Text className="text-2xs font-black tracking-[0.6px] text-on-primary/80">
            LÄUFT · {running.time}
          </Text>
          <Text className="text-lg font-extrabold text-on-primary">
            {running.teams.map((t) => t.name).join(' – ')}
          </Text>
          <Text className="text-sm text-on-primary/80">{running.game}</Text>
        </Pressable>
      ) : null}

      <View className="gap-1">
        {matches
          .filter((match) => match.id !== running?.id)
          .map((match) => {
            const score = matchScore(match);
            return (
              <Pressable
                accessibilityRole="button"
                className="flex-row items-center gap-3 rounded-control px-3 py-3 active:bg-surface-muted"
                key={match.id}
                onPress={() =>
                  router.push({
                    pathname: '/match/[matchId]',
                    params: { matchId: match.id, station, block, game },
                  })
                }
                onPressIn={() => haptic('heavy')}
              >
                <View className={['w-11', match.status === 'completed' ? 'opacity-50' : ''].join(' ')}>
                  <Text className="text-sm font-extrabold text-ink">{match.time}</Text>
                  <Text className="text-2xs font-bold text-subtle">{match.round}</Text>
                </View>
                <Text
                  className={[
                    'flex-1 text-sm font-bold',
                    match.status === 'completed' ? 'text-subtle' : 'text-ink',
                  ].join(' ')}
                >
                  {match.teams.map((t) => t.name).join(' – ')}
                </Text>
                {score ? <Text className="text-sm font-extrabold text-subtle">{score}</Text> : null}
                {match.status === 'completed' && match.syncStatus === 'review' ? (
                  <Icon color={tokens.danger} name="alert" size={16} />
                ) : match.status === 'completed' && match.syncStatus === 'pending' ? (
                  <Icon color={tokens.warning} name="clock" size={16} />
                ) : match.status === 'completed' ? (
                  <Icon color={tokens.success} name="check-circle" size={16} />
                ) : (
                  <Icon color={tokens.subtle} name="chevron-right" size={16} />
                )}
              </Pressable>
            );
          })}
      </View>
    </Screen>
  );
}
