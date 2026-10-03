import { useMemo, useState } from 'react';
import { Platform, Text, View } from 'react-native';
import { PlanVersionNotice } from '@/components/backoffice/PlanVersionNotice';
import { RequireEvent } from '@/components/backoffice/RequireEvent';
import { QuickTeamsModal } from '@/components/backoffice/planning/QuickTeamsModal';
import { TeamFormModal } from '@/components/backoffice/planning/TeamFormModal';
import { AssignPlayerSheet } from '@/components/backoffice/teams/AssignPlayerSheet';
import { AutoAssignSheet } from '@/components/backoffice/teams/AutoAssignSheet';
import { DragProvider } from '@/components/backoffice/teams/drag';
import { ImportPlayersSheet } from '@/components/backoffice/teams/ImportPlayersSheet';
import { PlayerFormModal } from '@/components/backoffice/teams/PlayerFormModal';
import { POOL_ZONE, PlayerSidebar } from '@/components/backoffice/teams/PlayerSidebar';
import { TeamField } from '@/components/backoffice/teams/TeamField';
import { Header } from '@/components/layout/Header';
import { Screen } from '@/components/layout/Screen';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { Icon } from '@/components/ui/Icon';
import { PillChoice } from '@/components/ui/PillChoice';
import { useTokens } from '@/components/ui/theme';
import { useDesktop } from '@/components/ui/useDesktop';
import { confirmAsync } from '@/lib/confirm';
import { friendlyErrorMessage } from '@/lib/api/errors';
import { type Player, toBalancePlayer, useMovePlayer, usePlayers, useSetPlayerTeams } from '@/lib/api/players';
import { type TeamRow, useTeams } from '@/lib/api/teams';
import { teamIndicators, teamStats } from '@/lib/teams/balance';
import { useActiveEvent } from '@/providers/ActiveEventProvider';

type MobileTab = 'teams' | 'players';

