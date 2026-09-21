import { useState } from 'react';
import { useRouter } from 'expo-router';
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { friendlyErrorMessage } from '@/lib/api/errors';
import { useDeleteDraftEvent } from '@/lib/api/events';
import { useActiveEvent } from '@/providers/ActiveEventProvider';

export function DangerZoneCard({ eventId }: { eventId: string }) {
  const router = useRouter();
  const { setActiveEventId } = useActiveEvent();
  const deleteEvent = useDeleteDraftEvent();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleDelete = async () => {
    setError(null);
    try {
      await deleteEvent.mutateAsync(eventId);
      setActiveEventId(null);
      setConfirmOpen(false);
      router.replace('/');
    } catch (err) {
      setError(friendlyErrorMessage(err));
    }
  };

  return (
    <Card className="gap-4" variant="muted">
      <CardHeader>
        <CardTitle>Entwurf löschen</CardTitle>
        <CardDescription>
          Nur solange die Veranstaltung ein Entwurf ist und keine Ergebnisse vorliegen. Danach unwiderruflich.
        </CardDescription>
      </CardHeader>
      <Button className="self-start" label="Entwurf endgültig löschen" onPress={() => setConfirmOpen(true)} variant="danger" />
      {error ? <Badge tone="danger">{error}</Badge> : null}
      <ConfirmDialog
        confirmLabel="Endgültig löschen"
        description="Alle Teams, Stationen, Spiele und Zeitpläne dieser Veranstaltung werden entfernt. Das kann nicht rückgängig gemacht werden."
        isLoading={deleteEvent.isPending}
        onCancel={() => setConfirmOpen(false)}
        onConfirm={handleDelete}
        title="Entwurf endgültig löschen?"
        visible={confirmOpen}
      />
    </Card>
  );
}
