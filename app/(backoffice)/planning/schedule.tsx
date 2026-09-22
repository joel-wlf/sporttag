import { router } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Text, View } from 'react-native';
import { RequireEvent } from '@/components/backoffice/RequireEvent';
import { StationFormModal } from '@/components/backoffice/planning/StationFormModal';
import { CellTeamPicker } from '@/components/backoffice/schedule/CellTeamPicker';
import { CoveragePanel } from '@/components/backoffice/schedule/CoveragePanel';
import { ScheduleMatrix } from '@/components/backoffice/schedule/ScheduleMatrix';
import { GamePickerSheet, RowSheet } from '@/components/backoffice/schedule/ScheduleSheets';
import { Header } from '@/components/layout/Header';
import { Screen } from '@/components/layout/Screen';
import { Section } from '@/components/layout/Section';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { DateTimeField } from '@/components/ui/DateTimeField';
import { EmptyState } from '@/components/ui/EmptyState';
import { Field } from '@/components/ui/Input';
import { friendlyErrorMessage } from '@/lib/api/errors';
import { useEventGames } from '@/lib/api/games';
import {
  type ScheduleSettings,
  useApplyLayout,
  useBlocks,
  useMatchParticipants,
  useMatches,
  useRounds,
  useSetBlockGame,
  useSetCells,
  useStationSetups,
} from '@/lib/api/schedule';
import { type StationRow, useStations } from '@/lib/api/stations';
import { useTeams } from '@/lib/api/teams';
import {
  autoFill,
  buildMatrix,
  cellKey,
  coverage,
  layoutFromMatrix,
  type LayoutRow,
  type MatrixGame,
  type ProposedCell,
  scheduleWarnings,
  setupKey,
  teamOptionsForCell,
} from '@/lib/schedule/matrix';
import { useActiveEvent } from '@/providers/ActiveEventProvider';

function timeToDate(value: string): Date {
  const [h, m] = value.split(':').map(Number);
  const date = new Date();
  date.setHours(h ?? 9, m ?? 0, 0, 0);
  return date;
}

function MinutesField({ label, value, onCommit, disabled }: { label: string; value: number; onCommit: (v: number) => void; disabled: boolean }) {
  const [text, setText] = useState(String(value));
  const commit = () => {
    const n = Number(text);
    if (Number.isInteger(n) && n >= 0 && n <= 600 && n !== value) onCommit(n);
    else setText(String(value));
  };
  return (
    <View className="min-w-[140px] flex-1">
      <Field
        editable={!disabled}
        keyboardType="number-pad"
        label={label}
        onBlur={commit}
        onChangeText={setText}
        onSubmitEditing={commit}
        value={text}
      />
    </View>
  );
}

