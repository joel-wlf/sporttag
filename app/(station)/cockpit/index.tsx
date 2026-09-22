import { useLocalSearchParams, useRouter } from 'expo-router';
import { Pressable, Text, View } from 'react-native';
import { Screen } from '@/components/layout/Screen';
import { ContextBar } from '@/components/station/ContextBar';
import { MissingPackage } from '@/components/station/MissingPackage';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { Icon } from '@/components/ui/Icon';
import { useTokens } from '@/components/ui/theme';
import { haptic } from '@/lib/haptics';
import { useMatchLiveActivity } from '@/lib/live/useMatchLiveActivity';
import { formatTime, gameForSetup, matchesForSetup, stationForSetup, teamName } from '@/lib/station/package';
import { useStationSession } from '@/providers/StationSessionProvider';

export default function CockpitMatchesScreen() {
  const router = useRouter();
  const tokens = useTokens();
  const params = useLocalSearchParams<{
    setupId?: string;
    station?: string;
    block?: string;
    game?: string;
  }>();
  const { pkg, syncCounts, activeCheckin } = useStationSession();
  // Beim Tab-Wechsel gehen die Parameter verloren: dann gilt der aktive Check-in.
  const setupId = params.setupId ?? activeCheckin?.stationSetupId;
  const fallbackSetup = setupId ? pkg?.station_setups.find((s) => s.id === setupId) : undefined;
  const station = params.station ?? (fallbackSetup && pkg ? stationForSetup(pkg, fallbackSetup)?.name : undefined);
  const block = params.block ?? pkg?.blocks.find((b) => b.id === fallbackSetup?.block_id)?.name;
  const game = params.game ?? (fallbackSetup && pkg ? gameForSetup(pkg, fallbackSetup)?.name : undefined);

  if (!pkg) {
    return (
      <Screen density="compact">
        <MissingPackage />
      </Screen>
    );
  }

  if (!setupId) {
    return (
      <Screen density="compact">
        <EmptyState
          action={<Button label="Zum Tagesplan" onPress={() => router.navigate('/assignment')} />}
          description="Keine Station ausgewählt."
          icon="package"
          title="Keine Station"
        />
      </Screen>
    );
  }

  const timezone = pkg.event.timezone;
  const setup = pkg.station_setups.find((s) => s.id === setupId);
  const gameRow = setup ? gameForSetup(pkg, setup) : undefined;
  const matches = matchesForSetup(pkg, setupId).map((m) => ({
    match: m,
    round: pkg.rounds.find((r) => r.id === m.round_id),
  }));
  const now = new Date();
  const running = matches.find(
    ({ match, round }) => match.status === 'in_progress' || (round && new Date(round.starts_at) <= now && now < new Date(round.ends_at)),
  );

  const matchScore = (matchId: string) => {
    if (!gameRow || gameRow.measurement_type !== 'number') return null;
    const match = pkg.matches.find((m) => m.id === matchId);
    if (!match) return null;
    const values = pkg.current_result_values.filter((v) => v.match_id === matchId && v.version === match.current_result_version);
    if (values.length === 0) return null;
    return match.participants.map((p) => values.find((v) => v.participant_id === p.id)?.measured_value ?? '–').join(' : ');
  };

  useMatchLiveActivity(
    running
      ? {
          matchId: running.match.id,
          gameName: gameRow?.name ?? game ?? '',
          teamsLabel: running.match.participants.map((p) => teamName(pkg, p.team_id)).join(' – '),
          scoreLabel: matchScore(running.match.id),
          roundEndsAt: running.round?.ends_at ?? null,
        }
      : null,
  );

  const syncBadge = (matchId: string) => {
    const match = pkg.matches.find((m) => m.id === matchId);
    if (!match || match.status !== 'completed') return null;
    const value = pkg.current_result_values.find((v) => v.match_id === matchId && v.version === match.current_result_version);
    if (!value) return <Icon color={tokens.warning} name="clock" size={16} />;
    return <Icon color={tokens.success} name="check-circle" size={16} />;
  };

  return (
    <Screen density="compact">
      <ContextBar
        onBack={() => router.navigate('/assignment')}
        pendingSync={syncCounts.pending + syncCounts.sending}
        subtitle={game}
        title={[block, station].filter(Boolean).join(' · ') || 'Station'}
      />

      {matches.length === 0 ? (
        <EmptyState description="Für diese Belegung sind noch keine Matches geplant." icon="results" title="Keine Matches" />
      ) : (
        <>
          {running ? (
            <Pressable
              accessibilityRole="button"
              className="gap-2 rounded-card bg-primary p-4 active:opacity-90"
              onPress={() =>
                router.push({ pathname: '/match/[matchId]', params: { matchId: running.match.id, setupId, station, block, game } })
              }
              onPressIn={() => haptic('heavy')}
            >
              <Text className="text-2xs font-black tracking-[0.6px] text-on-primary/80">
                LÄUFT · {running.round ? formatTime(running.round.starts_at, timezone) : ''}
              </Text>
              <Text className="text-lg font-extrabold text-on-primary">
                {running.match.participants.map((p) => teamName(pkg, p.team_id)).join(' – ')}
              </Text>
              <Text className="text-sm text-on-primary/80">{gameRow?.name}</Text>
            </Pressable>
          ) : null}

          <View className="gap-1">
            {matches
              .filter(({ match }) => match.id !== running?.match.id)
              .map(({ match, round }) => {
                const score = matchScore(match.id);
                return (
                  <Pressable
                    accessibilityRole="button"
                    className="flex-row items-center gap-3 rounded-control px-3 py-3 active:bg-surface-muted"
                    key={match.id}
                    onPress={() =>
                      router.push({
                        pathname: '/match/[matchId]',
                        params: { matchId: match.id, setupId, station, block, game },
                      })
                    }
                    onPressIn={() => haptic('heavy')}
                  >
                    <View className={['w-11', match.status === 'completed' ? 'opacity-50' : ''].join(' ')}>
                      <Text className="text-sm font-extrabold text-ink">{round ? formatTime(round.starts_at, timezone) : '–'}</Text>
                      <Text className="text-2xs font-bold text-subtle">{round?.label}</Text>
                    </View>
                    <Text
                      className={[
                        'flex-1 text-sm font-bold',
                        match.status === 'completed' ? 'text-subtle' : 'text-ink',
                      ].join(' ')}
                    >
                      {match.participants.map((p) => teamName(pkg, p.team_id)).join(' – ')}
                    </Text>
                    {score ? <Text className="text-sm font-extrabold text-subtle">{score}</Text> : null}
                    {syncBadge(match.id)}
                  </Pressable>
                );
              })}
          </View>
        </>
      )}
    </Screen>
  );
}
