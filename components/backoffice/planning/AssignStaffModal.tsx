import { useState } from 'react';
import { Text, View } from 'react-native';
import { Choice } from '@/components/ui/Choice';
import { FormSheet } from '@/components/ui/FormSheet';
import { friendlyErrorMessage } from '@/lib/api/errors';
import {
  type GameAssignmentRow,
  type StaffRow,
  type StationAssignmentRow,
  useAssignStaff,
  useAssignStaffToGame,
  useUnassignStaff,
  useUnassignStaffFromGame,
} from '@/lib/api/staff';

export type AssignmentTarget = { kind: 'station'; id: string } | { kind: 'game'; id: string };

type AssignmentRow =
  | (StationAssignmentRow & { event_staff?: { display_name: string } | null })
  | (GameAssignmentRow & { event_staff?: { display_name: string } | null });

export function AssignStaffModal({
  eventId,
  target,
  label,
  staff,
  assignments,
  onClose,
}: {
  eventId: string;
  target: AssignmentTarget | null;
  label: string;
  staff: StaffRow[];
  assignments: AssignmentRow[];
  onClose: () => void;
}) {
  const assignStation = useAssignStaff(eventId);
  const unassignStation = useUnassignStaff(eventId);
  const assignGame = useAssignStaffToGame(eventId);
  const unassignGame = useUnassignStaffFromGame(eventId);
  const [error, setError] = useState<string | null>(null);

  const assignedIds = new Set(assignments.map((a) => a.staff_id));

  const handleToggle = async (staffId: string) => {
    setError(null);
    try {
      const existing = assignments.find((a) => a.staff_id === staffId);
      if (existing) {
        if (target?.kind === 'game') {
          await unassignGame.mutateAsync(existing.id);
        } else {
          await unassignStation.mutateAsync(existing.id);
        }
      } else if (target?.kind === 'game') {
        await assignGame.mutateAsync({ staffId, eventGameId: target.id });
      } else if (target) {
        await assignStation.mutateAsync({ staffId, stationSetupId: target.id });
      }
    } catch (err) {
      setError(friendlyErrorMessage(err));
    }
  };

  return (
    <FormSheet error={error} onClose={onClose} title={label} visible={target !== null}>
      {staff.length === 0 ? (
        <Text className="text-[13px] text-subtle">Noch keine Betreuungspersonen angelegt.</Text>
      ) : (
        <View className="gap-2">
          {staff.map((person) => (
            <Choice
              key={person.id}
              label={person.display_name}
              onPress={() => handleToggle(person.id)}
              selected={assignedIds.has(person.id)}
            />
          ))}
        </View>
      )}
    </FormSheet>
  );
}
