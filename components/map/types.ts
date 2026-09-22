import type { VenueBounds } from '@/lib/api/events';

/** [longitude, latitude], wie von MapLibre/Mapbox erwartet. */
export type LngLat = [number, number];

export type Bounds = VenueBounds;

export type MapPin = {
  id: string;
  coordinate: LngLat;
  label?: string;
  selected?: boolean;
  /** Überschreibt die Standardfarbe des Pins, z. B. für Statusanzeigen. */
  color?: string;
  /** Kurzes Badge oben rechts am Pin, z. B. „!“ für offene Klärung. */
  badge?: string;
  /** Kleiner Punktestand-Chip oberhalb des Pins, z. B. „12:8“, für die Live-Karte. */
  scoreLabel?: string;
};

export type MapFocus = { center: LngLat; zoom?: number };

export type SatelliteMapProps = {
  /** Gelände-Rechteck; wird als Polygon eingezeichnet und für die Anfangsansicht genutzt. */
  bounds?: Bounds | null;
  /** Kartenmittelpunkt, falls kein `bounds` vorliegt. */
  center?: LngLat;
  /** Zoomstufe, falls kein `bounds` vorliegt. */
  zoom?: number;
  /** Springt/fliegt zu dieser Position, z. B. nach einer Ortssuche. Hat Vorrang vor `bounds`. */
  focus?: MapFocus | null;
  pins?: MapPin[];
  onPinPress?: (id: string) => void;
  /** Wenn gesetzt, liefert ein Tap auf die Karte die getippte Koordinate. */
  onMapPress?: (coordinate: LngLat) => void;
  height?: number;
  /** Mausrad zoomt die Karte (Standard). `false` lässt das Mausrad die Seite scrollen (nur Web). */
  scrollWheelZoom?: boolean;
  /** Ausschnitt so wählen, dass Gelände und alle Pins sichtbar sind (statt nur das Gelände). */
  fitToPins?: boolean;
};