function ScheduleContent() {
  const { eventId, event } = useActiveEvent();
  const id = eventId as string;
  const { data: blocks = [] } = useBlocks(eventId);
  const { data: rounds = [] } = useRounds(eventId);
  const { data: stationRows = [] } = useStations(eventId);
  const { data: setups = [] } = useStationSetups(eventId);
  const { data: gameRows = [] } = useEventGames(eventId);
  const { data: matches = [] } = useMatches(eventId);
  const { data: participants = [] } = useMatchParticipants(eventId);
  const { data: teams = [] } = useTeams(eventId);

  const applyLayout = useApplyLayout(id);
  const setBlockGame = useSetBlockGame(id);
  const setCells = useSetCells(id);

  const timeZone = event?.timezone ?? 'Europe/Berlin';

  const [error, setError] = useState<string | null>(null);
  const [rowSheet, setRowSheet] = useState<string | null>(null);
  const [cellSheet, setCellSheet] = useState<{ roundId: string; stationId: string } | null>(null);
  const [gameSheet, setGameSheet] = useState<{ blockId: string; stationId: string } | null>(null);
  const [editStation, setEditStation] = useState<StationRow | null>(null);
  const [proposal, setProposal] = useState<ProposedCell[] | null>(null);
  const [showCoverage, setShowCoverage] = useState(true);
  const [sheetError, setSheetError] = useState<string | null>(null);

  const stations = useMemo(
    () => [...stationRows].sort((a, b) => a.created_at.localeCompare(b.created_at)),
    [stationRows],
  );
  const matrix = useMemo(
    () => buildMatrix({ blocks, rounds, setups, matches, participants, stations }),
    [blocks, rounds, setups, matches, participants, stations],
  );
  const games = useMemo(() => new Map<string, MatrixGame>(gameRows.map((g) => [g.id, g])), [gameRows]);
  const gameNames = useMemo(() => new Map(gameRows.map((g) => [g.id, g.name])), [gameRows]);
  const stationNames = useMemo(() => new Map(stations.map((s) => [s.id, s.name])), [stations]);
  const teamMap = useMemo(() => new Map(teams.map((t) => [t.id, t])), [teams]);
  const teamCoverage = useMemo(() => coverage(matrix, teams, gameRows.map((g) => g.id)), [matrix, teams, gameRows]);
  const warnings = useMemo(() => scheduleWarnings(matrix, teams, gameNames), [matrix, teams, gameNames]);

  const cellFlags = useMemo(() => {
    const counts = new Map<string, number>();
    for (const c of matrix.cells.values()) {
      if (!c.gameId) continue;
      for (const t of c.teamIds) counts.set(`${t}:${c.gameId}`, (counts.get(`${t}:${c.gameId}`) ?? 0) + 1);
    }
    const flags = new Map<string, Set<string>>();
    for (const c of matrix.cells.values()) {
      const repeated = c.teamIds.filter((t) => (counts.get(`${t}:${c.gameId}`) ?? 0) > 1);
      if (repeated.length > 0) flags.set(cellKey(c.roundId, c.stationId), new Set(repeated));
    }
    return flags;
  }, [matrix]);

  const run = async (action: () => Promise<unknown>, onError = setError) => {
    onError(null);
    try {
      await action();
      return true;
    } catch (err) {
      onError(friendlyErrorMessage(err));
      return false;
    }
  };

  const apply = (rows: LayoutRow[], settings?: Partial<ScheduleSettings>) =>
    run(() => applyLayout.mutateAsync({ rows, settings }));

  const appendRow = (kind: 'play' | 'break') => apply([...layoutFromMatrix(matrix), { kind }]);

  const insertRow = async (roundId: string, where: 'above' | 'below', kind: 'play' | 'break') => {
    const rows = layoutFromMatrix(matrix);
    const index = rows.findIndex((r) => r.round_id === roundId);
    rows.splice(where === 'above' ? index : index + 1, 0, { kind });
    if (await run(() => applyLayout.mutateAsync({ rows }), setSheetError)) setRowSheet(null);
  };

  const deleteRow = async (roundId: string) => {
    const rows = layoutFromMatrix(matrix).filter((r) => r.round_id !== roundId);
    if (await run(() => applyLayout.mutateAsync({ rows }), setSheetError)) setRowSheet(null);
  };

  const setDuration = async (roundId: string, minutes: number | null) => {
    const rows = layoutFromMatrix(matrix).map((r) => (r.round_id === roundId ? { ...r, duration_minutes: minutes } : r));
    if (await run(() => applyLayout.mutateAsync({ rows }), setSheetError)) setRowSheet(null);
  };

  const saveSettings = (settings: Partial<ScheduleSettings>) => apply(layoutFromMatrix(matrix), settings);

  const activeRound = rowSheet ? rounds.find((r) => r.id === rowSheet) : undefined;
  const activeRow = rowSheet ? matrix.rows.find((r) => r.kind !== 'block' && r.round.id === rowSheet) : undefined;
  const activeCell = cellSheet ? matrix.cells.get(cellKey(cellSheet.roundId, cellSheet.stationId)) : undefined;
  const activeCellGame = activeCell?.gameId ? games.get(activeCell.gameId) : undefined;
  const activeCellRow = cellSheet ? matrix.playRounds.find((r) => r.round.id === cellSheet.roundId) : undefined;

  const optionsFor = useCallback(
    (selection: string[]) => (activeCell ? teamOptionsForCell(matrix, activeCell, teams, selection, gameNames, stationNames) : []),
    [activeCell, matrix, teams, gameNames, stationNames],
  );

  const gameSheetUsedElsewhere = useMemo(() => {
    const used = new Set<string>();
    if (!gameSheet) return used;
    for (const s of setups) if (s.station_id === gameSheet.stationId && s.block_id !== gameSheet.blockId) used.add(s.event_game_id);
    return used;
  }, [gameSheet, setups]);

  const hasPlayRounds = matrix.playRounds.length > 0;
  const emptyCells = [...matrix.cells.values()].filter((c) => c.gameId && c.teamIds.length === 0).length;

  return (
    <Screen>
      <Header
        actions={
          <>
            <Button label="Runde" leftIcon="plus" onPress={() => appendRow('play')} variant="outline" />
            <Button isDisabled={!hasPlayRounds} label="Pause" leftIcon="pause" onPress={() => appendRow('break')} variant="outline" />
            <Button
              isDisabled={emptyCells === 0 || teams.length < 2}
              label="Auto-Einteilung"
              leftIcon="refresh"
              onPress={() => setProposal(autoFill(matrix, teams, games))}
            />
          </>
        }
        description="Zeilen sind Runden, Spalten sind Stationen. Pausen trennen die Blöcke, in denen jede Station ihr Spiel hat."
        eyebrow="PLANUNG"
        title="Zeitplan & Matches"
      />

      {error ? (
        <Text accessibilityRole="alert" className="text-[13px] font-semibold text-danger">
          {error}
        </Text>
      ) : null}

      {event ? (
        <Card>
          <View className="flex-row flex-wrap gap-3">
            <View className="min-w-[160px] flex-1">
              <DateTimeField
                label="Beginn"
                mode="time"
                onChange={(d) =>
                  saveSettings({
                    schedule_start_time: `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`,
                  })
                }
                value={timeToDate(event.schedule_start_time)}
              />
            </View>
            <MinutesField disabled={false} key={`r-${event.round_minutes}`} label="Rundendauer (min)" onCommit={(v) => saveSettings({ round_minutes: v })} value={event.round_minutes} />
            <MinutesField disabled={false} key={`c-${event.changeover_minutes}`} label="Wechselzeit (min)" onCommit={(v) => saveSettings({ changeover_minutes: v })} value={event.changeover_minutes} />
            <MinutesField disabled={false} key={`b-${event.break_minutes}`} label="Pausendauer (min)" onCommit={(v) => saveSettings({ break_minutes: v })} value={event.break_minutes} />
          </View>
        </Card>
      ) : null}

      {!hasPlayRounds && matrix.rows.length === 0 ? (
        <Card>
          <EmptyState
            action={<Button label="Erste Runde hinzufügen" leftIcon="plus" onPress={() => appendRow('play')} />}
            description={
              gameRows.length === 0
                ? 'Lege zuerst unter „Spiele & Wertung“ die Spiele an. Danach fügst du hier Runden hinzu und trägst die Teams ein.'
                : 'Füge Runden hinzu. Mit einer Pause beginnt ein neuer Block, in dem jede Station ein anderes Spiel haben kann.'
            }
            icon="clock"
            title="Noch keine Runden"
          />
          {gameRows.length === 0 ? (
            <View className="items-center pt-2">
              <Button label="Zu Spiele & Wertung" onPress={() => router.push('/planning/games' as never)} variant="ghost" />
            </View>
          ) : null}
        </Card>
      ) : (
        <Card className="p-0">
          <ScheduleMatrix
            cellFlags={cellFlags}
            games={games}
            matrix={matrix}
            onAddStation={() => router.push('/planning/venue' as never)}
            onPressCell={(roundId, stationId) => {
              setSheetError(null);
              setCellSheet({ roundId, stationId });
            }}
            onPressGame={(blockId, stationId) => {
              setSheetError(null);
              setGameSheet({ blockId, stationId });
            }}
            onPressRow={(roundId) => {
              setSheetError(null);
              setRowSheet(roundId);
            }}
            onPressStation={(stationId) => setEditStation(stations.find((s) => s.id === stationId) ?? null)}
            teams={teamMap}
            timeZone={timeZone}
          />
          {stations.length === 0 ? (
            <Text className="px-4 pb-4 text-[13px] text-subtle">
              Lege unter „Gelände & Stationen“ die erste Station an, dann erscheint sie hier als Spalte.
            </Text>
          ) : null}
        </Card>
      )}

      {hasPlayRounds && teams.length > 0 ? (
        <Section
          action={<Button label={showCoverage ? 'Ausblenden' : 'Anzeigen'} onPress={() => setShowCoverage(!showCoverage)} size="sm" variant="ghost" />}
          description="Welche Spiele jedes Team schon hat und wo noch Lücken sind."
          title="Abdeckung"
        >
          {showCoverage ? (
            <Card>
              <CoveragePanel coverage={teamCoverage} gameNames={gameNames} teams={teams} warnings={warnings} />
            </Card>
          ) : null}
        </Section>
      ) : null}

      {activeRow && activeRound && event ? (
        <RowSheet
          defaultMinutes={activeRow.kind === 'break' ? event.break_minutes : event.round_minutes}
          durationMinutes={activeRound.duration_minutes}
          error={sheetError}
          hasMatches={[...matrix.cells.values()].some((c) => c.roundId === activeRound.id && c.teamIds.length > 0)}
          isBusy={applyLayout.isPending}
          key={activeRound.id}
          kind={activeRow.kind === 'break' ? 'break' : 'play'}
          onClose={() => setRowSheet(null)}
          onDelete={() => deleteRow(activeRound.id)}
          onInsert={(where, kind) => insertRow(activeRound.id, where, kind)}
          onSaveDuration={(minutes) => setDuration(activeRound.id, minutes)}
          title={activeRow.kind === 'play' ? `Runde ${activeRow.roundNumber}` : 'Pause'}
          visible
        />
      ) : null}

      {cellSheet && activeCell && activeCellGame ? (
        <CellTeamPicker
          error={sheetError}
          initialSelection={activeCell.teamIds}
          isSaving={setCells.isPending}
          key={cellKey(cellSheet.roundId, cellSheet.stationId)}
          maxTeams={activeCellGame.max_teams}
          onClose={() => setCellSheet(null)}
          onSave={async (teamIds) => {
            const ok = await run(
              () => setCells.mutateAsync([{ roundId: cellSheet.roundId, stationId: cellSheet.stationId, teamIds }]),
              setSheetError,
            );
            if (ok) setCellSheet(null);
          }}
          optionsFor={optionsFor}
          title={`Runde ${activeCellRow?.roundNumber ?? ''} · ${stationNames.get(cellSheet.stationId) ?? ''} · ${activeCellGame.name}`}
          visible
        />
      ) : null}

      {gameSheet ? (
        <GamePickerSheet
          currentGameId={matrix.games.get(setupKey(gameSheet.blockId, gameSheet.stationId)) ?? null}
          error={sheetError}
          games={gameRows}
          onClose={() => setGameSheet(null)}
          onSelect={async (gameId) => {
            const ok = await run(
              () => setBlockGame.mutateAsync({ blockId: gameSheet.blockId, stationId: gameSheet.stationId, gameId }),
              setSheetError,
            );
            if (ok) setGameSheet(null);
          }}
          title={`Spiel an ${stationNames.get(gameSheet.stationId) ?? 'Station'}`}
          usedElsewhere={gameSheetUsedElsewhere}
          visible
        />
      ) : null}

      {editStation ? (
        <StationFormModal eventId={id} key={editStation.id} onClose={() => setEditStation(null)} station={editStation} />
      ) : null}

      <ConfirmDialog
        confirmLabel="Übernehmen"
        confirmVariant="primary"
        description={
          proposal && proposal.length > 0
            ? `${proposal.length} leere Zellen werden gefüllt. Bestehende Einträge bleiben unverändert. Jedes Team spielt pro Runde nur einmal; bevorzugt werden Spiele und Gegner, die das Team noch nicht hatte.`
            : 'Für die leeren Zellen ließ sich keine passende Einteilung finden.'
        }
        isLoading={setCells.isPending}
        onCancel={() => setProposal(null)}
        onConfirm={async () => {
          if (!proposal || proposal.length === 0) return setProposal(null);
          if (await run(() => setCells.mutateAsync(proposal))) setProposal(null);
        }}
        title="Auto-Einteilung"
        visible={proposal !== null}
      />
    </Screen>
  );
}

export default function ScheduleScreen() {
  return (
    <RequireEvent>
      <ScheduleContent />
    </RequireEvent>
  );
}
