import { ActivityIndicator, View } from 'react-native';
import { RequireEvent } from '@/components/backoffice/RequireEvent';
import { Header } from '@/components/layout/Header';
import { Screen } from '@/components/layout/Screen';
import { Section } from '@/components/layout/Section';
import { Badge } from '@/components/ui/Badge';
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { Icon } from '@/components/ui/Icon';
import { StatCard } from '@/components/ui/StatCard';
import { useTokens } from '@/components/ui/theme';
import { useEventReadiness } from '@/lib/api/events';
import { useEventGames } from '@/lib/api/games';
import { useMatches, useRounds } from '@/lib/api/schedule';
import { useStations } from '@/lib/api/stations';
import { useTeams } from '@/lib/api/teams';
import { useActiveEvent } from '@/providers/ActiveEventProvider';

function OverviewContent() {
  const { eventId, event } = useActiveEvent();
  const tokens = useTokens();
  const { data: teams } = useTeams(eventId);
  const { data: stations } = useStations(eventId);
  const { data: games } = useEventGames(eventId);
  const { data: rounds } = useRounds(eventId);
  const { data: matches } = useMatches(eventId);
  const { data: readiness, isLoading: readinessLoading } = useEventReadiness(eventId);

  const errors = readiness?.filter((issue) => issue.severity === 'error') ?? [];
  const warnings = readiness?.filter((issue) => issue.severity === 'warning') ?? [];

  return (
    <Screen>
      <Header
        description="Kompaktes Statusbild einer Veranstaltung mit den nächsten sinnvollen Aktionen."
        eyebrow="VERANSTALTUNG"
        title={event?.name ?? 'Übersicht'}
      />
      <Section title="Kennzahlen">
        <View className="flex-row flex-wrap gap-4">
          <StatCard icon="user" label="Teams" value={String(teams?.length ?? 0)} />
          <StatCard icon="map-pin" label="Stationen" value={String(stations?.length ?? 0)} />
          <StatCard icon="results" label="Spiele" value={String(games?.length ?? 0)} />
          <StatCard icon="clock" label="Runden" value={String(rounds?.length ?? 0)} />
          <StatCard icon="devices" label="Matches" value={String(matches?.length ?? 0)} />
          <StatCard icon="planning" label="Planversion" value={String(event?.plan_version ?? '–')} />
        </View>
      </Section>
      <View className="flex-row flex-wrap gap-4">
        <Card className="min-w-0 flex-1 basis-[320px]">
          <CardHeader>
            <CardTitle>Bereitschaft</CardTitle>
            <CardDescription>Planungsvollständigkeit und Veröffentlichungsblocker.</CardDescription>
          </CardHeader>
          {readinessLoading ? (
            <ActivityIndicator color={tokens.primary} />
          ) : errors.length === 0 && warnings.length === 0 ? (
            <View className="flex-row items-center gap-2">
              <Icon color={tokens.success} name="check-circle" size={16} />
              <Badge tone="success">Bereit zur Veröffentlichung</Badge>
            </View>
          ) : (
            <View className="gap-3">
              {[...errors, ...warnings].map((issue) => (
                <View className="flex-row items-center justify-between gap-3" key={issue.code}>
                  <Badge tone="neutral">{issue.message}</Badge>
                  <Badge tone={issue.severity === 'error' ? 'danger' : 'warning'}>
                    {issue.severity === 'error' ? 'Blockiert' : 'Hinweis'}
                  </Badge>
                </View>
              ))}
            </View>
          )}
        </Card>
      </View>
    </Screen>
  );
}

export default function EventOverviewScreen() {
  return (
    <RequireEvent>
      <OverviewContent />
    </RequireEvent>
  );
}
