import { useState } from 'react';
import { Text, View } from 'react-native';
import { Choice } from '@/components/ui/Choice';
import { FormSheet } from '@/components/ui/FormSheet';
import { friendlyErrorMessage } from '@/lib/api/errors';
import { type StaffRow, type StationAssignmentRow, useAssignStaff, useUnassignStaff } from '@/lib/api/staff';

export function AssignStaffModal({
  eventId,
  stationSetupId,
  label,
  staff,
  assignments,
  onClose,
}: {
  eventId: string;
  stationSetupId: string | null;
  label: string;
  staff: StaffRow[];
  assignments: (StationAssignmentRow & { event_staff?: { display_name: string } | null })[];
  onClose: () => void;
}) {
  const assign = useAssignStaff(eventId);
  const unassign = useUnassignStaff(eventId);
  const [error, setError] = useState<string | null>(null);

  const assignedIds = new Set(assignments.map((a) => a.staff_id));

  const handleToggle = async (staffId: string) => {
    setError(null);
    try {
      const existing = assignments.find((a) => a.staff_id === staffId);
      if (existing) {
        await unassign.mutateAsync(existing.id);
      } else if (stationSetupId) {
        await assign.mutateAsync({ staffId, stationSetupId });
      }
    } catch (err) {
      setError(friendlyErrorMessage(err));
    }
  };

  return (
    <FormSheet error={error} onClose={onClose} title={label} visible={stationSetupId !== null}>
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
