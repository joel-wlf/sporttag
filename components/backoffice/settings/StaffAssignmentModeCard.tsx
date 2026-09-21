import { useState } from 'react';
import { View } from 'react-native';
import { Badge } from '@/components/ui/Badge';
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { Choice } from '@/components/ui/Choice';
import { friendlyErrorMessage } from '@/lib/api/errors';
import { type EventRow, useUpdateEvent } from '@/lib/api/events';
import type { StaffAssignmentMode } from '@/lib/api/staff';

const modeOptions: { value: StaffAssignmentMode; label: string; description: string }[] = [
  { value: 'station', label: 'Stationen', description: 'Betreuungspersonen werden Stationen zugeordnet.' },
  { value: 'game', label: 'Spiele', description: 'Betreuungspersonen werden Spielen zugeordnet, unabhängig von Station und Block.' },
];

export function StaffAssignmentModeCard({ event }: { event: EventRow }) {
  const updateEvent = useUpdateEvent(event.id);
  const [error, setError] = useState<string | null>(null);
  const locked = event.status !== 'draft';
  const mode = (event.staff_assignment_mode as StaffAssignmentMode) ?? 'station';

  const handleSelect = async (value: StaffAssignmentMode) => {
    if (locked || value === mode) return;
    setError(null);
    try {
      await updateEvent.mutateAsync({ staff_assignment_mode: value });
    } catch (err) {
      setError(friendlyErrorMessage(err));
    }
  };

  return (
    <Card className="gap-4">
      <CardHeader>
        <CardTitle>Betreuung zuordnen zu</CardTitle>
        <CardDescription>
          Gilt für den ganzen Sporttag: entweder Stationen oder Spiele, nicht beides gleichzeitig.
        </CardDescription>
      </CardHeader>
      <View className="gap-2">
        {modeOptions.map((option) => (
          <Choice
            description={option.description}
            key={option.value}
            label={option.label}
            onPress={() => handleSelect(option.value)}
            selected={mode === option.value}
          />
        ))}
      </View>
      {locked ? <Badge tone="neutral">Veröffentlicht – Zuordnungsart ist gesperrt</Badge> : null}
      {error ? <Badge tone="danger">{error}</Badge> : null}
    </Card>
  );
}
