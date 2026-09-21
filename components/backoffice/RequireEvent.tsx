import { useRouter } from 'expo-router';
import { Screen } from '@/components/layout/Screen';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { useActiveEvent } from '@/providers/ActiveEventProvider';

/**
 * Umschließt Module, die eine ausgewählte Veranstaltung voraussetzen.
 * Ohne Auswahl erscheint ein Leerzustand mit Sprung zum Event-Portfolio.
 */
export function RequireEvent({ children }: { children: React.ReactNode }) {
  const { eventId } = useActiveEvent();
  const router = useRouter();

  if (!eventId) {
    return (
      <Screen>
        <EmptyState
          icon="overview"
          title="Keine Veranstaltung ausgewählt"
          description="Wähle zuerst eine Veranstaltung im Event-Portfolio aus, um dieses Modul zu bearbeiten."
          action={<Button label="Zum Event-Portfolio" onPress={() => router.push('/')} />}
        />
      </Screen>
    );
  }

  return <>{children}</>;
}
