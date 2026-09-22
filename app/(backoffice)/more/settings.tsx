import { useState } from 'react';
import { View } from 'react-native';
import { AccessCodeCard } from '@/components/backoffice/settings/AccessCodeCard';
import { DangerZoneCard } from '@/components/backoffice/settings/DangerZoneCard';
import { DevicesCard } from '@/components/backoffice/settings/DevicesCard';
import { OrganizersCard } from '@/components/backoffice/settings/OrganizersCard';
import { StaffAssignmentModeCard } from '@/components/backoffice/settings/StaffAssignmentModeCard';
import { StatusCard } from '@/components/backoffice/settings/StatusCard';
import { RequireEvent } from '@/components/backoffice/RequireEvent';
import { Header } from '@/components/layout/Header';
import { Screen } from '@/components/layout/Screen';
import { Section } from '@/components/layout/Section';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { DateTimeField } from '@/components/ui/DateTimeField';
import { Field } from '@/components/ui/Input';
import { friendlyErrorMessage } from '@/lib/api/errors';
import { type EventRow, useUpdateEvent } from '@/lib/api/events';
import { useActiveEvent } from '@/providers/ActiveEventProvider';

function toDateString(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function parseDateString(value: string): Date {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, (month ?? 1) - 1, day ?? 1);
}

/**
 * Der Elternscreen rendert diese Karte mit `key={event.id}`, damit React
 * beim Wechsel der Veranstaltung neu mountet statt den Formularzustand per
 * Effekt zu syncen.
 */
function StammdatenCard({ event }: { event: EventRow }) {
  const updateEvent = useUpdateEvent(event.id);
  const [name, setName] = useState(event.name);
  const [motto, setMotto] = useState(event.motto ?? '');
  const [eventDate, setEventDate] = useState<Date | null>(parseDateString(event.event_date));
  const [timezone, setTimezone] = useState(event.timezone);
  const [ntfyBaseUrl, setNtfyBaseUrl] = useState(event.ntfy_base_url ?? '');
  const [ntfyTopic, setNtfyTopic] = useState(event.ntfy_topic ?? '');
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const locked = event.status !== 'draft';

  const handleSave = async () => {
    setError(null);
    setSaved(false);
    if (!eventDate) {
      setError('Bitte ein Datum auswählen.');
      return;
    }
    if (Boolean(ntfyBaseUrl.trim()) !== Boolean(ntfyTopic.trim())) {
      setError('ntfy-Basis-URL und Thema müssen zusammen gesetzt oder beide leer sein.');
      return;
    }
    try {
      await updateEvent.mutateAsync({
        name: name.trim(),
        motto: motto.trim() || null,
        event_date: toDateString(eventDate),
        timezone,
        ntfy_base_url: ntfyBaseUrl.trim() || null,
        ntfy_topic: ntfyTopic.trim() || null,
      });
      setSaved(true);
    } catch (err) {
      setError(friendlyErrorMessage(err));
    }
  };

  return (
    <Card className="gap-4">
      <CardHeader>
        <CardTitle>Stammdaten</CardTitle>
        <CardDescription>Name, Motto, Datum, Zeitzone und optionale ntfy-Benachrichtigung.</CardDescription>
      </CardHeader>
      <Field editable={!locked} label="Name" onChangeText={setName} value={name} />
      <Field editable={!locked} label="Motto" onChangeText={setMotto} value={motto} />
      {locked ? (
        <Field editable={false} label="Datum" value={eventDate ? toDateString(eventDate) : ''} />
      ) : (
        <DateTimeField label="Datum" mode="date" onChange={setEventDate} value={eventDate} />
      )}
      <Field editable={!locked} label="Zeitzone" onChangeText={setTimezone} value={timezone} />
      <Field
        autoCapitalize="none"
        hint="Alternative Benachrichtigung; beide Felder zusammen oder leer lassen"
        label="ntfy-Basis-URL (optional)"
        onChangeText={setNtfyBaseUrl}
        placeholder="https://ntfy.sh"
        value={ntfyBaseUrl}
      />
      <Field autoCapitalize="none" label="ntfy-Thema (optional)" onChangeText={setNtfyTopic} value={ntfyTopic} />
      {locked ? <Badge tone="neutral">Veröffentlicht – Stammdaten sind gesperrt</Badge> : null}
      {error ? <Badge tone="danger">{error}</Badge> : null}
      {saved ? <Badge tone="success">Gespeichert</Badge> : null}
      <Button
        className="self-start"
        isDisabled={locked}
        isLoading={updateEvent.isPending}
        label="Speichern"
        onPress={handleSave}
      />
    </Card>
  );
}

function SettingsContent() {
  const { eventId, event } = useActiveEvent();
  if (!eventId || !event) return null;
  return (
    <Screen>
      <Header description="Konfiguration, die nicht in die tägliche Planung gehört." eyebrow="VERANSTALTUNG" title="Event-Einstellungen" />
      <View className="gap-5">
        <StammdatenCard event={event} key={event.id} />
        <StatusCard event={event} />
        <StaffAssignmentModeCard event={event} />
        <Section title="Zugang">
          <AccessCodeCard eventId={eventId} />
          <DevicesCard eventId={eventId} />
        </Section>
        <OrganizersCard eventId={eventId} />
        <DangerZoneCard eventId={eventId} eventName={event.name} />
      </View>
    </Screen>
  );
}

export default function EventSettingsScreen() {
  return (
    <RequireEvent>
      <SettingsContent />
    </RequireEvent>
  );
}
