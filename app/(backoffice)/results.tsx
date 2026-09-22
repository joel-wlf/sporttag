import { useMemo, useState } from 'react';
import { useLocalSearchParams } from 'expo-router';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { RequireEvent } from '@/components/backoffice/RequireEvent';
import { ResultCorrectionSheet } from '@/components/backoffice/results/ResultCorrectionSheet';
import { ResultDetailSheet } from '@/components/backoffice/results/ResultDetailSheet';
import { ResultFilters, type ResultFilterState } from '@/components/backoffice/results/ResultFilters';
import { ResultList } from '@/components/backoffice/results/ResultList';
import { ResultStats } from '@/components/backoffice/results/ResultStats';
import { StandingsBreakdownSheet } from '@/components/backoffice/results/StandingsBreakdownSheet';
import { StandingsTable } from '@/components/backoffice/results/StandingsTable';
import { Header } from '@/components/layout/Header';
import { Screen } from '@/components/layout/Screen';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { useTokens } from '@/components/ui/theme';
import { useEventGames } from '@/lib/api/games';
import { useCurrentResultValues } from '@/lib/api/live';
import { useResultPoints, useResultRevisions, useResultSubmissions, useResultsRealtime, useStandings } from '@/lib/api/results';
import { useBlocks, useMatches, useMatchParticipants, useRounds, useStationSetups } from '@/lib/api/schedule';
import { useStations } from '@/lib/api/stations';
import { useTeams } from '@/lib/api/teams';
import { buildResultRows, buildTeamBreakdown, filterResultRows } from '@/lib/results/derive';
import { useActiveEvent } from '@/providers/ActiveEventProvider';

type ResultsView = 'results' | 'standings';

const viewChips: { key: ResultsView; label: string }[] = [
  { key: 'results', label: 'Ergebnisse' },
  { key: 'standings', label: 'Tabelle' },
];

