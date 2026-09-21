import { useEffect, useMemo, useRef, useState } from 'react';
import { View } from 'react-native';
import { Camera, type CameraRef, GeoJSONSource, Layer, Map, Marker, type StyleSpecification } from '@maplibre/maplibre-react-native';
import { boundsKey, boundsToPolygonFeature } from './geo';
import { MapTokenNotice } from './MapTokenNotice';
import { fetchSatelliteStreetsStyle, getMapboxAccessToken } from './mapStyle';
import { PinMarker } from './PinMarker';
import type { SatelliteMapProps } from './types';

const DEFAULT_CENTER: [number, number] = [10.4515, 51.1657];
const DEFAULT_ZOOM = 5;

export function SatelliteMap({
  bounds,
  center,
  zoom = 15,
  focus,
  pins = [],
  onPinPress,
  onMapPress,
  height = 420,
}: SatelliteMapProps) {
  const token = getMapboxAccessToken();
  const cameraRef = useRef<CameraRef>(null);
  const [mapStyle, setMapStyle] = useState<StyleSpecification | null>(null);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    fetchSatelliteStreetsStyle(token).then((style) => {
      if (!cancelled) setMapStyle(style as unknown as StyleSpecification);
    });
    return () => {
      cancelled = true;
    };
  }, [token]);

  const key = boundsKey(bounds);
  const polygon = useMemo(
    () => (bounds ? boundsToPolygonFeature(bounds) : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- keyed by value, not object reference, to avoid re-fitting the camera on unrelated re-renders
    [key],
  );
  const cameraBounds = useMemo<[number, number, number, number] | undefined>(
    () => (bounds ? [bounds.west, bounds.south, bounds.east, bounds.north] : undefined),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- see above
    [key],
  );

  if (!token || !mapStyle) {
    return <MapTokenNotice height={height} missingToken={!token} />;
  }

  return (
    <View style={{ height, borderRadius: 22, overflow: 'hidden' }}>
      <Map
        attribution
        mapStyle={mapStyle}
        onPress={onMapPress ? (event) => onMapPress(event.nativeEvent.lngLat) : undefined}
        style={{ flex: 1 }}
      >
        <Camera
          bounds={!focus ? cameraBounds : undefined}
          center={focus ? focus.center : undefined}
          initialViewState={
            cameraBounds
              ? { bounds: cameraBounds, padding: { top: 40, right: 40, bottom: 40, left: 40 } }
              : { center: center ?? DEFAULT_CENTER, zoom: center ? zoom : DEFAULT_ZOOM }
          }
          ref={cameraRef}
          zoom={focus ? (focus.zoom ?? 16) : undefined}
        />
        {polygon ? (
          <GeoJSONSource data={polygon} id="venue-bounds">
            <Layer id="venue-bounds-fill" paint={{ 'fill-color': '#556B2F', 'fill-opacity': 0.14 }} type="fill" />
            <Layer id="venue-bounds-line" paint={{ 'line-color': '#556B2F', 'line-width': 2 }} type="line" />
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
            <PinMarker label={pin.label} selected={pin.selected} />
          </Marker>
        ))}
      </Map>
    </View>
  );
}
