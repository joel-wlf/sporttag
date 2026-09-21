import { useState } from 'react';
import { DateTimeField } from '@/components/ui/DateTimeField';
import { Field } from '@/components/ui/Input';
import { FormSheet } from '@/components/ui/FormSheet';
import { friendlyErrorMessage } from '@/lib/api/errors';
import { useCreateEvent } from '@/lib/api/events';

function toDateString(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export function CreateEventModal({
  visible,
  onClose,
  onCreated,
}: {
  visible: boolean;
  onClose: () => void;
  onCreated: (eventId: string) => void;
}) {
  const [name, setName] = useState('');
  const [motto, setMotto] = useState('');
  const [eventDate, setEventDate] = useState<Date | null>(null);
  const [timezone, setTimezone] = useState('Europe/Berlin');
  const [error, setError] = useState<string | null>(null);
  const createEvent = useCreateEvent();

  const reset = () => {
    setName('');
    setMotto('');
    setEventDate(null);
    setError(null);
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const handleSubmit = async () => {
    setError(null);
    if (name.trim().length === 0) {
      setError('Bitte einen Namen eingeben.');
      return;
    }
    if (!eventDate) {
      setError('Bitte ein Datum auswählen.');
      return;
    }
    try {
      const event = await createEvent.mutateAsync({
        name: name.trim(),
        eventDate: toDateString(eventDate),
        timezone,
        motto: motto.trim(),
      });
      reset();
      onCreated(event.id);
    } catch (err) {
      setError(friendlyErrorMessage(err));
    }
  };

  return (
    <FormSheet
      error={error}
      isSubmitting={createEvent.isPending}
      onClose={handleClose}
      onSubmit={handleSubmit}
      submitLabel="Anlegen"
      title="Neue Veranstaltung"
      visible={visible}
    >
      <Field label="Name" onChangeText={setName} placeholder="Sporttag 2027" value={name} />
      <Field label="Motto (optional)" onChangeText={setMotto} placeholder="Gemeinsam stark" value={motto} />
      <DateTimeField label="Datum" mode="date" onChange={setEventDate} value={eventDate} />
      <Field
        autoCapitalize="none"
        hint="IANA-Zeitzone, z. B. Europe/Berlin"
        label="Zeitzone"
        onChangeText={setTimezone}
        value={timezone}
      />
    </FormSheet>
  );
}