function ResultsContent() {
  const tokens = useTokens();
  const { eventId, event } = useActiveEvent();
  const { matchId: matchIdParam } = useLocalSearchParams<{ matchId?: string }>();

  const { data: matches, isLoading } = useMatches(eventId);
  const { data: rounds } = useRounds(eventId);
  const { data: blocks } = useBlocks(eventId);
  const { data: stationSetups } = useStationSetups(eventId);
  const { data: stations } = useStations(eventId);
  const { data: matchParticipants } = useMatchParticipants(eventId);
  const { data: teams } = useTeams(eventId);
  const { data: eventGames } = useEventGames(eventId);
  const { data: currentResultValues } = useCurrentResultValues(eventId);
  const { data: submissions } = useResultSubmissions(eventId);
  const { data: revisions } = useResultRevisions(eventId);
  const { data: standings } = useStandings(eventId);
  const { data: resultPoints } = useResultPoints(eventId);
  useResultsRealtime(eventId);

  const [view, setView] = useState<ResultsView>('results');
  const [filter, setFilter] = useState<ResultFilterState>({ status: 'all', stationId: 'all', teamId: 'all', roundId: 'all' });
  const [selectedMatchId, setSelectedMatchId] = useState<string | null>(matchIdParam ?? null);
  const [correctingMatchId, setCorrectingMatchId] = useState<string | null>(null);
  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null);

  // Deep-Link aus dem Live-Modul: ?matchId=… öffnet direkt das Detail. Während
  // des Renderns statt in einem Effekt angepasst (React-Muster für "State an
  // eine geänderte Prop anpassen"), damit kein zusätzlicher Renderdurchlauf nötig ist.
  const [seenMatchIdParam, setSeenMatchIdParam] = useState(matchIdParam);
  if (matchIdParam !== seenMatchIdParam) {
    setSeenMatchIdParam(matchIdParam);
    if (matchIdParam) {
      setSelectedMatchId(matchIdParam);
      setView('results');
    }
  }

  const rows = useMemo(
    () =>
      buildResultRows({
        matches: matches ?? [],
        rounds: rounds ?? [],
        blocks: blocks ?? [],
        stationSetups: stationSetups ?? [],
        stations: stations ?? [],
        matchParticipants: matchParticipants ?? [],
        teams: teams ?? [],
        games: eventGames ?? [],
        submissions: submissions ?? [],
        currentResultValues: currentResultValues ?? [],
      }),
    [matches, rounds, blocks, stationSetups, stations, matchParticipants, teams, eventGames, submissions, currentResultValues],
  );

  const visibleRows = useMemo(() => filterResultRows(rows, filter), [rows, filter]);
  const selectedRow = rows.find((r) => r.match.id === selectedMatchId) ?? null;
  const correctingRow = rows.find((r) => r.match.id === correctingMatchId) ?? null;
  const selectedTeam = (teams ?? []).find((t) => t.id === selectedTeamId) ?? null;
  const breakdown = useMemo(
    () => (selectedTeamId ? buildTeamBreakdown(selectedTeamId, resultPoints ?? [], rows) : []),
    [selectedTeamId, resultPoints, rows],
  );

  const roundOptions = (rounds ?? [])
    .filter((r) => r.kind === 'play')
    .sort((a, b) => a.position - b.position)
    .map((r) => ({ id: r.id, name: `Runde ${r.position}` }));
  const stationOptions = (stations ?? []).map((s) => ({ id: s.id, name: s.name }));
  const teamOptions = (teams ?? []).map((t) => ({ id: t.id, name: t.name }));

  return (
    <Screen>
      <Header
        description="Match-Ergebnisliste, Abgabejournal, Revisionshistorie und Konfliktklärung — sowie die daraus berechnete Tabelle."
        eyebrow="WERTUNG & KLÄRUNG"
        title="Ergebnisse & Tabelle"
      />

      <View className="flex-row gap-2">
        {viewChips.map((chip) => {
          const active = view === chip.key;
          return (
            <Pressable
              className={['rounded-full border px-4 py-2', active ? 'border-primary bg-primary' : 'border-line bg-surface'].join(' ')}
              key={chip.key}
              onPress={() => setView(chip.key)}
            >
              <Text className={['text-[13px] font-bold', active ? 'text-on-primary' : 'text-ink'].join(' ')}>{chip.label}</Text>
            </Pressable>
          );
        })}
      </View>

      {isLoading ? (
        <ActivityIndicator color={tokens.primary} />
      ) : (matches ?? []).length === 0 ? (
        <Card>
          <EmptyState description="Sobald Runden und Matches geplant sind, erscheinen hier Ergebnisse." icon="results" title="Noch keine Matches" />
        </Card>
      ) : view === 'results' ? (
        <View className="gap-4">
          <ResultStats rows={rows} />
          <ResultFilters onChange={setFilter} rounds={roundOptions} rows={rows} stations={stationOptions} teams={teamOptions} value={filter} />
          {visibleRows.length === 0 ? (
            <Card variant="muted">
              <Text className="text-center text-[13px] text-subtle">Keine Matches in dieser Auswahl.</Text>
            </Card>
          ) : (
            <ResultList onSelect={(row) => setSelectedMatchId(row.match.id)} rows={visibleRows} />
          )}
        </View>
      ) : (
        <StandingsTable final={Boolean(event?.reconciled_at)} onSelectTeam={setSelectedTeamId} rows={standings ?? []} />
      )}

      {eventId ? (
        <>
          <ResultDetailSheet
            eventId={eventId}
            onClose={() => setSelectedMatchId(null)}
            onCorrect={() => {
              setCorrectingMatchId(selectedRow?.match.id ?? null);
              setSelectedMatchId(null);
            }}
            revisions={revisions ?? []}
            row={selectedRow}
            submissions={submissions ?? []}
          />
          <ResultCorrectionSheet eventId={eventId} onClose={() => setCorrectingMatchId(null)} row={correctingRow} />
        </>
      ) : null}
      <StandingsBreakdownSheet entries={breakdown} onClose={() => setSelectedTeamId(null)} teamName={selectedTeam?.name ?? null} />
    </Screen>
  );
}

export default function ResultsScreen() {
  return (
    <RequireEvent>
      <ResultsContent />
    </RequireEvent>
  );
}
