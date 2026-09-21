import { GeoJSONSource, MapLibreMap, Marker, NavigationControl, type StyleSpecification } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { useEffect, useMemo, useRef } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { View } from 'react-native';
import { boundsKey, boundsToPolygonFeature } from './geo';
import { MapTokenNotice } from './MapTokenNotice';
import { buildSatelliteStyle, getMapboxAccessToken } from './mapStyle';
import { PinMarker } from './PinMarker';
import type { LngLat, SatelliteMapProps } from './types';

const DEFAULT_CENTER: LngLat = [10.4515, 51.1657];
const DEFAULT_ZOOM = 5;
const SOURCE_ID = 'venue-bounds';

export function SatelliteMap({
  bounds,
  center,
  zoom = 15,
  pins = [],
  onPinPress,
  onMapPress,
  height = 420,
}: SatelliteMapProps) {
  const token = getMapboxAccessToken();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const markersRef = useRef(new globalThis.Map<string, { marker: Marker; root: Root }>());
  const onMapPressRef = useRef(onMapPress);
  const onPinPressRef = useRef(onPinPress);
  useEffect(() => {
    onMapPressRef.current = onMapPress;
    onPinPressRef.current = onPinPress;
  }, [onMapPress, onPinPress]);

  const mapStyle = useMemo(() => buildSatelliteStyle(token ?? ''), [token]);
  const key = boundsKey(bounds);

  useEffect(() => {
    if (!containerRef.current || !token) return;
    const map = new MapLibreMap({
      container: containerRef.current,
      style: mapStyle as StyleSpecification,
      center: bounds ? [(bounds.east + bounds.west) / 2, (bounds.north + bounds.south) / 2] : (center ?? DEFAULT_CENTER),
      zoom: bounds ? undefined : center ? zoom : DEFAULT_ZOOM,
      attributionControl: { compact: true },
    });
    map.addControl(new NavigationControl({ showCompass: false }), 'top-right');
    map.on('click', (event) => {
      onMapPressRef.current?.([event.lngLat.lng, event.lngLat.lat]);
    });
    mapRef.current = map;
    const markers = markersRef.current;
    return () => {
      markers.forEach(({ marker, root }) => {
        root.unmount();
        marker.remove();
      });
      markers.clear();
      map.remove();
      mapRef.current = null;
    };
    // Map wird nur bei Token-Wechsel neu aufgebaut; Bounds/Pins werden über eigene Effekte aktualisiert.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const applyBounds = () => {
      const data = bounds ? boundsToPolygonFeature(bounds) : { type: 'FeatureCollection' as const, features: [] };
      const source = map.getSource(SOURCE_ID) as GeoJSONSource | undefined;
      if (source) {
        source.setData(data as GeoJSON.FeatureCollection | GeoJSON.Feature);
      } else {
        map.addSource(SOURCE_ID, { type: 'geojson', data: data as GeoJSON.FeatureCollection | GeoJSON.Feature });
        map.addLayer({ id: 'venue-bounds-fill', type: 'fill', source: SOURCE_ID, paint: { 'fill-color': '#556B2F', 'fill-opacity': 0.14 } });
        map.addLayer({ id: 'venue-bounds-line', type: 'line', source: SOURCE_ID, paint: { 'line-color': '#556B2F', 'line-width': 2 } });
      }
      if (bounds) {
        map.fitBounds([bounds.west, bounds.south, bounds.east, bounds.north], { padding: 40, animate: true });
      }
    };

    if (map.isStyleLoaded()) applyBounds();
    else map.once('load', applyBounds);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- keyed by value via `key`, not object reference
  }, [key]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const sync = () => {
      const staleIds = new Set(markersRef.current.keys());
      pins.forEach((pin) => {
        staleIds.delete(pin.id);
        const entry = markersRef.current.get(pin.id);
        if (entry) {
          entry.marker.setLngLat(pin.coordinate);
          entry.root.render(<PinMarker label={pin.label} selected={pin.selected} />);
          return;
        }
        const el = document.createElement('div');
        el.style.cursor = onPinPressRef.current ? 'pointer' : 'default';
        const root = createRoot(el);
        root.render(<PinMarker label={pin.label} selected={pin.selected} />);
        const marker = new Marker({ element: el, anchor: 'bottom' }).setLngLat(pin.coordinate).addTo(map);
        el.addEventListener('click', (event) => {
          event.stopPropagation();
          onPinPressRef.current?.(pin.id);
        });
        markersRef.current.set(pin.id, { marker, root });
      });
      staleIds.forEach((id) => {
        const entry = markersRef.current.get(id);
        if (!entry) return;
        entry.root.unmount();
        entry.marker.remove();
        markersRef.current.delete(id);
      });
    };

    if (map.isStyleLoaded()) sync();
    else map.once('load', sync);
  }, [pins]);

  if (!token) {
    return <MapTokenNotice height={height} />;
  }

  return (
    <View style={{ height, borderRadius: 22, overflow: 'hidden' }}>
      <div ref={containerRef} style={{ width: '100%', height: '100%' }} />
    </View>
  );
}
