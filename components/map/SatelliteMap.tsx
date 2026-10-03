import { useMemo, useRef, useState } from 'react';
import { Text, View } from 'react-native';
import {
  Camera,
  type CameraRef,
  GeoJSONSource,
  ImageSource,
  Layer,
  Map,
  Marker,
  type StyleSpecification,
} from '@maplibre/maplibre-react-native';
import { boundsKey, boundsToPolygonFeature } from './geo';
import { buildSatelliteStyle } from './mapStyle';
import { PinMarker } from './PinMarker';
import type { SatelliteMapProps } from './types';

const DEFAULT_CENTER: [number, number] = [10.4515, 51.1657];
const DEFAULT_ZOOM = 5;
const MAP_STYLE = buildSatelliteStyle() as unknown as StyleSpecification;
// Ohne Quellen: nichts wird aus dem Netz geladen, das lokale Bild ist die einzige Ebene.
const OFFLINE_STYLE = {
  version: 8,
  sources: {},
  layers: [{ id: 'background', type: 'background', paint: { 'background-color': '#1B2416' } }],
} as unknown as StyleSpecification;

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
  offlineImage = null,
}: SatelliteMapProps) {
  const cameraRef = useRef<CameraRef>(null);
  // Die Kamera braucht die echte Kartengröße: vor dem ersten Layout (z. B. im
  // vorgeladenen, noch unsichtbaren Tab) ist sie 0 und MapLibre meldet
  // „padding is greater than map's height or width“.
  const [size, setSize] = useState<{ width: number; height: number } | null>(null);

  const key = boundsKey(bounds);
  const polygon = useMemo(
    () => (bounds ? boundsToPolygonFeature(bounds) : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- keyed by value, not object reference, to avoid re-fitting the camera on unrelated re-renders
    [key],
  );
  const pinKey = fitToPins
    ? pins
        .map((p) => p.coordinate.join(','))
        .sort()
        .join(';')
    : '';
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

  // Beschriftungen stehen zentriert über dem Pin: seitlich und oben mehr Rand,
  // sonst wurden Namen am Kartenrand abgeschnitten („Station D – Pa…“).
  // Die Animation (`cameraStop`) braucht denselben Rand wie die Anfangsansicht,
  // sonst setzt sie ihn beim ersten Update wieder auf 0.
  const wanted = fitToPins
    ? { top: 64, right: 80, bottom: 24, left: 80 }
    : { top: 40, right: 40, bottom: 40, left: 40 };
  const maxX = size ? Math.max(0, size.width / 2 - 40) : 0;
  const maxY = size ? Math.max(0, size.height / 2 - 40) : 0;
  const fitPadding = {
    top: Math.min(wanted.top, maxY),
    right: Math.min(wanted.right, maxX),
    bottom: Math.min(wanted.bottom, maxY),
    left: Math.min(wanted.left, maxX),
  };
  const cameraStop = focus
    ? { center: focus.center, zoom: focus.zoom ?? 16 }
    : cameraBounds
      ? { bounds: cameraBounds, padding: fitPadding }
      : {};

  return (
    <View
      onLayout={(e) => {
        const { width, height: h } = e.nativeEvent.layout;
        if (width > 0 && h > 0 && (width !== size?.width || h !== size?.height))
          setSize({ width, height: h });
      }}
      style={{ height, borderRadius: 22, overflow: 'hidden' }}
    >
      {size ? (
        <Map
          attribution={!offlineImage}
          mapStyle={offlineImage ? OFFLINE_STYLE : MAP_STYLE}
          // Die deklarative Kamera setzte die Bounds teils, bevor die native
          // Karte ihre Größe kannte, und blieb dann falsch eingepasst (ohne
          // Pins). Nach dem Laden deshalb einmal ausdrücklich einpassen.
          onDidFinishLoadingMap={() => {
            if (!focus && cameraBounds)
              cameraRef.current?.fitBounds(cameraBounds, { padding: fitPadding, duration: 0 });
          }}
          onPress={onMapPress ? (event) => onMapPress(event.nativeEvent.lngLat) : undefined}
          style={{ flex: 1 }}
        >
          <Camera
            {...cameraStop}
            initialViewState={
              cameraBounds
                ? { bounds: cameraBounds, padding: fitPadding }
                : { center: center ?? DEFAULT_CENTER, zoom: center ? zoom : DEFAULT_ZOOM }
            }
            maxBounds={
              offlineImage
                ? [
                    offlineImage.bounds.west,
                    offlineImage.bounds.south,
                    offlineImage.bounds.east,
                    offlineImage.bounds.north,
                  ]
                : undefined
            }
            maxZoom={offlineImage ? Math.min(22, offlineImage.nativeZoom + 1.5) : undefined}
            ref={cameraRef}
          />
          {offlineImage ? (
            <ImageSource
              coordinates={[
                [offlineImage.bounds.west, offlineImage.bounds.north],
                [offlineImage.bounds.east, offlineImage.bounds.north],
                [offlineImage.bounds.east, offlineImage.bounds.south],
                [offlineImage.bounds.west, offlineImage.bounds.south],
              ]}
              id="offline-image"
              url={offlineImage.uri}
            >
              <Layer id="offline-image-layer" paint={{ 'raster-fade-duration': 0 }} type="raster" />
            </ImageSource>
          ) : null}
          {polygon ? (
            <GeoJSONSource data={polygon} id="venue-bounds">
              <Layer
                id="venue-bounds-fill"
                paint={{ 'fill-color': '#556B2F', 'fill-opacity': 0.18 }}
                type="fill"
              />
              <Layer
                id="venue-bounds-line"
                paint={{ 'line-color': '#C59A4A', 'line-width': 3 }}
                type="line"
              />
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
                icon={pin.icon}
                label={pin.label}
                scoreLabel={pin.scoreLabel}
                selected={pin.selected}
              />
            </Marker>
          ))}
        </Map>
      ) : null}
      {offlineImage?.attribution ? (
        <Text
          className="absolute bottom-1 left-24 right-2 text-right text-[10px] text-white/80"
          numberOfLines={1}
          pointerEvents="none"
        >
          {offlineImage.attribution}
        </Text>
      ) : null}
    </View>
  );
}
