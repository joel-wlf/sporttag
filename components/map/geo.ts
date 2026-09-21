import type { Bounds, LngLat } from './types';

/** Baut ein geschlossenes Rechteck-Polygon (GeoJSON) aus WGS84-Grenzen. */
export function boundsToPolygonFeature(bounds: Bounds): GeoJSON.Feature<GeoJSON.Polygon> {
  const { north, south, east, west } = bounds;
  return {
    type: 'Feature',
    properties: {},
    geometry: {
      type: 'Polygon',
      coordinates: [
        [
          [west, south],
          [east, south],
          [east, north],
          [west, north],
          [west, south],
        ],
      ],
    },
  };
}

/** Bildet aus zwei angetippten Ecken ein achsenparalleles Rechteck. */
export function boundsFromCorners(a: LngLat, b: LngLat): Bounds {
  return {
    north: Math.max(a[1], b[1]),
    south: Math.min(a[1], b[1]),
    east: Math.max(a[0], b[0]),
    west: Math.min(a[0], b[0]),
  };
}

export function boundsCenter(bounds: Bounds): LngLat {
  return [(bounds.east + bounds.west) / 2, (bounds.north + bounds.south) / 2];
}

/** Stabiler Vergleichsschlüssel, um unnötige Kamera-Refits bei gleichbleibenden Grenzen zu vermeiden. */
export function boundsKey(bounds: Bounds | null | undefined): string {
  if (!bounds) return 'none';
  return `${bounds.north},${bounds.south},${bounds.east},${bounds.west}`;
}
