import * as Crypto from 'expo-crypto';
import { Directory, File, Paths } from 'expo-file-system';
import type { EventMap } from '@/lib/api/maps';
import { supabase } from '@/lib/supabase';

/**
 * Lokale Kopie des Offline-Kartenbildes. Das Bild wird erst nach erfolgreicher
 * Prüfsummenprüfung an seinen endgültigen Platz verschoben; die Metadaten
 * (`<eventId>.json`) werden erst danach geschrieben. Ein abgebrochener oder
 * beschädigter Download hinterlässt deshalb nie eine als vollständig geltende
 * Karte. Siehe docs/datenkonzept.md Abschnitt "Offline-Kartenbild".
 */

export type LocalMap = { uri: string; map: EventMap };

const EXTENSIONS: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };

function mapDirectory() {
  return new Directory(Paths.document, 'event-maps');
}

function metaFile(eventId: string) {
  return new File(mapDirectory(), `${eventId}.json`);
}

function imageFile(map: EventMap) {
  return new File(mapDirectory(), `${map.content_hash}.${EXTENSIONS[map.mime_type] ?? 'jpg'}`);
}

export async function loadLocalMap(eventId: string): Promise<LocalMap | null> {
  try {
    const meta = metaFile(eventId);
    if (!meta.exists) return null;
    const map = JSON.parse(await meta.text()) as EventMap;
    const image = imageFile(map);
    if (!image.exists || !image.size) return null;
    return { uri: image.uri, map };
  } catch {
    return null;
  }
}

/**
 * Löscht nur Bilder, auf die keine Karten-Metadatei mehr zeigt. Früher fiel
 * jedes andere Bild weg — auch die Offline-Karte einer zweiten Veranstaltung
 * auf demselben Gerät.
 */
async function removeUnreferencedImages() {
  const items = mapDirectory().list();
  const referenced = new Set<string>();
  for (const item of items) {
    if (!(item instanceof File) || !item.uri.endsWith('.json')) continue;
    try {
      referenced.add(imageFile(JSON.parse(await item.text()) as EventMap).uri);
    } catch {
      // unlesbare Metadatei: zugehöriges Bild bleibt im Zweifel erhalten
      return;
    }
  }
  for (const item of items) {
    if (item instanceof File && !item.uri.endsWith('.json') && !referenced.has(item.uri)) item.delete();
  }
}

function toHex(buffer: ArrayBuffer) {
  return Array.from(new Uint8Array(buffer), (b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Gleicht die lokale Karte mit dem aktiven Kartenstand des Servers ab. Ist
 * der Server nicht erreichbar, wirft die Funktion und lässt die vorhandene
 * lokale Karte unberührt. Liefert `null`, wenn die Veranstaltung keine Karte hat.
 */
export async function syncMapAsset(eventId: string): Promise<LocalMap | null> {
  const { data, error } = await supabase.rpc('get_event_map', { p_event_id: eventId });
  if (error) throw error;
  const remote = data as EventMap | null;

  if (!remote) {
    const meta = metaFile(eventId);
    if (meta.exists) meta.delete();
    return null;
  }

  const existing = await loadLocalMap(eventId);
  if (existing && existing.map.content_hash === remote.content_hash) return existing;

  const signed = await supabase.storage.from('event-maps').createSignedUrl(remote.asset_path, 300);
  if (signed.error) throw signed.error;

  const temp = new File(Paths.cache, `map-${remote.content_hash}.download`);
  if (temp.exists) temp.delete();
  await File.downloadFileAsync(signed.data.signedUrl, temp);

  const digest = toHex(await Crypto.digest(Crypto.CryptoDigestAlgorithm.SHA256, await temp.bytes()));
  if (digest !== remote.content_hash) {
    temp.delete();
    throw new Error('Kartenbild beschädigt: Prüfsumme stimmt nicht.');
  }

  mapDirectory().create({ intermediates: true, idempotent: true });
  const target = imageFile(remote);
  if (target.exists) target.delete();
  temp.move(target);

  const meta = metaFile(eventId);
  if (!meta.exists) meta.create();
  meta.write(JSON.stringify(remote));

  await removeUnreferencedImages();
  return { uri: target.uri, map: remote };
}
