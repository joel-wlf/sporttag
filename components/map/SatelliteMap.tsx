import { useMemo, useRef } from 'react';
import { View } from 'react-native';
import { Camera, type CameraRef, GeoJSONSource, Layer, Map, Marker, type StyleSpecification } from '@maplibre/maplibre-react-native';
import { boundsKey, boundsToPolygonFeature } from './geo';
import { buildSatelliteStyle } from './mapStyle';
import { PinMarker } from './PinMarker';
import type { SatelliteMapProps } from './types';

const DEFAULT_CENTER: [number, number] = [10.4515, 51.1657];
const DEFAULT_ZOOM = 5;
const MAP_STYLE = buildSatelliteStyle() as unknown as StyleSpecification;

export function SatelliteMap({
  bounds,
  center,
  zoom = 15,
  focus,
  pins = [],
  onPinPress,
  onMapPress,
  height = 420,
  fitToPins = false,
}: SatelliteMapProps) {
  const cameraRef = useRef<CameraRef>(null);

  const key = boundsKey(bounds);
  const polygon = useMemo(
    () => (bounds ? boundsToPolygonFeature(bounds) : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- keyed by value, not object reference, to avoid re-fitting the camera on unrelated re-renders
    [key],
  );
  const pinKey = fitToPins ? pins.map((p) => p.coordinate.join(',')).sort().join(';') : '';
  const cameraBounds = useMemo<[number, number, number, number] | undefined>(
    () => {
      const lngs: number[] = [];
      const lats: number[] = [];
      if (bounds) {
        lngs.push(bounds.west, bounds.east);
        lats.push(bounds.south, bounds.north);
      }
      if (fitToPins) {
        for (const pin of pins) {
          lngs.push(pin.coordinate[0]);
          lats.push(pin.coordinate[1]);
        }
      }
      if (lngs.length === 0) return undefined;
      return [Math.min(...lngs), Math.min(...lats), Math.max(...lngs), Math.max(...lats)];
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps -- keyed by value (bounds + Pin-Koordinaten)
    [key, pinKey],
  );

  const cameraStop = focus
    ? { center: focus.center, zoom: focus.zoom ?? 16 }
    : cameraBounds
      ? { bounds: cameraBounds }
      : {};

  return (
    <View style={{ height, borderRadius: 22, overflow: 'hidden' }}>
      <Map
        attribution
        mapStyle={MAP_STYLE}
        onPress={onMapPress ? (event) => onMapPress(event.nativeEvent.lngLat) : undefined}
        style={{ flex: 1 }}
      >
        <Camera
          {...cameraStop}
          initialViewState={
            cameraBounds
              ? { bounds: cameraBounds, padding: { top: 40, right: 40, bottom: 40, left: 40 } }
              : { center: center ?? DEFAULT_CENTER, zoom: center ? zoom : DEFAULT_ZOOM }
          }
          ref={cameraRef}
        />
        {polygon ? (
          <GeoJSONSource data={polygon} id="venue-bounds">
            <Layer id="venue-bounds-fill" paint={{ 'fill-color': '#556B2F', 'fill-opacity': 0.18 }} type="fill" />
            <Layer id="venue-bounds-line" paint={{ 'line-color': '#C59A4A', 'line-width': 3 }} type="line" />
          </GeoJSONSource>
        ) : null}
        {pins.map((pin) => (
          <Marker
            anchor="bottom"
            id={pin.id}
            key={pin.id}
            lngLat={pin.coordinate}
            onPress={onPinPress ? () => onPinPress(pin.id) : undefined}
          >
            <PinMarker
              badge={pin.badge}
              color={pin.color}
              label={pin.label}
              scoreLabel={pin.scoreLabel}
              selected={pin.selected}
            />
          </Marker>
        ))}
      </Map>
    </View>
  );
}
