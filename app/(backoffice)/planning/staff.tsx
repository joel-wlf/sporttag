import { useState } from 'react';
import { Text, View } from 'react-native';
import { RequireEvent } from '@/components/backoffice/RequireEvent';
import { AssignStaffModal, type AssignmentTarget } from '@/components/backoffice/planning/AssignStaffModal';
import { StaffFormModal } from '@/components/backoffice/planning/StaffFormModal';
import { Header } from '@/components/layout/Header';
import { Screen } from '@/components/layout/Screen';
import { Section } from '@/components/layout/Section';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { DataTable, DataTableText, EditableCell, RowActionButton, RowActions } from '@/components/ui/DataTable';
import { EmptyState } from '@/components/ui/EmptyState';
import { ListRow } from '@/components/ui/ListRow';
import { useDesktop } from '@/components/ui/useDesktop';
import { confirmAsync } from '@/lib/confirm';
import { friendlyErrorMessage } from '@/lib/api/errors';
import { useEventGames } from '@/lib/api/games';
import { blockLabel, useBlocks, useStationSetups } from '@/lib/api/schedule';
import {
  type StaffRow,
  useDeleteStaff,
  useEventStaff,
  useGameAssignments,
  useStationAssignments,
  useUpsertStaff,
} from '@/lib/api/staff';
import { useStations } from '@/lib/api/stations';
import { useActiveEvent } from '@/providers/ActiveEventProvider';

function StationAssignmentSection({
  eventId,
  staff,
  onOpen,
}: {
  eventId: string;
  staff: StaffRow[];
  onOpen: (target: AssignmentTarget, label: string) => void;
}) {
  const { data: setups } = useStationSetups(eventId);
  const { data: blocks } = useBlocks(eventId);
  const { data: stations } = useStations(eventId);
  const { data: assignments } = useStationAssignments(eventId);
  const desktop = useDesktop();

  return (
    <Section description="Wer betreut welche Station in welchem Block." title="Einsatzplan">
      {!setups || setups.length === 0 ? (
        <Card>
          <EmptyState description="Weise zuerst unter „Zeitplan & Matches“ Spiele den Stationen zu." icon="map-pin" title="Noch keine Belegungen" />
        </Card>
      ) : desktop ? (
        <Card className="overflow-hidden p-0">
          <DataTable
            columns={[
              {
                key: 'station',
                header: 'Station',
                flex: 2,
                render: (setup) => <DataTableText>{stations?.find((s) => s.id === setup.station_id)?.name ?? 'Station'}</DataTableText>,
              },
              {
                key: 'block',
                header: 'Block',
                flex: 1,
                render: (setup) => {
                  const block = blocks?.find((b) => b.id === setup.block_id);
                  return <DataTableText subtle>{block ? blockLabel(block) : '—'}</DataTableText>;
                },
              },
              {
                key: 'people',
                header: 'Besetzung',
                width: 120,
                align: 'right',
                render: (setup) => {
                  const count = (assignments ?? []).filter((a) => a.station_setup_id === setup.id).length;
                  return (
                    <Text className="text-right text-[13px] font-bold text-subtle">
                      {count > 0 ? `${count} Person${count === 1 ? '' : 'en'}` : '—'}
                    </Text>
                  );
                },
              },
            ]}
            data={setups}
            keyExtractor={(setup) => setup.id}
            onRowPress={(setup) => {
              const block = blocks?.find((b) => b.id === setup.block_id);
              const station = stations?.find((s) => s.id === setup.station_id);
              const label = station && block ? `${station.name} · ${blockLabel(block)}` : 'Betreuung';
              onOpen({ kind: 'station', id: setup.id }, label);
            }}
          />
        </Card>
      ) : (
        <Card>
          <View className="gap-1">
            {setups.map((setup) => {
              const block = blocks?.find((b) => b.id === setup.block_id);
              const station = stations?.find((s) => s.id === setup.station_id);
              const people = (assignments ?? []).filter((a) => a.station_setup_id === setup.id);
              const label = station && block ? `${station.name} · ${blockLabel(block)}` : 'Betreuung';
              return (
                <ListRow
                  icon="map-pin"
                  key={setup.id}
                  onPress={() => onOpen({ kind: 'station', id: setup.id }, label)}
                  showChevron
                  subtitle={block ? blockLabel(block) : undefined}
                  title={station?.name ?? 'Station'}
                  value={people.length > 0 ? `${people.length} Person${people.length === 1 ? '' : 'en'}` : undefined}
                />
              );
            })}
          </View>
        </Card>
      )}
      {setups && setups.some((s) => !(assignments ?? []).some((a) => a.station_setup_id === s.id)) ? (
        <Badge tone="warning">Es gibt unbesetzte Stationsbelegungen.</Badge>
      ) : null}
    </Section>
  );
}

