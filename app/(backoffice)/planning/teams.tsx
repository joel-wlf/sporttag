import { useState } from 'react';
import { View } from 'react-native';
import { RequireEvent } from '@/components/backoffice/RequireEvent';
import { QuickTeamsModal } from '@/components/backoffice/planning/QuickTeamsModal';
import { TeamFormModal } from '@/components/backoffice/planning/TeamFormModal';
import { Header } from '@/components/layout/Header';
import { Screen } from '@/components/layout/Screen';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { ListRow } from '@/components/ui/ListRow';
import { type TeamRow, useTeams } from '@/lib/api/teams';
import { useActiveEvent } from '@/providers/ActiveEventProvider';

function TeamsContent() {
  const { eventId, event } = useActiveEvent();
  const { data: teams } = useTeams(eventId);
  const [editing, setEditing] = useState<TeamRow | 'new' | null>(null);
  const [quickOpen, setQuickOpen] = useState(false);
  const locked = event?.status !== 'draft';

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
