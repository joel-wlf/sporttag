import { GeoJSONSource, MapLibreMap, Marker, NavigationControl, setWorkerUrl, type StyleSpecification } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import { useTokens, type ThemeTokens } from '@/components/ui/theme';
import { boundsKey, boundsToPolygonFeature } from './geo';
import { MapTokenNotice } from './MapTokenNotice';
import { fetchSatelliteStreetsStyle, getMapboxAccessToken } from './mapStyle';
import type { LngLat, MapPin, SatelliteMapProps } from './types';

const DEFAULT_CENTER: LngLat = [10.4515, 51.1657];
const DEFAULT_ZOOM = 5;
const SOURCE_ID = 'venue-bounds';

// Metro (Expo Web) serves nur gebündeltes JS, kein rohes node_modules-Verzeichnis; der
// von maplibre-gl per `import.meta.url` ermittelte Worker-Pfad 404et deshalb als HTML.
// `scripts/copy-maplibre-worker.js` (per `postinstall`) legt die Worker-Datei nach
// public/, wo Expo Router sie als statische Datei ausliefert.
setWorkerUrl('/maplibre-gl-worker.mjs');

/**
 * Baut den Pin-Inhalt direkt als DOM auf statt über einen zweiten, in das
 * Marker-Element eingehängten React-Root: Ein verschachtelter `createRoot`
 * unmountet beim Entfernen alter Pins synchron mitten in Reacts eigenem
 * Commit ("Attempted to synchronously unmount a root while React was
 * already rendering") und bringt die Kartenaktualisierung durcheinander.
 */
function renderPinContent(el: HTMLDivElement, pin: MapPin, tokens: ThemeTokens) {
  el.replaceChildren();
  el.style.display = 'flex';
  el.style.flexDirection = 'column';
  el.style.alignItems = 'center';
  el.style.gap = '4px';

  if (pin.label) {
    const chip = document.createElement('div');
    chip.style.cssText = `border-radius:9999px;background:${tokens.surface};padding:2px 8px;box-shadow:0 1px 2px rgba(0,0,0,0.15);font:700 11px sans-serif;color:${tokens.text};white-space:nowrap;`;
    chip.textContent = pin.label;
    el.appendChild(chip);
  }

  const bubble = document.createElement('div');
  bubble.style.cssText = `height:32px;width:32px;border-radius:9999px;display:flex;align-items:center;justify-content:center;box-shadow:0 1px 2px rgba(0,0,0,0.15);background:${pin.selected ? tokens.accent : tokens.primary};`;
  bubble.innerHTML = `<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="${tokens.onPrimary}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 21s6.5-5.4 6.5-10.5a6.5 6.5 0 1 0-13 0C5.5 15.6 12 21 12 21Z"/><circle cx="12" cy="10.5" r="2.4"/></svg>`;
  el.appendChild(bubble);
}

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
  const tokens = useTokens();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const readyRef = useRef(false);
  const pendingRef = useRef<{ applyBounds?: () => void; syncPins?: () => void }>({});
  const markersRef = useRef(new globalThis.Map<string, { marker: Marker; el: HTMLDivElement }>());
  const onMapPressRef = useRef(onMapPress);
  const onPinPressRef = useRef(onPinPress);
  useEffect(() => {
    onMapPressRef.current = onMapPress;
    onPinPressRef.current = onPinPress;
  }, [onMapPress, onPinPress]);

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

  useEffect(() => {
    if (!containerRef.current || !mapStyle) return;
    const map = new MapLibreMap({
      container: containerRef.current,
      style: mapStyle,
      attributionControl: { compact: true },
      // Bounds direkt in die Konstruktion geben, statt mit einer Weltansicht (Zoom 0) zu
      // starten und erst nach dem Laden per fitBounds heranzuzoomen: Bei Zoom 0 müsste der
      // Vektor-Straßen-Source Kacheln für die ganze Welt laden, wodurch `isStyleLoaded()`
      // praktisch nie fertig wird.
      ...(bounds
        ? { bounds: [bounds.west, bounds.south, bounds.east, bounds.north] as [number, number, number, number], fitBoundsOptions: { padding: 40 } }
        : { center: center ?? DEFAULT_CENTER, zoom: center ? zoom : DEFAULT_ZOOM }),
    });
    map.addControl(new NavigationControl({ showCompass: false }), 'top-right');
    map.on('click', (event) => {
      onMapPressRef.current?.([event.lngLat.lng, event.lngLat.lat]);
    });
    mapRef.current = map;

    const markReady = () => {
      if (readyRef.current) return;
      readyRef.current = true;
      pendingRef.current.applyBounds?.();
      pendingRef.current.syncPins?.();
    };
    // `addSource`/`addLayer`/Marker placement only need the style itself parsed, not every
    // tile downloaded. `load`/`isStyleLoaded()` wait for the latter, which at a wide zoom can
    // mean loading vector tiles for the whole visible area and may never practically finish;
    // `style.load` fires as soon as the style JSON is ready, which is all we actually need.
    if (map.style?.loaded()) markReady();
    else map.once('style.load', markReady);

    const resizeObserver = new ResizeObserver(() => map.resize());
    resizeObserver.observe(containerRef.current);

    const markers = markersRef.current;
    return () => {
      readyRef.current = false;
      resizeObserver.disconnect();
      markers.forEach(({ marker }) => marker.remove());
      markers.clear();
      map.remove();
      mapRef.current = null;
    };
    // Map wird nur beim Laden des Styles neu aufgebaut; Bounds/Pins/Fokus werden über eigene Effekte aktualisiert.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapStyle]);

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
        map.addLayer({ id: 'venue-bounds-fill', type: 'fill', source: SOURCE_ID, paint: { 'fill-color': '#556B2F', 'fill-opacity': 0.18 } });
        map.addLayer({ id: 'venue-bounds-line', type: 'line', source: SOURCE_ID, paint: { 'line-color': '#C59A4A', 'line-width': 3 } });
      }
      if (bounds && !focus) {
        map.fitBounds([bounds.west, bounds.south, bounds.east, bounds.north], { padding: 40, animate: true });
      }
    };

    pendingRef.current.applyBounds = applyBounds;
    if (readyRef.current) applyBounds();
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
          renderPinContent(entry.el, pin, tokens);
          return;
        }
        const el = document.createElement('div');
        el.style.cursor = onPinPressRef.current ? 'pointer' : 'default';
        renderPinContent(el, pin, tokens);
        const marker = new Marker({ element: el, anchor: 'bottom' }).setLngLat(pin.coordinate).addTo(map);
        el.addEventListener('click', (event) => {
          event.stopPropagation();
          onPinPressRef.current?.(pin.id);
        });
        markersRef.current.set(pin.id, { marker, el });
      });
      staleIds.forEach((id) => {
        const entry = markersRef.current.get(id);
        if (!entry) return;
        entry.marker.remove();
        markersRef.current.delete(id);
      });
    };

    pendingRef.current.syncPins = sync;
    if (readyRef.current) sync();
  }, [pins, tokens]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !focus || !readyRef.current) return;
    map.flyTo({ center: focus.center, zoom: focus.zoom ?? 16 });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- keyed by value, `focus` is a fresh object each render
  }, [focus?.center[0], focus?.center[1], focus?.zoom]);

  if (!token || !mapStyle) {
    return <MapTokenNotice height={height} missingToken={!token} />;
  }

  return (
    <View style={{ height, borderRadius: 22, overflow: 'hidden' }}>
      <div ref={containerRef} style={{ width: '100%', height: '100%' }} />
    </View>
  );
}
