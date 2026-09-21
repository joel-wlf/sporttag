// Offene, tokenfreie Kartenquellen: Esri World Imagery (Satellitenbild) plus die
// Esri-Referenzebene "World Boundaries and Places" (Orts-/Straßennamen, Grenzen)
// als transparentes Overlay darüber. Beide sind öffentliche ArcGIS-Online-Dienste
// ohne Account/API-Key. Adress-/Ortssuche läuft über Nominatim (OpenStreetMap).

export const ESRI_IMAGERY_TILE_URL = 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';
export const ESRI_LABELS_TILE_URL = 'https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}';
export const TILE_ATTRIBUTION = 'Tiles © Esri — Esri, Maxar, Earthstar Geographics, GIS User Community · © OpenStreetMap';
export const MAX_TILE_ZOOM = 19;

/** Reines Raster-Style-JSON für MapLibre (nativ): zwei übereinandergelegte Kachel-Ebenen. */
export function buildSatelliteStyle() {
  return {
    version: 8 as const,
    sources: {
      imagery: {
        type: 'raster' as const,
        tiles: [ESRI_IMAGERY_TILE_URL],
        tileSize: 256,
        maxzoom: MAX_TILE_ZOOM,
        attribution: TILE_ATTRIBUTION,
      },
      labels: {
        type: 'raster' as const,
        tiles: [ESRI_LABELS_TILE_URL],
        tileSize: 256,
        maxzoom: MAX_TILE_ZOOM,
      },
    },
    layers: [
      { id: 'imagery', type: 'raster' as const, source: 'imagery' },
      { id: 'labels', type: 'raster' as const, source: 'labels' },
    ],
  };
}

export type GeocodeResult = {
  id: string;
  name: string;
  coordinate: [number, number];
};

/** Sucht Orte/Adressen über Nominatim (OpenStreetMap), um die Karte dorthin zu zentrieren. */
export async function geocodePlace(query: string): Promise<GeocodeResult[]> {
  const trimmed = query.trim();
  if (!trimmed) return [];
  const url = `https://nominatim.openstreetmap.org/search?format=json&addressdetails=0&limit=5&accept-language=de&q=${encodeURIComponent(trimmed)}`;
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Suche fehlgeschlagen (${response.status}).`);
  const data = (await response.json()) as { place_id: number; display_name: string; lat: string; lon: string }[];
  return data.map((result) => ({
    id: String(result.place_id),
    name: result.display_name,
    coordinate: [Number(result.lon), Number(result.lat)],
  }));
}
