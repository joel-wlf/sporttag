import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Field } from '@/components/ui/Input';
import { FormSheet } from '@/components/ui/FormSheet';
import { friendlyErrorMessage } from '@/lib/api/errors';
import { type TeamRow, useDeleteTeam, useUpsertTeam } from '@/lib/api/teams';

/**
 * Der Elternscreen rendert diese Komponente mit einem stabilen `key` je
 * bearbeitetem Team, damit React beim Wechsel des Ziels neu mountet statt
 * den Formularzustand per Effekt zurückzusetzen.
 */
export function TeamFormModal({
  eventId,
  team,
  onClose,
}: {
  eventId: string;
  team: TeamRow | 'new' | null;
  onClose: () => void;
}) {
  const upsert = useUpsertTeam(eventId);
  const remove = useDeleteTeam(eventId);
  const [name, setName] = useState(team && team !== 'new' ? team.name : '');
  const [number, setNumber] = useState(team && team !== 'new' && team.number ? String(team.number) : '');
  const [color, setColor] = useState(team && team !== 'new' ? (team.color ?? '') : '');
  const [participantCount, setParticipantCount] = useState(
    team && team !== 'new' && team.participant_count ? String(team.participant_count) : '',
  );
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    setError(null);
    if (!name.trim()) {
      setError('Bitte einen Namen eingeben.');
      return;
    }
    try {
      await upsert.mutateAsync({
        id: team && team !== 'new' ? team.id : undefined,
        name: name.trim(),
        number: number.trim() ? Number(number) : null,
        color: color.trim() || null,
        participant_count: participantCount.trim() ? Number(participantCount) : null,
      });
      onClose();
    } catch (err) {
      setError(friendlyErrorMessage(err));
    }
  };

  const handleDelete = async () => {
    if (!team || team === 'new') return;
    setError(null);
    try {
      await remove.mutateAsync(team.id);
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
        team && team !== 'new' ? (
          <Button isLoading={remove.isPending} label="Löschen" onPress={handleDelete} variant="danger" />
        ) : undefined
      }
      title={team === 'new' ? 'Neues Team' : 'Team bearbeiten'}
      visible={team !== null}
    >
      <Field label="Name" onChangeText={setName} placeholder="Die Adler" value={name} />
      <Field keyboardType="number-pad" label="Nummer (optional)" onChangeText={setNumber} value={number} />
      <Field label="Farbe (optional)" onChangeText={setColor} placeholder="#3F6B3A" value={color} />
      <Field keyboardType="number-pad" label="Teilnehmerzahl (optional)" onChangeText={setParticipantCount} value={participantCount} />
    </FormSheet>
  );
}
