import type { Bounds } from '@/components/map/types';

export const TILE_SIZE = 256;
const MAX_LAT = 85.0511;

export type BakePlan = {
  zoom: number;
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  widthPx: number;
  heightPx: number;
  /** An den Kachelrand gelegte Grenzen des fertigen Bildes (WGS84). */
  bounds: Bounds;
};

export function lngToTileX(lng: number, zoom: number) {
  return ((lng + 180) / 360) * 2 ** zoom;
}

export function latToTileY(lat: number, zoom: number) {
  const rad = (Math.max(-MAX_LAT, Math.min(MAX_LAT, lat)) * Math.PI) / 180;
  return ((1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2) * 2 ** zoom;
}

export function tileXToLng(x: number, zoom: number) {
  return (x / 2 ** zoom) * 360 - 180;
}

export function tileYToLat(y: number, zoom: number) {
  const n = Math.PI - (2 * Math.PI * y) / 2 ** zoom;
  return (180 / Math.PI) * Math.atan(0.5 * (Math.exp(n) - Math.exp(-n)));
}

/**
 * Wählt die höchste Zoomstufe, bei der das Gelände samt Rand in ein Bild
 * passt, dessen längste Seite `maxSidePx` nicht überschreitet (Texturgrenze
 * mobiler Geräte). Das Bild deckt ganze Kacheln ab; die zurückgegebenen
 * Grenzen sind deshalb exakt die Kachelränder, nicht die Wunschgrenzen.
 */
export function planBake(
  venue: Bounds,
  options: { margin?: number; maxZoom?: number; maxSidePx?: number } = {},
): BakePlan {
  const { margin = 0.15, maxZoom = 18, maxSidePx = 4096 } = options;
  const latPad = (venue.north - venue.south) * margin;
  const lngPad = (venue.east - venue.west) * margin;
  const north = Math.min(MAX_LAT, venue.north + latPad);
  const south = Math.max(-MAX_LAT, venue.south - latPad);
  const east = Math.min(180, venue.east + lngPad);
  const west = Math.max(-180, venue.west - lngPad);

  for (let zoom = maxZoom; zoom >= 1; zoom--) {
    const last = 2 ** zoom - 1;
    const x0 = Math.max(0, Math.floor(lngToTileX(west, zoom)));
    const x1 = Math.min(last, Math.floor(lngToTileX(east, zoom)));
    const y0 = Math.max(0, Math.floor(latToTileY(north, zoom)));
    const y1 = Math.min(last, Math.floor(latToTileY(south, zoom)));
    const widthPx = (x1 - x0 + 1) * TILE_SIZE;
    const heightPx = (y1 - y0 + 1) * TILE_SIZE;
    if (widthPx <= maxSidePx && heightPx <= maxSidePx) {
      return {
        zoom,
        x0,
        y0,
        x1,
        y1,
        widthPx,
        heightPx,
        bounds: {
          north: tileYToLat(y0, zoom),
          south: tileYToLat(y1 + 1, zoom),
          east: tileXToLng(x1 + 1, zoom),
          west: tileXToLng(x0, zoom),
        },
      };
    }
  }
  throw new Error('Das Gelände ist für ein Kartenbild zu groß.');
}

/** Zoomstufe, bei der ein Bild dieser Breite pixelgenau (1:1) dargestellt wird. */
export function nativeZoomOfImage(widthPx: number, west: number, east: number) {
  return Math.log2((widthPx * 360) / ((east - west) * TILE_SIZE));
}
