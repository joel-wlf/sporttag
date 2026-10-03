import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useEffect, useRef } from 'react';
import { View } from 'react-native';
import { useTokens, type ThemeTokens } from '@/components/ui/theme';
import { boundsKey } from './geo';
import { ESRI_IMAGERY_TILE_URL, ESRI_LABELS_TILE_URL, MAX_TILE_ZOOM, TILE_ATTRIBUTION } from './mapStyle';
import type { MapPin, SatelliteMapProps } from './types';

const DEFAULT_CENTER_LATLNG: [number, number] = [51.1657, 10.4515];
const DEFAULT_ZOOM = 5;

function escapeHtml(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/**
 * SVG-Inhalte der Pin-Symbole als Markup für Leaflet-divIcons; dieselben
 * Formen wie in components/ui/Icon.tsx. Unbekannte Namen fallen auf die
 * Stecknadel zurück.
 */
const PIN_GLYPHS: Record<string, (stroke: string) => string> = {
  'map-pin': () => '<path d="M12 21s6.5-5.4 6.5-10.5a6.5 6.5 0 1 0-13 0C5.5 15.6 12 21 12 21Z"/><circle cx="12" cy="10.5" r="2.4"/>',
  alert: () => '<path d="M10.3 3.9 2.6 17.4a2 2 0 0 0 1.7 3h15.4a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z"/><line x1="12" y1="9" x2="12" y2="13.5"/><line x1="12" y1="17" x2="12" y2="17.01"/>',
  users: () => '<circle cx="9" cy="8" r="3.25"/><path d="M2.75 20a6.25 6.25 0 0 1 12.5 0"/><path d="M15.5 5.1a3.25 3.25 0 0 1 0 6.3"/><path d="M17.5 14.2a6.25 6.25 0 0 1 3.75 5.8"/>',
  'wifi-off': (stroke) =>
    `<line x1="3" y1="3" x2="21" y2="21"/><path d="M5 8.8a15.5 15.5 0 0 1 4.6-2.6"/><path d="M13.3 5.6A15.5 15.5 0 0 1 19 8.8"/><path d="M8.3 12.6a9.8 9.8 0 0 1 3.2-1.5"/><path d="M15.4 13.8a9.8 9.8 0 0 0-1.4-1.2"/><path d="M11.5 16.4a3.9 3.9 0 0 1 2 .6"/><circle cx="12" cy="19.5" r="0.9" fill="${stroke}"/>`,
  play: (stroke) => `<path d="M6 4.5v15l14-7.5Z" fill="${stroke}"/>`,
  clock: () => '<circle cx="12" cy="12" r="9"/><polyline points="12 7 12 12 15.5 14"/>',
  check: () => '<polyline points="4.5 12.5 9.5 17.5 19.5 7"/>',
  minus: () => '<line x1="5" y1="12" x2="19" y2="12"/>',
};

function buildPinIcon(pin: MapPin, tokens: ThemeTokens): L.DivIcon {
  const bubbleColor = pin.color ?? (pin.selected ? tokens.accent : tokens.primary);
  const size = pin.selected ? 38 : 32;
  const border = pin.selected ? `border:3px solid ${tokens.surface};` : '';
  const scoreChip = pin.scoreLabel
    ? `<div style="margin-bottom:2px;border-radius:9999px;background:${tokens.accent};padding:1px 7px;box-shadow:0 1px 2px rgba(0,0,0,0.15);font:900 11px sans-serif;color:${tokens.text};white-space:nowrap;">${escapeHtml(pin.scoreLabel)}</div>`
    : '';
  const chip = pin.label
    ? `<div style="margin-bottom:4px;border-radius:9999px;background:${tokens.surface};padding:2px 8px;box-shadow:0 1px 2px rgba(0,0,0,0.15);font:700 11px sans-serif;color:${tokens.text};white-space:nowrap;">${escapeHtml(pin.label)}</div>`
    : '';
  const badge = pin.badge
    ? `<div style="position:absolute;top:-4px;right:-4px;min-width:18px;height:18px;border-radius:9999px;background:${tokens.danger};display:flex;align-items:center;justify-content:center;padding:0 4px;font:900 10px sans-serif;color:${tokens.onPrimary};">${escapeHtml(pin.badge)}</div>`
    : '';
  const extraHeight = pin.scoreLabel ? 18 : 0;
  return L.divIcon({
    html: `<div style="display:flex;flex-direction:column;align-items:center;">${scoreChip}${chip}<div style="position:relative;height:${size}px;width:${size}px;border-radius:9999px;display:flex;align-items:center;justify-content:center;box-shadow:0 1px 2px rgba(0,0,0,0.15);background:${bubbleColor};${border}">${badge}<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="${tokens.onPrimary}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${(PIN_GLYPHS[pin.icon ?? 'map-pin'] ?? PIN_GLYPHS['map-pin'])(tokens.onPrimary)}</svg></div></div>`,
    className: '',
    iconSize: [size, 46 + extraHeight],
    iconAnchor: [size / 2, 32 + extraHeight],
  });
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
  scrollWheelZoom = true,
  fitToPins = false,
}: SatelliteMapProps) {
  const tokens = useTokens();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const rectangleRef = useRef<L.Rectangle | null>(null);
  const markersRef = useRef(new globalThis.Map<string, L.Marker>());
  const onMapPressRef = useRef(onMapPress);
  const onPinPressRef = useRef(onPinPress);
  useEffect(() => {
    onMapPressRef.current = onMapPress;
    onPinPressRef.current = onPinPress;
  }, [onMapPress, onPinPress]);

  const key = boundsKey(bounds);

  // Karte einmalig erzeugen. Leaflet lädt Kacheln ohne Worker/asynchrone Style-Auflösung,
  // daher können Rechteck und Pins in eigenen Effekten sofort synchron gesetzt werden.
  useEffect(() => {
    if (!containerRef.current) return;
    const map = L.map(containerRef.current, { attributionControl: true, zoomControl: true, scrollWheelZoom });
    L.tileLayer(ESRI_IMAGERY_TILE_URL, { maxZoom: MAX_TILE_ZOOM, attribution: TILE_ATTRIBUTION }).addTo(map);
    L.tileLayer(ESRI_LABELS_TILE_URL, { maxZoom: MAX_TILE_ZOOM }).addTo(map);

    if (bounds) {
      map.fitBounds(
        [
          [bounds.south, bounds.west],
          [bounds.north, bounds.east],
        ],
        { padding: [40, 40] },
      );
    } else {
      map.setView(center ? [center[1], center[0]] : DEFAULT_CENTER_LATLNG, center ? zoom : DEFAULT_ZOOM);
    }

    map.on('click', (event: L.LeafletMouseEvent) => {
      onMapPressRef.current?.([event.latlng.lng, event.latlng.lat]);
    });

    mapRef.current = map;

    const resizeObserver = new ResizeObserver(() => map.invalidateSize());
    resizeObserver.observe(containerRef.current);

    const markers = markersRef.current;
    return () => {
      resizeObserver.disconnect();
      map.remove();
      mapRef.current = null;
      rectangleRef.current = null;
      markers.clear();
    };
    // Karte wird nur einmal erzeugt; die Startansicht liest `bounds`/`center` initial,
    // spätere Änderungen laufen über die eigenen Effekte unten.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (rectangleRef.current) {
      map.removeLayer(rectangleRef.current);
      rectangleRef.current = null;
    }
    if (bounds) {
      const corners: L.LatLngBoundsExpression = [
        [bounds.south, bounds.west],
        [bounds.north, bounds.east],
      ];
      rectangleRef.current = L.rectangle(corners, {
        color: '#C59A4A',
        weight: 3,
        fillColor: '#556B2F',
        fillOpacity: 0.18,
      }).addTo(map);
      if (!focus && !fitToPins) {
        map.fitBounds(corners, { padding: [40, 40] });
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- keyed by value via `key`, not object reference
  }, [key]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const staleIds = new Set(markersRef.current.keys());
    pins.forEach((pin) => {
      staleIds.delete(pin.id);
      const existing = markersRef.current.get(pin.id);
      if (existing) {
        existing.setLatLng([pin.coordinate[1], pin.coordinate[0]]);
        existing.setIcon(buildPinIcon(pin, tokens));
        return;
      }
      const marker = L.marker([pin.coordinate[1], pin.coordinate[0]], { icon: buildPinIcon(pin, tokens) }).addTo(map);
      marker.on('click', (event) => {
        L.DomEvent.stopPropagation(event);
        onPinPressRef.current?.(pin.id);
      });
      markersRef.current.set(pin.id, marker);
    });
    staleIds.forEach((id) => {
      const marker = markersRef.current.get(id);
      if (!marker) return;
      map.removeLayer(marker);
      markersRef.current.delete(id);
    });
  }, [pins, tokens]);

  // Live-Ansicht: Ausschnitt auf Gelände + alle Pins. Nach Wert geschlüsselt, damit
  // ein Neu-Rendern mit gleichen Koordinaten den vom Nutzer gewählten Ausschnitt nicht zurücksetzt.
  const fitKey = fitToPins ? `${key}|${pins.map((p) => p.coordinate.join(',')).sort().join(';')}` : '';
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !fitToPins) return;
    const points: L.LatLngExpression[] = pins.map((p) => [p.coordinate[1], p.coordinate[0]]);
    if (bounds) points.push([bounds.south, bounds.west], [bounds.north, bounds.east]);
    if (points.length === 0) return;
    // Container-Größe neu messen: Die Karte wird oft vor ihrem endgültigen
    // Layout erzeugt und passte sonst auf eine veraltete Höhe ein.
    map.invalidateSize();
    // Beschriftungen stehen zentriert über dem Pin: seitlich/oben mehr Rand.
    map.fitBounds(L.latLngBounds(points), { paddingTopLeft: [80, 64], paddingBottomRight: [80, 24], maxZoom: 18 });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- keyed by value via `fitKey`
  }, [fitKey]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !focus) return;
    map.flyTo([focus.center[1], focus.center[0]], focus.zoom ?? 16);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- keyed by value, `focus` is a fresh object each render
  }, [focus?.center[0], focus?.center[1], focus?.zoom]);

  return (
    <View style={{ height, borderRadius: 22, overflow: 'hidden' }}>
      <div ref={containerRef} style={{ width: '100%', height: '100%' }} />
    </View>
  );
}
