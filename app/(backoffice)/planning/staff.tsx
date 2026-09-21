import { useState } from 'react';
import { View } from 'react-native';
import { RequireEvent } from '@/components/backoffice/RequireEvent';
import { AssignStaffModal } from '@/components/backoffice/planning/AssignStaffModal';
import { StaffFormModal } from '@/components/backoffice/planning/StaffFormModal';
import { Header } from '@/components/layout/Header';
import { Screen } from '@/components/layout/Screen';
import { Section } from '@/components/layout/Section';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { ListRow } from '@/components/ui/ListRow';
import { blockLabel, useBlocks, useStationSetups } from '@/lib/api/schedule';
import { type StaffRow, useEventStaff, useStationAssignments } from '@/lib/api/staff';
import { useStations } from '@/lib/api/stations';
import { useActiveEvent } from '@/providers/ActiveEventProvider';

function StaffContent() {
  const { eventId } = useActiveEvent();
  const { data: staff } = useEventStaff(eventId);
  const { data: setups } = useStationSetups(eventId);
  const { data: blocks } = useBlocks(eventId);
  const { data: stations } = useStations(eventId);
  const { data: assignments } = useStationAssignments(eventId);
  const [editingStaff, setEditingStaff] = useState<StaffRow | 'new' | null>(null);
  const [assigningSetupId, setAssigningSetupId] = useState<string | null>(null);

  const assigningSetup = setups?.find((s) => s.id === assigningSetupId) ?? null;
  const assigningBlock = blocks?.find((b) => b.id === assigningSetup?.block_id);
  const assigningStation = stations?.find((s) => s.id === assigningSetup?.station_id);

  return (
    <Screen>
      <Header
        description="Geplante Stationsbesetzung, keine Anmeldung."
        eyebrow="PLANUNG"
        title="Betreuung"
      />

      <Section action={<Button label="Person hinzufügen" leftIcon="plus" onPress={() => setEditingStaff('new')} size="sm" />} title="Betreuungspersonen">
        {!staff || staff.length === 0 ? (
          <Card>
            <EmptyState description="Lege die Namen der Betreuungspersonen an." icon="shield" title="Noch keine Personen" />
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
      </Section>

      <Section description="Wer betreut welche Station in welchem Block." title="Einsatzplan">
        {!setups || setups.length === 0 ? (
          <Card>
            <EmptyState description="Weise zuerst unter „Zeitplan & Matches“ Spiele den Stationen zu." icon="map-pin" title="Noch keine Belegungen" />
          </Card>
        ) : (
          <Card>
            <View className="gap-1">
              {setups.map((setup) => {
                const block = blocks?.find((b) => b.id === setup.block_id);
                const station = stations?.find((s) => s.id === setup.station_id);
                const people = (assignments ?? []).filter((a) => a.station_setup_id === setup.id);
                return (
                  <ListRow
                    icon="map-pin"
                    key={setup.id}
                    onPress={() => setAssigningSetupId(setup.id)}
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

      {eventId ? (
        <>
          <StaffFormModal
            eventId={eventId}
            key={editingStaff === 'new' ? 'new' : (editingStaff?.id ?? 'closed')}
            onClose={() => setEditingStaff(null)}
            staff={editingStaff}
          />
          <AssignStaffModal
            assignments={(assignments ?? []).filter((a) => a.station_setup_id === assigningSetupId)}
            eventId={eventId}
            label={assigningStation && assigningBlock ? `${assigningStation.name} · ${blockLabel(assigningBlock)}` : 'Betreuung'}
            onClose={() => setAssigningSetupId(null)}
            staff={staff ?? []}
            stationSetupId={assigningSetupId}
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