function GameAssignmentSection({
  eventId,
  staff,
  onOpen,
}: {
  eventId: string;
  staff: StaffRow[];
  onOpen: (target: AssignmentTarget, label: string) => void;
}) {
  const { data: games } = useEventGames(eventId);
  const { data: assignments } = useGameAssignments(eventId);
  const desktop = useDesktop();

  return (
    <Section description="Wer betreut welches Spiel, unabhängig von Station und Block." title="Einsatzplan">
      {!games || games.length === 0 ? (
        <Card>
          <EmptyState description="Lege zuerst unter „Spiele & Wertung“ die Spiele für diesen Sporttag an." icon="flag" title="Noch keine Spiele" />
        </Card>
      ) : desktop ? (
        <Card className="overflow-hidden p-0">
          <DataTable
            columns={[
              { key: 'game', header: 'Spiel', flex: 2, render: (g) => <DataTableText>{g.name}</DataTableText> },
              {
                key: 'people',
                header: 'Besetzung',
                width: 120,
                align: 'right',
                render: (g) => {
                  const count = (assignments ?? []).filter((a) => a.event_game_id === g.id).length;
                  return (
                    <Text className="text-right text-[13px] font-bold text-subtle">
                      {count > 0 ? `${count} Person${count === 1 ? '' : 'en'}` : '—'}
                    </Text>
                  );
                },
              },
            ]}
            data={games}
            keyExtractor={(g) => g.id}
            onRowPress={(g) => onOpen({ kind: 'game', id: g.id }, g.name)}
          />
        </Card>
      ) : (
        <Card>
          <View className="gap-1">
            {games.map((game) => {
              const people = (assignments ?? []).filter((a) => a.event_game_id === game.id);
              return (
                <ListRow
                  icon="flag"
                  key={game.id}
                  onPress={() => onOpen({ kind: 'game', id: game.id }, game.name)}
                  showChevron
                  title={game.name}
                  value={people.length > 0 ? `${people.length} Person${people.length === 1 ? '' : 'en'}` : undefined}
                />
              );
            })}
          </View>
        </Card>
      )}
      {games && games.some((g) => !(assignments ?? []).some((a) => a.event_game_id === g.id)) ? (
        <Badge tone="warning">Es gibt Spiele ohne Betreuung.</Badge>
      ) : null}
    </Section>
  );
}

function StaffContent() {
  const { eventId, event } = useActiveEvent();
  const { data: staff } = useEventStaff(eventId);
  const { data: stationAssignments } = useStationAssignments(eventId);
  const { data: gameAssignments } = useGameAssignments(eventId);
  const upsertStaff = useUpsertStaff(eventId ?? '');
  const removeStaff = useDeleteStaff(eventId ?? '');
  const [editingStaff, setEditingStaff] = useState<StaffRow | 'new' | null>(null);
  const [assigning, setAssigning] = useState<{ target: AssignmentTarget; label: string } | null>(null);
  const [tableError, setTableError] = useState<string | null>(null);
  const desktop = useDesktop();

  const handleDeleteStaff = async (person: StaffRow) => {
    if (!(await confirmAsync(`„${person.display_name}“ wirklich löschen?`))) return;
    setTableError(null);
    try {
      await removeStaff.mutateAsync(person.id);
    } catch (err) {
      setTableError(friendlyErrorMessage(err));
    }
  };

  const mode = event?.staff_assignment_mode ?? 'station';
  const currentAssignments =
    assigning?.target.kind === 'game'
      ? (gameAssignments ?? []).filter((a) => a.event_game_id === assigning.target.id)
      : (stationAssignments ?? []).filter((a) => a.station_setup_id === assigning?.target.id);

  return (
    <Screen>
      <Header
        description="Geplante Betreuung, keine Anmeldung."
        eyebrow="PLANUNG"
        title="Betreuung"
      />

      <Section action={<Button label="Person hinzufügen" leftIcon="plus" onPress={() => setEditingStaff('new')} size="sm" />} title="Betreuungspersonen">
        {!staff || staff.length === 0 ? (
          <Card>
            <EmptyState description="Lege die Namen der Betreuungspersonen an." icon="shield" title="Noch keine Personen" />
          </Card>
        ) : desktop ? (
          <Card className="overflow-hidden p-0">
            <DataTable
              columns={[
                {
                  key: 'name',
                  header: 'Name',
                  flex: 1,
                  render: (p) => (
                    <EditableCell
                      onCommit={(v) => v.trim() && upsertStaff.mutate({ id: p.id, display_name: v.trim() })}
                      value={p.display_name}
                    />
                  ),
                },
                {
                  key: 'actions',
                  header: '',
                  width: 80,
                  render: (p) => (
                    <RowActions>
                      <RowActionButton accessibilityLabel="Person bearbeiten" icon="edit" onPress={() => setEditingStaff(p)} />
                      <RowActionButton
                        accessibilityLabel="Person löschen"
                        icon="trash"
                        onPress={() => handleDeleteStaff(p)}
                        tone="danger"
                      />
                    </RowActions>
                  ),
                },
              ]}
              data={staff}
              keyExtractor={(p) => p.id}
            />
          </Card>
        ) : (
          <Card>
            <View className="gap-1">
              {staff.map((person) => (
                <ListRow icon="shield" key={person.id} onPress={() => setEditingStaff(person)} showChevron title={person.display_name} />
              ))}
            </View>
          </Card>
        )}
        {tableError ? <Badge tone="danger">{tableError}</Badge> : null}
      </Section>

      {mode === 'game' ? (
        <GameAssignmentSection eventId={eventId as string} onOpen={(target, label) => setAssigning({ target, label })} staff={staff ?? []} />
      ) : (
        <StationAssignmentSection eventId={eventId as string} onOpen={(target, label) => setAssigning({ target, label })} staff={staff ?? []} />
      )}

      {eventId ? (
        <>
          <StaffFormModal
            eventId={eventId}
            key={editingStaff === 'new' ? 'new' : (editingStaff?.id ?? 'closed')}
            onClose={() => setEditingStaff(null)}
            staff={editingStaff}
          />
          <AssignStaffModal
            assignments={currentAssignments}
            eventId={eventId}
            label={assigning?.label ?? 'Betreuung'}
            onClose={() => setAssigning(null)}
            staff={staff ?? []}
            target={assigning?.target ?? null}
          />
        </>
      ) : null}
    </Screen>
  );
}

export default function StaffScreen() {
  return (
    <RequireEvent>
      <StaffContent />
    </RequireEvent>
  );
}
