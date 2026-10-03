import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Text, useWindowDimensions, View } from 'react-native';
import { CreateEventModal } from '@/components/backoffice/CreateEventModal';
import { Header } from '@/components/layout/Header';
import { Screen } from '@/components/layout/Screen';
import { Section } from '@/components/layout/Section';
import { Button } from '@/components/ui/Button';
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { ListRow } from '@/components/ui/ListRow';
import { StatCard } from '@/components/ui/StatCard';
import { useTokens } from '@/components/ui/theme';
import { type EventStatus, useMyEvents } from '@/lib/api/events';
import { useActiveEvent } from '@/providers/ActiveEventProvider';

const statusLabels: Record<EventStatus, string> = {
  draft: 'Entwurf',
  published: 'Veröffentlicht',
  running: 'Laufend',
  finished: 'Beendet',
};

export default function EventsScreen() {
  const router = useRouter();
  const tokens = useTokens();
  const { data: events, isLoading } = useMyEvents();
  const { eventId, event: activeEvent, setActiveEventId } = useActiveEvent();
  const [createOpen, setCreateOpen] = useState(false);
  const wide = useWindowDimensions().width >= 960;

  const counts = {
    draft: events?.filter((e) => e.status === 'draft').length ?? 0,
    published: events?.filter((e) => e.status === 'published').length ?? 0,
    running: events?.filter((e) => e.status === 'running').length ?? 0,
    finished: events?.filter((e) => e.status === 'finished').length ?? 0,
  };

  // Mit Seitenleiste führt die Auswahl direkt zur Übersicht. Mit Tab-Leiste
  // wählt sie nur aus: ein Sprung in den Tab "Mehr" ließ Zurück dort statt
  // hier landen. Planung, Live und Ergebnis arbeiten dann mit dieser
  // Veranstaltung; die Übersicht ist über die Karte oben erreichbar.
  const openEvent = (id: string) => {
    setActiveEventId(id);
    if (wide) router.navigate('/more/overview');
  };

  return (
    <Screen>
      <Header
        actions={<Button label="Neue Veranstaltung" leftIcon="plus" onPress={() => setCreateOpen(true)} />}
        description="Einstieg für Organisatoren: Veranstaltungen anlegen, überwachen und fortsetzen."
        eyebrow="BACKOFFICE"
        title="Event-Portfolio"
      />
      {!wide && activeEvent ? (
        <Card className="gap-3" variant="muted">
          <View className="gap-0.5">
            <Text className="text-[11px] font-extrabold tracking-[0.8px] text-subtle">AUSGEWÄHLT</Text>
            <Text className="text-lg font-extrabold text-ink" numberOfLines={2}>
              {activeEvent.name}
            </Text>
            <Text className="text-sm text-subtle">
              {statusLabels[activeEvent.status as EventStatus]} · Planung, Live und Ergebnis zeigen diese Veranstaltung.
            </Text>
          </View>
          <Button
            label="Übersicht öffnen"
            onPress={() => router.navigate('/more/overview')}
            rightIcon="chevron-right"
            size="sm"
            variant="outline"
          />
        </Card>
      ) : null}

      {/* Auf dem iPhone schob die Statuszählung die eigentliche Liste unter den
          Falz; der Status steht dort ohnehin an jeder Zeile. */}
      {wide ? (
        <Section title="Status">
          <View className="flex-row flex-wrap gap-4">
            <StatCard icon="planning" label="Entwurf" value={String(counts.draft)} />
            <StatCard icon="upload" label="Veröffentlicht" value={String(counts.published)} />
            <StatCard icon="live" label="Laufend" value={String(counts.running)} />
            <StatCard icon="package" label="Beendet" value={String(counts.finished)} />
          </View>
        </Section>
      ) : null}

      {isLoading ? (
        <View className="items-center py-10">
          <ActivityIndicator color={tokens.primary} />
        </View>
      ) : !events || events.length === 0 ? (
        <Card className="min-w-0 flex-1 basis-[320px]">
          <CardHeader>
            <CardTitle>Keine Veranstaltungen</CardTitle>
            <CardDescription>
              Veranstaltungen bündeln Teams, Stationen, Zeitplan, Wertung und Ergebnisse.
            </CardDescription>
          </CardHeader>
          <EmptyState
            action={<Button label="Erste Veranstaltung anlegen" onPress={() => setCreateOpen(true)} />}
            description="Sobald eine Veranstaltung angelegt ist, erscheint sie hier mit Bereitschaft und Sync-Status."
            icon="overview"
            title="Noch keine Events"
          />
        </Card>
      ) : (
        <Section title="Deine Veranstaltungen">
          <Card>
            <View className="gap-1">
              {events.map((event) => (
                <ListRow
                  icon="overview"
                  key={event.id}
                  onPress={() => openEvent(event.id)}
                  selected={event.id === eventId}
                  showChevron={wide}
                  subtitle={new Date(event.event_date).toLocaleDateString('de-DE')}
                  title={event.name}
                  value={statusLabels[event.status as EventStatus]}
                />
              ))}
            </View>
          </Card>
        </Section>
      )}

      <CreateEventModal
        onClose={() => setCreateOpen(false)}
        onCreated={(id) => {
          setCreateOpen(false);
          openEvent(id);
        }}
        visible={createOpen}
      />
    </Screen>
  );
}
