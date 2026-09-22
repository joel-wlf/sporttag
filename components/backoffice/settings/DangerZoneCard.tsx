import { useState } from 'react';
import { useRouter } from 'expo-router';
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Field } from '@/components/ui/Input';
import { friendlyErrorMessage } from '@/lib/api/errors';
import { useDeleteEvent } from '@/lib/api/events';
import { useActiveEvent } from '@/providers/ActiveEventProvider';

export function DangerZoneCard({ eventId, eventName }: { eventId: string; eventName: string }) {
  const router = useRouter();
  const { setActiveEventId } = useActiveEvent();
  const deleteEvent = useDeleteEvent();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmName, setConfirmName] = useState('');
  const [error, setError] = useState<string | null>(null);

  const nameMatches = confirmName.trim() === eventName;

  const handleDelete = async () => {
    if (!nameMatches) return;
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
        <CardTitle>Veranstaltung endgültig löschen</CardTitle>
        <CardDescription>
          Entfernt die Veranstaltung samt aller Teams, Stationen, Spiele, Zeitpläne, Ergebnisse und Gerätezugänge –
          unabhängig vom Status. Das kann nicht rückgängig gemacht werden.
        </CardDescription>
      </CardHeader>
      <Button
        className="self-start"
        label="Veranstaltung endgültig löschen"
        onPress={() => {
          setConfirmName('');
          setConfirmOpen(true);
        }}
        variant="danger"
      />
      {error ? <Badge tone="danger">{error}</Badge> : null}
      <ConfirmDialog
        confirmLabel="Endgültig löschen"
        confirmVariant="danger"
        description={`Alle Daten von „${eventName}“ werden unwiderruflich gelöscht. Zum Bestätigen den Namen der Veranstaltung eingeben.`}
        isConfirmDisabled={!nameMatches}
        isLoading={deleteEvent.isPending}
        onCancel={() => setConfirmOpen(false)}
        onConfirm={handleDelete}
        title="Veranstaltung endgültig löschen?"
        visible={confirmOpen}
      >
        <Field autoCapitalize="none" label={`Name eingeben: „${eventName}“`} onChangeText={setConfirmName} value={confirmName} />
      </ConfirmDialog>
    </Card>
  );
}
