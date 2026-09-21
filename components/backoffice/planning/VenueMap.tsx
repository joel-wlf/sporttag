import { useMemo } from 'react';
import { Text, View } from 'react-native';
import { SatelliteMap } from '@/components/map/SatelliteMap';
import type { Bounds, LngLat, MapPin } from '@/components/map/types';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { useTokens } from '@/components/ui/theme';

export type VenueMapMode = { kind: 'idle' } | { kind: 'bounds'; first: LngLat | null } | { kind: 'pin' };

export function VenueMap({
  bounds,
  pins,
  mode,
  onMapPress,
  onPinPress,
  onStartBounds,
  onCancelMode,
}: {
  bounds: Bounds | null;
  pins: MapPin[];
  mode: VenueMapMode;
  onMapPress: (coordinate: LngLat) => void;
  onPinPress: (id: string) => void;
  onStartBounds: () => void;
  onCancelMode: () => void;
}) {
  const tokens = useTokens();

  const visiblePins = useMemo(() => {
    if (mode.kind === 'bounds' && mode.first) {
      return [...pins, { id: '__corner-1', coordinate: mode.first, label: 'Ecke 1' } satisfies MapPin];
    }
    return pins;
  }, [pins, mode]);

  const bannerText =
    mode.kind === 'bounds'
      ? mode.first
        ? 'Tippe die gegenüberliegende Ecke des Geländes an.'
        : 'Tippe eine Ecke des Geländes an.'
      : mode.kind === 'pin'
        ? 'Tippe auf die Karte, um den Stationsstandort zu setzen.'
        : null;

  return (
    <View className="gap-3">
      <View className="flex-row items-center justify-between gap-3">
        <View className="flex-row items-center gap-2">
          <Icon color={tokens.subtle} name="map-pin" size={16} />
          <Text className="text-[13px] font-bold text-ink">
            {bounds ? 'Gelände-Rechteck festgelegt' : 'Noch kein Gelände-Rechteck gesetzt'}
          </Text>
        </View>
        <Button
          isDisabled={mode.kind !== 'idle'}
          label={bounds ? 'Neu zeichnen' : 'Gelände festlegen'}
          onPress={onStartBounds}
          size="sm"
          variant="outline"
        />
      </View>
      {bannerText ? (
        <View className="flex-row items-center justify-between gap-3 rounded-2xl bg-primary-soft px-4 py-3">
          <Text className="flex-1 text-[13px] font-semibold text-primary">{bannerText}</Text>
          <Button label="Abbrechen" onPress={onCancelMode} size="sm" variant="ghost" />
        </View>
      ) : null}
      <SatelliteMap
        bounds={bounds}
        onMapPress={mode.kind !== 'idle' ? onMapPress : undefined}
        onPinPress={mode.kind === 'idle' ? onPinPress : undefined}
        pins={visiblePins}
      />
    </View>
  );
}
