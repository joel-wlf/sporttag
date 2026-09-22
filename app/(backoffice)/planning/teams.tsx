import { useState } from 'react';
import { View } from 'react-native';
import { RequireEvent } from '@/components/backoffice/RequireEvent';
import { QuickTeamsModal } from '@/components/backoffice/planning/QuickTeamsModal';
import { TeamFormModal } from '@/components/backoffice/planning/TeamFormModal';
import { Header } from '@/components/layout/Header';
import { Screen } from '@/components/layout/Screen';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { DataTable, DataTableText, EditableCell, RowActionButton, RowActions } from '@/components/ui/DataTable';
import { EmptyState } from '@/components/ui/EmptyState';
import { ListRow } from '@/components/ui/ListRow';
import { useDesktop } from '@/components/ui/useDesktop';
import { confirmAsync } from '@/lib/confirm';
import { friendlyErrorMessage } from '@/lib/api/errors';
import { type TeamRow, useDeleteTeam, useTeams, useUpsertTeam } from '@/lib/api/teams';
import { useActiveEvent } from '@/providers/ActiveEventProvider';

function TeamsContent() {
  const { eventId, event } = useActiveEvent();
  const { data: teams } = useTeams(eventId);
  const upsert = useUpsertTeam(eventId ?? '');
  const remove = useDeleteTeam(eventId ?? '');
  const [editing, setEditing] = useState<TeamRow | 'new' | null>(null);
  const [quickOpen, setQuickOpen] = useState(false);
  const [tableError, setTableError] = useState<string | null>(null);
  const locked = event?.status !== 'draft';
  const desktop = useDesktop();

  const handleDelete = async (team: TeamRow) => {
    if (!(await confirmAsync(`„${team.name}“ wirklich löschen?`))) return;
    setTableError(null);
    try {
      await remove.mutateAsync(team.id);
    } catch (err) {
      setTableError(friendlyErrorMessage(err));
    }
  };

  return (
    <Screen>
      <Header
        actions={
          !locked ? (
            <>
              <Button label="Schnellanlage" onPress={() => setQuickOpen(true)} variant="outline" />
              <Button label="Neues Team" leftIcon="plus" onPress={() => setEditing('new')} />
            </>
          ) : undefined
        }
        description="Feste Teams innerhalb der Veranstaltung."
        eyebrow="PLANUNG"
        title="Teams"
      />
      {!teams || teams.length === 0 ? (
        <Card>
          <EmptyState
            action={!locked ? <Button label="Erstes Team anlegen" onPress={() => setEditing('new')} /> : undefined}
            description="Lege Teams mit Name, Nummer und optionaler Farbe an."
            icon="user"
            title="Noch keine Teams"
          />
        </Card>
      ) : desktop ? (
        <Card className="overflow-hidden p-0">
          <DataTable
            columns={[
              {
                key: 'number',
                header: 'Nr.',
                width: 72,
                render: (t) => (
                  <EditableCell
                    numeric
                    onCommit={(v) => upsert.mutate({ id: t.id, name: t.name, number: v.trim() ? Number(v) : null })}
                    subtle
                    value={t.number ? String(t.number) : ''}
                  />
                ),
              },
              {
                key: 'name',
                header: 'Name',
                flex: 2,
                render: (t) => (
                  <EditableCell onCommit={(v) => v.trim() && upsert.mutate({ id: t.id, name: v.trim() })} value={t.name} />
                ),
              },
              {
                key: 'participants',
                header: 'Teilnehmende',
                flex: 1,
                render: (t) => (
                  <EditableCell
                    numeric
                    onCommit={(v) => upsert.mutate({ id: t.id, name: t.name, participant_count: v.trim() ? Number(v) : null })}
                    subtle
                    value={t.participant_count ? String(t.participant_count) : ''}
                  />
                ),
              },
              {
                key: 'actions',
                header: '',
                width: 80,
                render: (t) => (
                  <RowActions>
                    <RowActionButton accessibilityLabel="Team bearbeiten" icon="edit" onPress={() => setEditing(t)} />
                    <RowActionButton accessibilityLabel="Team löschen" icon="trash" onPress={() => handleDelete(t)} tone="danger" />
                  </RowActions>
                ),
              },
            ]}
            data={teams}
            keyExtractor={(t) => t.id}
          />
        </Card>
      ) : (
        <Card>
          <View className="gap-1">
            {teams.map((team) => (
              <ListRow
                icon="user"
                key={team.id}
                onPress={() => setEditing(team)}
                showChevron={!locked}
                subtitle={team.participant_count ? `${team.participant_count} Teilnehmende` : undefined}
                title={team.number ? `${team.number} · ${team.name}` : team.name}
              />
            ))}
          </View>
        </Card>
      )}
      {tableError ? <Badge tone="danger">{tableError}</Badge> : null}

      {eventId ? (
        <>
          <TeamFormModal
            eventId={eventId}
            key={editing === 'new' ? 'new' : (editing?.id ?? 'closed')}
            onClose={() => setEditing(null)}
            team={editing}
          />
          <QuickTeamsModal eventId={eventId} onClose={() => setQuickOpen(false)} visible={quickOpen} />
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
