import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Field } from '@/components/ui/Input';
import { FormSheet } from '@/components/ui/FormSheet';
import { friendlyErrorMessage } from '@/lib/api/errors';
import { type StaffRow, useDeleteStaff, useUpsertStaff } from '@/lib/api/staff';

export function StaffFormModal({
  eventId,
  staff,
  onClose,
}: {
  eventId: string;
  staff: StaffRow | 'new' | null;
  onClose: () => void;
}) {
  const upsert = useUpsertStaff(eventId);
  const remove = useDeleteStaff(eventId);
  const existing = staff && staff !== 'new' ? staff : null;
  const [displayName, setDisplayName] = useState(existing?.display_name ?? '');
  const [notes, setNotes] = useState(existing?.notes ?? '');
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    setError(null);
    if (!displayName.trim()) {
      setError('Bitte einen Namen eingeben.');
      return;
    }
    try {
      await upsert.mutateAsync({
        id: staff && staff !== 'new' ? staff.id : undefined,
        display_name: displayName.trim(),
        notes: notes.trim() || null,
      });
      onClose();
    } catch (err) {
      setError(friendlyErrorMessage(err));
    }
  };

  const handleDelete = async () => {
    if (!staff || staff === 'new') return;
    setError(null);
    try {
      await remove.mutateAsync(staff.id);
      onClose();
    } catch (err) {
      setError(friendlyErrorMessage(err));
    }
  };

  return (
    <FormSheet
      error={error}
      isSubmitting={upsert.isPending}
      onClose={onClose}
      onSubmit={handleSubmit}
      secondaryAction={
        staff && staff !== 'new' ? <Button isLoading={remove.isPending} label="Löschen" onPress={handleDelete} variant="danger" /> : undefined
      }
      title={staff === 'new' ? 'Neue Betreuungsperson' : 'Betreuungsperson bearbeiten'}
      visible={staff !== null}
    >
      <Field label="Name" onChangeText={setDisplayName} placeholder="Joel" value={displayName} />
      <Field label="Notizen (optional)" multiline numberOfLines={2} onChangeText={setNotes} value={notes} />
    </FormSheet>
  );
}
