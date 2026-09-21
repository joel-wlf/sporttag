const ATTRIBUTION = '© Mapbox © OpenStreetMap';

export function getMapboxAccessToken(): string | null {
  return process.env.EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN || null;
}

type MapboxSource = {
  type: string;
  url?: string;
  tiles?: string[];
  tileSize?: number;
  attribution?: string;
};

export type MapboxStyleJson = {
  version: number;
  sources: Record<string, MapboxSource>;
  glyphs?: string;
  sprite?: string;
  layers: unknown[];
  [key: string]: unknown;
};

const styleCache = new Map<string, Promise<MapboxStyleJson>>();

/**
 * Lädt den öffentlichen Mapbox-Style "Satellite Streets" (Satellitenbild plus
 * Straßen- und Ortsbeschriftung) und löst dessen `mapbox://`-Referenzen in echte
 * HTTPS-URLs auf: MapLibre kennt dieses Schema nicht, nur der Mapbox-eigene
 * GL-JS-Client kann es intern auflösen. Das Sprite-Icon-Set wird dabei bewusst
 * verworfen (das Anhängen von `.json`/`@2x.png` an eine bereits mit `?access_token=`
 * versehene URL ergäbe eine ungültige Anfrage); Text-Beschriftungen hängen nur an
 * `glyphs`, nicht an `sprite`, und bleiben davon unberührt.
 */
export function fetchSatelliteStreetsStyle(accessToken: string): Promise<MapboxStyleJson> {
  const cached = styleCache.get(accessToken);
  if (cached) return cached;

  const promise = fetch(`https://api.mapbox.com/styles/v1/mapbox/satellite-streets-v12?access_token=${accessToken}`)
    .then((response) => {
      if (!response.ok) throw new Error(`Mapbox-Style konnte nicht geladen werden (${response.status}).`);
      return response.json() as Promise<MapboxStyleJson>;
    })
    .then((style) => {
      const sources = Object.fromEntries(
        Object.entries(style.sources).map(([id, source]) => {
          if (typeof source.url === 'string' && source.url.startsWith('mapbox://')) {
            const tilesetId = source.url.replace('mapbox://', '');
            return [
              id,
              { ...source, url: `https://api.mapbox.com/v4/${tilesetId}.json?secure&access_token=${accessToken}` },
            ] as const;
          }
          return [id, source] as const;
        }),
      );
      return {
        ...style,
        sources,
        glyphs: `https://api.mapbox.com/fonts/v1/mapbox/{fontstack}/{range}.pbf?access_token=${accessToken}`,
        sprite: undefined,
        attribution: ATTRIBUTION,
      };
    });

  styleCache.set(accessToken, promise);
  return promise;
}

export type GeocodeResult = {
  id: string;
  name: string;
  coordinate: [number, number];
};

/** Sucht Orte/Adressen über die Mapbox-Geocoding-API, um die Karte dorthin zu zentrieren. */
export async function geocodePlace(accessToken: string, query: string): Promise<GeocodeResult[]> {
  const trimmed = query.trim();
  if (!trimmed) return [];
  const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(trimmed)}.json?access_token=${accessToken}&language=de&limit=5`;
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Suche fehlgeschlagen (${response.status}).`);
  const data = (await response.json()) as {
    features?: { id: string; place_name: string; center: [number, number] }[];
  };
  return (data.features ?? []).map((feature) => ({
    id: feature.id,
    name: feature.place_name,
    coordinate: feature.center,
  }));
}
