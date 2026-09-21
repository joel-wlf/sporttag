import { useState } from 'react';
import { Text, View } from 'react-native';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Field } from '@/components/ui/Input';
import { friendlyErrorMessage } from '@/lib/api/errors';
import { useAddEventOrganizer, useEventOrganizers, useRemoveEventOrganizer } from '@/lib/api/settings';

export function OrganizersCard({ eventId }: { eventId: string }) {
  const { data: organizers } = useEventOrganizers(eventId);
  const addOrganizer = useAddEventOrganizer(eventId);
  const removeOrganizer = useRemoveEventOrganizer(eventId);
  const [email, setEmail] = useState('');
  const [pendingRemoveId, setPendingRemoveId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const active = organizers?.filter((o) => o.active) ?? [];

  const handleAdd = async () => {
    setError(null);
    if (!email.trim()) return;
    try {
      await addOrganizer.mutateAsync(email.trim());
      setEmail('');
    } catch (err) {
      setError(friendlyErrorMessage(err));
    }
  };

  const handleRemove = async () => {
    if (!pendingRemoveId) return;
    setError(null);
    try {
      await removeOrganizer.mutateAsync(pendingRemoveId);
      setPendingRemoveId(null);
    } catch (err) {
      setError(friendlyErrorMessage(err));
    }
  };

  return (
    <Card className="gap-4">
      <CardHeader>
        <CardTitle>Organisatoren</CardTitle>
        <CardDescription>Weitere Organisatoren benötigen bereits ein eigenes Konto.</CardDescription>
      </CardHeader>

      <View className="gap-3">
        {active.map((organizer) => (
          <View className="flex-row items-center justify-between gap-3" key={organizer.membership_id}>
            <View className="min-w-0 flex-1 gap-0.5">
              <Text className="text-[14px] font-bold text-ink">{organizer.display_name}</Text>
              <Text className="text-[12px] text-subtle">{organizer.email}</Text>
            </View>
            {active.length > 1 ? (
              <Button label="Entfernen" onPress={() => setPendingRemoveId(organizer.membership_id)} size="sm" variant="outline" />
            ) : null}
          </View>
        ))}
      </View>

      <View className="flex-row items-end gap-3">
        <View className="min-w-0 flex-1">
          <Field
            autoCapitalize="none"
            keyboardType="email-address"
            label="Organisator hinzufügen"
            onChangeText={setEmail}
            placeholder="name@beispiel.de"
            value={email}
          />
        </View>
        <Button isLoading={addOrganizer.isPending} label="Hinzufügen" onPress={handleAdd} />
      </View>
      {error ? <Badge tone="danger">{error}</Badge> : null}

      <ConfirmDialog
        description="Der Organisator verliert den Zugriff auf diese Veranstaltung."
        isLoading={removeOrganizer.isPending}
        onCancel={() => setPendingRemoveId(null)}
        onConfirm={handleRemove}
        title="Organisator entfernen?"
        visible={pendingRemoveId !== null}
      />
    </Card>
  );
}
