import * as Crypto from 'expo-crypto';
import { Platform } from 'react-native';
import { supabase } from '@/lib/supabase';
import * as store from './store';

/**
 * Geräteidentität und Codebeitritt. Ein Gerät bekommt eine feste, lokal
 * erzeugte UUID; der Digest-Vergleich des Codes läuft serverseitig über
 * `redeem_access_code` (docs/datenkonzept.md Abschnitt 8).
 */

function makeLabel() {
  const platform = Platform.OS === 'ios' ? 'iPhone/iPad' : Platform.OS === 'android' ? 'Android-Gerät' : 'Web-Gerät';
  const suffix = Crypto.randomUUID().slice(0, 4).toUpperCase();
  return `${platform} · ${suffix}`;
}

export async function getDevice() {
  return store.getOrCreateDevice(() => Crypto.randomUUID(), makeLabel);
}

export type JoinResult =
  | { ok: true; eventId: string; accessId: string }
  | { ok: false; error: string };

/**
 * Löst einen Veranstaltungscode ein: meldet das Gerät anonym an (falls nötig)
 * und ruft `redeem_access_code`. Eine bereits angemeldete Organisatorsitzung
 * wird nicht automatisch ersetzt — das ruft der Aufrufer vorher ab.
 */
export async function redeemCode(code: string): Promise<JoinResult> {
  const device = await getDevice();

  const { data: sessionData } = await supabase.auth.getSession();
  if (!sessionData.session) {
    const { error: signInError } = await supabase.auth.signInAnonymously();
    if (signInError) return { ok: false, error: signInError.message };
  }

  const { data, error } = await supabase.rpc('redeem_access_code', {
    p_code: code,
    p_device_id: device.id,
    p_device_label: device.label,
  });
  if (error) return { ok: false, error: error.message };
  if (!data) return { ok: false, error: 'invalid or expired access code' };

  await store.ensureStationState(data.event_id, data.id);
  return { ok: true, eventId: data.event_id, accessId: data.id };
}

/** True, wenn die aktuelle Sitzung eine anonyme Stationssitzung ist. */
export async function isStationSession() {
  const { data } = await supabase.auth.getSession();
  return Boolean(data.session?.user.is_anonymous);
}

export async function sha256(input: string) {
  return Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, input);
}
