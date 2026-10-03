import type { EventMap } from '@/lib/api/maps';

export type LocalMap = { uri: string; map: EventMap };

// Web speichert kein Kartenbild lokal; die Stationskarte nutzt dort die Online-Karte.
export async function loadLocalMap(_eventId: string): Promise<LocalMap | null> {
  return null;
}

export async function syncMapAsset(_eventId: string): Promise<LocalMap | null> {
  return null;
}