function TeamsContent() {
  const tokens = useTokens();
  const { eventId } = useActiveEvent();
  const { data: teams = [] } = useTeams(eventId);
  const { data: players = [] } = usePlayers(eventId);
  const move = useMovePlayer(eventId ?? '');
  const setTeams = useSetPlayerTeams(eventId ?? '');
  const desktop = useDesktop();

  const [editingTeam, setEditingTeam] = useState<TeamRow | 'new' | null>(null);
  const [quickOpen, setQuickOpen] = useState(false);
  const [editingPlayer, setEditingPlayer] = useState<Player | 'new' | null>(null);
  const [newPlayerKey, setNewPlayerKey] = useState(0);
  const [newPlayerTeam, setNewPlayerTeam] = useState<string | null>(null);
  const [assigningId, setAssigningId] = useState<string | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [autoOpen, setAutoOpen] = useState(false);
  const [mobileTab, setMobileTab] = useState<MobileTab>('teams');
  const [boardError, setBoardError] = useState<string | null>(null);

  const teamIds = useMemo(() => teams.map((t) => t.id), [teams]);
  const stats = useMemo(() => teamStats(players.map(toBalancePlayer), teamIds), [players, teamIds]);
  const indicators = useMemo(() => teamIndicators(stats), [stats]);
  const playersByTeam = useMemo(() => {
    const map = new Map<string, Player[]>();
    for (const p of players) {
      if (!p.team_id) continue;
      map.set(p.team_id, [...(map.get(p.team_id) ?? []), p]);
    }
    return map;
  }, [players]);
  const existingNames = useMemo(() => players.map((p) => p.name), [players]);
  const assigning = assigningId ? (players.find((p) => p.id === assigningId) ?? null) : null;
  const assignedCount = players.filter((p) => p.team_id).length;

  const teamName = (teamId: string | null) => {
    const team = teams.find((t) => t.id === teamId);
    return team ? (team.number ? `${team.number} · ${team.name}` : team.name) : null;
  };

  const movePlayer = (playerId: string, teamId: string | null) => {
    const player = players.find((p) => p.id === playerId);
    if (!player || player.team_id === teamId) return;
    setBoardError(null);
    move.mutate(
      { playerId, teamId },
      { onError: (err) => setBoardError(friendlyErrorMessage(err)) },
    );
  };

  const handleDrop = (playerId: string, zoneId: string) => {
    movePlayer(playerId, zoneId === POOL_ZONE ? null : zoneId);
  };

  const openNewPlayer = (teamId: string | null = null) => {
    setNewPlayerTeam(teamId);
    setNewPlayerKey((k) => k + 1);
    setEditingPlayer('new');
  };

  const handleClearAssignments = async () => {
    const movable = players.filter((p) => p.team_id && !p.locked);
    if (movable.length === 0) return;
    if (
      !(await confirmAsync(
        `${movable.length} Spieler kommen zurück in die Liste „Ohne Team“. Fixierte Spieler bleiben.`,
        'Zuordnung leeren?',
        'Leeren',
      ))
    ) {
      return;
    }
    setBoardError(null);
    try {
      await setTeams.mutateAsync(movable.map((p) => ({ playerId: p.id, teamId: null })));
    } catch (err) {
      setBoardError(friendlyErrorMessage(err));
    }
  };

  const sidebar = (
    <PlayerSidebar
      dragHint={desktop}
      onAdd={() => openNewPlayer()}
      onImport={() => setImportOpen(true)}
      onPlayerPress={(p) => setAssigningId(p.id)}
      players={players}
      teamName={teamName}
    />
  );

  const fields =
    teams.length === 0 ? (
      <Card className="flex-1">
        <EmptyState
          action={
            <View className="flex-row flex-wrap justify-center gap-3">
              <Button label="Mehrere Teams anlegen" onPress={() => setQuickOpen(true)} />
              <Button label="Einzelnes Team" onPress={() => setEditingTeam('new')} variant="outline" />
            </View>
          }
          description="Lege zuerst die Teams an. Danach verteilst du die Spieler per Ziehen, Antippen oder automatisch."
          icon="users"
          title="Noch keine Teams"
        />
      </Card>
    ) : (
      <View className="flex-row flex-wrap gap-4">
        {teams.map((team) => (
          <View className="min-w-[260px] flex-1" key={team.id} style={{ flexBasis: 280 }}>
            <TeamField
              emptyHint={desktop ? 'Spieler hierher ziehen' : 'Noch keine Spieler'}
              indicators={indicators.get(team.id) ?? []}
              onEditTeam={() => setEditingTeam(team)}
              onPlayerPress={(p) => setAssigningId(p.id)}
              players={playersByTeam.get(team.id) ?? []}
              stats={stats.get(team.id)!}
              team={team}
            />
          </View>
        ))}
      </View>
    );

  return (
    <Screen>
      <Header
        actions={
          <>
            <Button
              isDisabled={teams.length === 0 || players.length === 0}
              label="Automatisch verteilen"
              leftIcon="refresh"
              onPress={() => setAutoOpen(true)}
            />
            <Button label="Schnellanlage" onPress={() => setQuickOpen(true)} variant="outline" />
            <Button label="Neues Team" leftIcon="plus" onPress={() => setEditingTeam('new')} variant="outline" />
            {assignedCount > 0 ? (
              <Button label="Zuordnung leeren" onPress={handleClearAssignments} variant="ghost" />
            ) : null}
          </>
        }
        description="Teams als Felder, Spieler in der Liste. Ziehen, antippen oder automatisch ausgleichen."
        eyebrow="PLANUNG"
        title="Teams"
      />
      <PlanVersionNotice />

      {boardError ? (
        <View className="flex-row items-center gap-2 rounded-2xl bg-danger-soft px-4 py-3">
          <Icon color={tokens.danger} name="alert" size={16} />
          <Text className="flex-1 text-[13px] font-semibold text-danger">{boardError}</Text>
        </View>
      ) : null}

      {desktop ? (
        <DragProvider enabled onDrop={handleDrop}>
          <View className="flex-row items-start gap-5">
            <View className="w-[320px]">{sidebar}</View>
            <View className="flex-1">{fields}</View>
          </View>
        </DragProvider>
      ) : (
        <View className="gap-4">
          <PillChoice
            accessibilityLabel="Ansicht"
            onChange={setMobileTab}
            options={[
              { value: 'teams', label: `Teams (${teams.length})` },
              { value: 'players', label: `Spieler (${players.length})` },
            ]}
            value={mobileTab}
          />
          {mobileTab === 'teams' ? fields : sidebar}
        </View>
      )}

      {eventId ? (
        <>
          <TeamFormModal
            eventId={eventId}
            key={editingTeam === 'new' ? 'new' : (editingTeam?.id ?? 'closed')}
            onClose={() => setEditingTeam(null)}
            team={editingTeam}
          />
          <QuickTeamsModal eventId={eventId} onClose={() => setQuickOpen(false)} visible={quickOpen} />
          <PlayerFormModal
            defaultTeamId={newPlayerTeam}
            eventId={eventId}
            key={editingPlayer === 'new' ? `new-${newPlayerKey}` : (editingPlayer?.id ?? 'closed')}
            onClose={() => setEditingPlayer(null)}
            onSavedAndNext={() => openNewPlayer(newPlayerTeam)}
            player={editingPlayer}
            teams={teams}
          />
          <AssignPlayerSheet
            indicators={indicators}
            onClose={() => setAssigningId(null)}
            onEdit={() => {
              const p = assigning;
              setAssigningId(null);
              // iOS kann kein zweites Modal öffnen, solange das erste noch schließt.
              if (p) setTimeout(() => setEditingPlayer(p), Platform.OS === 'ios' ? 400 : 0);
            }}
            onMove={(teamId) => assigning && movePlayer(assigning.id, teamId)}
            onToggleLock={() => assigning && move.mutate({ playerId: assigning.id, locked: !assigning.locked })}
            player={assigning}
            stats={stats}
            teams={teams}
          />
          <ImportPlayersSheet
            eventId={eventId}
            existingNames={existingNames}
            onClose={() => setImportOpen(false)}
            teams={teams}
            visible={importOpen}
          />
          <AutoAssignSheet
            eventId={eventId}
            onClose={() => setAutoOpen(false)}
            players={players}
            teams={teams}
            visible={autoOpen}
          />
        </>
      ) : null}
    </Screen>
  );
}

export default function TeamsScreen() {
  return (
    <RequireEvent>
      <TeamsContent />
    </RequireEvent>
  );
}
