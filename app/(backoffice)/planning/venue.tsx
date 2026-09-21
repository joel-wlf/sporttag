import { useState } from 'react';
import { Text, View } from 'react-native';
import { RequireEvent } from '@/components/backoffice/RequireEvent';
import { StationFormModal } from '@/components/backoffice/planning/StationFormModal';
import { VenueMap, type VenueMapMode } from '@/components/backoffice/planning/VenueMap';
import { boundsFromCorners } from '@/components/map/geo';
import type { LngLat, MapPin } from '@/components/map/types';
import { Header } from '@/components/layout/Header';
import { Screen } from '@/components/layout/Screen';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { Icon } from '@/components/ui/Icon';
import { ListRow } from '@/components/ui/ListRow';
import { useTokens } from '@/components/ui/theme';
import { friendlyErrorMessage } from '@/lib/api/errors';
import { useUpdateEvent, venueBoundsFromEvent } from '@/lib/api/events';
import { type StationRow, useStations } from '@/lib/api/stations';
import { useActiveEvent } from '@/providers/ActiveEventProvider';

function VenueContent() {
  const tokens = useTokens();
  const { eventId, event } = useActiveEvent();
  const { data: stations } = useStations(eventId);
  const updateVenue = useUpdateEvent(eventId ?? '');

  const [editing, setEditing] = useState<StationRow | 'new' | null>(null);
  const [pinTarget, setPinTarget] = useState<StationRow | 'new' | null>(null);
  const [pendingCoordinate, setPendingCoordinate] = useState<LngLat | null>(null);
  const [mode, setMode] = useState<VenueMapMode>({ kind: 'idle' });
  const [boundsError, setBoundsError] = useState<string | null>(null);

  const bounds = event ? venueBoundsFromEvent(event) : null;
  const pins: MapPin[] = (stations ?? []).flatMap((station) =>
    station.latitude === null || station.longitude === null
      ? []
      : [
          {
            id: station.id,
            coordinate: [station.longitude, station.latitude],
            label: station.name,
            selected: editing !== 'new' && editing?.id === station.id,
          },
        ],
  );

  const closeModal = () => {
    setEditing(null);
    setPinTarget(null);
    setPendingCoordinate(null);
  };

  const startNewStation = () => {
    setPinTarget('new');
    setPendingCoordinate(null);
    setEditing(null);
    setMode({ kind: 'pin' });
  };

  const startManualNewStation = () => {
    setMode({ kind: 'idle' });
    setPinTarget(null);
    setPendingCoordinate(null);
    setEditing('new');
  };

  const openStation = (station: StationRow) => {
    setMode({ kind: 'idle' });
    setPinTarget(null);
    setPendingCoordinate(null);
    setEditing(station);
  };

  const requestMapPickForOpenStation = () => {
    if (!editing || editing === 'new') return;
    setPinTarget(editing);
    setEditing(null);
    setMode({ kind: 'pin' });
  };

  const startBounds = () => {
    setBoundsError(null);
    setMode({ kind: 'bounds', first: null });
  };

  const cancelMode = () => {
    if (mode.kind === 'pin' && pinTarget && pinTarget !== 'new') {
      setEditing(pinTarget);
    }
    setMode({ kind: 'idle' });
    setPinTarget(null);
  };

  const handleMapPress = (coordinate: LngLat) => {
    if (mode.kind === 'bounds') {
      if (!mode.first) {
        setMode({ kind: 'bounds', first: coordinate });
        return;
      }
      const box = boundsFromCorners(mode.first, coordinate);
      setMode({ kind: 'idle' });
      updateVenue.mutate(
        { venue_north: box.north, venue_south: box.south, venue_east: box.east, venue_west: box.west },
        { onError: (err) => setBoundsError(friendlyErrorMessage(err)) },
      );
      return;
    }
    if (mode.kind === 'pin') {
      setPendingCoordinate(coordinate);
      setEditing(pinTarget);
      setMode({ kind: 'idle' });
    }
  };

  return (
    <Screen>
      <Header
        actions={
          <View className="flex-row gap-2">
            <Button label="Manuell" onPress={startManualNewStation} size="sm" variant="outline" />
            <Button label="Neue Station" leftIcon="plus" onPress={startNewStation} />
          </View>
        }
        description="Eine Station ist ein fester physischer Ort. Spiele und Betreuung wechseln je Block."
        eyebrow="PLANUNG"
        title="Gelände & Stationen"
      />

      <Card>
        <VenueMap
          bounds={bounds}
          mode={mode}
          onCancelMode={cancelMode}
          onMapPress={handleMapPress}
          onPinPress={(id) => {
            const station = (stations ?? []).find((s) => s.id === id);
            if (station) openStation(station);
          }}
          onStartBounds={startBounds}
          pins={pins}
        />
        {boundsError ? (
          <View className="mt-3 flex-row items-center gap-2 rounded-2xl bg-danger-soft px-4 py-3">
            <Icon color={tokens.danger} name="alert" size={16} />
            <Text className="flex-1 text-[13px] font-semibold text-danger">{boundsError}</Text>
          </View>
        ) : null}
      </Card>

      {!stations || stations.length === 0 ? (
        <Card>
          <EmptyState
            action={<Button label="Erste Station anlegen" onPress={startNewStation} />}
            description="WGS84-Koordinaten sind die einzige Quelle für die Pins auf der Karte."
            icon="map-pin"
            title="Noch keine Stationen"
          />
        </Card>
      ) : (
        <Card>
          <View className="gap-1">
            {stations.map((station) => (
              <ListRow
                icon="map-pin"
                key={station.id}
                onPress={() => openStation(station)}
                showChevron
                subtitle={station.location ?? (station.latitude === null ? 'Noch kein Standort' : `${station.latitude}, ${station.longitude}`)}
                title={station.name}
              />
            ))}
          </View>
        </Card>
      )}

      {eventId ? (
        <StationFormModal
          eventId={eventId}
          key={
            editing === 'new'
              ? `new-${pendingCoordinate ? pendingCoordinate.join(',') : 'blank'}`
              : editing
                ? `${editing.id}-${pendingCoordinate ? pendingCoordinate.join(',') : 'saved'}`
                : 'closed'
          }
          onClose={closeModal}
          onRequestMapPick={requestMapPickForOpenStation}
          pendingCoordinate={pendingCoordinate}
          station={editing}
        />
      ) : null}
    </Screen>
  );
}

export default function VenueScreen() {
  return (
    <RequireEvent>
      <VenueContent />
    </RequireEvent>
  );
}
