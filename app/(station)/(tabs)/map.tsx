import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Text, useWindowDimensions, View } from 'react-native';
import { SatelliteMap } from '@/components/map/SatelliteMap';
import { ContextBar } from '@/components/station/ContextBar';
import { EmptyState } from '@/components/ui/EmptyState';
import { Icon } from '@/components/ui/Icon';
import { useTokens } from '@/components/ui/theme';
import { nativeZoomOfImage } from '@/lib/maps/tiles';
import { stationForSetup } from '@/lib/station/package';
import { useOfflineMap } from '@/lib/station/useOfflineMap';
import { useStationSession } from '@/providers/StationSessionProvider';

/**
 * Tab "Karte": das Gelände mit allen Stationen. Hervorgehoben ist die
 * übergebene (`setupId`), sonst die eingecheckte. Ein Tipp auf einen Pin
 * zeigt dessen Anfahrtshinweis.
 */
export default function VenueMapScreen() {
  const tokens = useTokens();
  const { height } = useWindowDimensions();
  const params = useLocalSearchParams<{ setupId?: string }>();
  const { pkg, activeCheckin } = useStationSession();

  const setupId = params.setupId ?? activeCheckin?.stationSetupId;
  const setup = setupId ? pkg?.station_setups.find((s) => s.id === setupId) : undefined;
  const focusStation = setup && pkg ? stationForSetup(pkg, setup) : undefined;
  const [selectedId, setSelectedId] = useState<string | undefined>(focusStation?.id);
  const offlineMap = useOfflineMap(pkg?.event.id);

  if (!pkg) {
    return (
      <View className="flex-1 bg-canvas p-5">
        <EmptyState
          description="Das Offline-Paket ist noch nicht geladen."
          icon="map-pin"
          title="Keine Karte"
        />
      </View>
    );
  }

  const stations = pkg.stations.filter((s) => s.latitude != null && s.longitude != null);
  const selected = stations.find((s) => s.id === selectedId);
  const event = pkg.event;
  const bounds =
    event.venue_north != null &&
    event.venue_south != null &&
    event.venue_east != null &&
    event.venue_west != null
      ? {
          north: event.venue_north,
          south: event.venue_south,
          east: event.venue_east,
          west: event.venue_west,
        }
      : null;

  const local = offlineMap.local;
  const offlineImage = local
    ? {
        uri: local.uri,
        bounds: {
          north: local.map.north,
          south: local.map.south,
          east: local.map.east,
          west: local.map.west,
        },
        nativeZoom: nativeZoomOfImage(local.map.width_px, local.map.west, local.map.east),
        attribution: local.map.attribution,
      }
    : null;

  return (
    <View className="flex-1 gap-3 bg-canvas px-5 pt-4">
      <ContextBar
        subtitle={
          focusStation ? `Deine Station: ${focusStation.name}` : 'Alle Stationen der Veranstaltung'
        }
        title="Gelände"
      />

      {stations.length === 0 ? (
        <EmptyState
          description="Für die Stationen sind keine Koordinaten hinterlegt."
          icon="map-pin"
          title="Keine Standorte"
        />
      ) : (
        <View style={{ borderRadius: 22, overflow: 'hidden' }}>
          <SatelliteMap
            bounds={bounds}
            fitToPins
            offlineImage={offlineImage}
            height={Math.round(height * 0.55)}
            onPinPress={setSelectedId}
            pins={stations.map((s) => ({
              id: s.id,
              coordinate: [s.longitude, s.latitude],
              label: s.name,
              selected: s.id === selectedId,
              color: s.id === focusStation?.id ? tokens.primary : undefined,
            }))}
          />
        </View>
      )}

      {selected ? (
        <View className="gap-1 rounded-card border border-line bg-surface p-4">
          <Text className="text-base font-extrabold text-ink">{selected.name}</Text>
          {selected.arrival_notes ? (
            <View className="flex-row items-start gap-2">
              <Icon color={tokens.subtle} name="map-pin" size={14} />
              <Text className="flex-1 text-sm leading-5 text-subtle">{selected.arrival_notes}</Text>
            </View>
          ) : (
            <Text className="text-sm text-subtle">Kein Anfahrtshinweis hinterlegt.</Text>
          )}
        </View>
      ) : (
        <Text className="text-center text-sm text-subtle">
          Tippe auf eine Station für den Anfahrtshinweis.
        </Text>
      )}
    </View>
  );
}
