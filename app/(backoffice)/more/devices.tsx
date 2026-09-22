import { useState } from 'react';
import { ActivityIndicator } from 'react-native';
import { RequireEvent } from '@/components/backoffice/RequireEvent';
import { DeviceList } from '@/components/backoffice/devices/DeviceList';
import { DeviceSheet } from '@/components/backoffice/devices/DeviceSheet';
import { DeviceStats } from '@/components/backoffice/devices/DeviceStats';
import { ReconciliationCard } from '@/components/backoffice/devices/ReconciliationCard';
import { Header } from '@/components/layout/Header';
import { Screen } from '@/components/layout/Screen';
import { EmptyState } from '@/components/ui/EmptyState';
import { useTokens } from '@/components/ui/theme';
import { useDeviceSyncOverview, useDevicesRealtime, type DeviceSyncRow } from '@/lib/api/devices';
import { useActiveEvent } from '@/providers/ActiveEventProvider';

function DevicesContent() {
  const tokens = useTokens();
  const { eventId, event } = useActiveEvent();
  const { data: rows, isLoading } = useDeviceSyncOverview(eventId);
  useDevicesRealtime(eventId);
  const [selected, setSelected] = useState<DeviceSyncRow | null>(null);

  return (
    <Screen>
      <Header
        description="Erwartete Geräte, ihr Sync-Zustand und der Abschlussabgleich. Diese Ansicht zeigt Belege statt vorschnell „alles synchronisiert“."
        eyebrow="OFFLINE"
        title="Geräte & Synchronisierung"
      />

      {isLoading ? (
        <ActivityIndicator color={tokens.primary} />
      ) : !rows || rows.length === 0 ? (
        <EmptyState
          description="Noch kein Gerät ist mit dem Veranstaltungscode beigetreten."
          icon="devices"
          title="Keine Geräte"
        />
      ) : (
        <>
          <DeviceStats rows={rows} />
          <DeviceList onSelect={setSelected} rows={rows} />
        </>
      )}

      {event ? <ReconciliationCard event={event} /> : null}

      {eventId ? <DeviceSheet eventId={eventId} onClose={() => setSelected(null)} row={selected} /> : null}
    </Screen>
  );
}

export default function DevicesScreen() {
  return (
    <RequireEvent>
      <DevicesContent />
    </RequireEvent>
  );
}
