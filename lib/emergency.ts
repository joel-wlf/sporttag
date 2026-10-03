import { Linking } from 'react-native';
import type { PackageEvent } from '@/lib/station/types';

export type EmergencyKind = 'assistance' | 'medical';

export type CallResult = 'started' | 'unavailable' | 'not_configured';

/**
 * Hilfe-Rufnummer aus den Event-Einstellungen. Sie reist im Offline-Paket mit
 * und ist damit auch ohne Netz verfügbar. Früher kam sie aus
 * EXPO_PUBLIC_*-Variablen, also einer Nummer pro App-Build statt pro Event.
 */
export function emergencyNumber(
  event: Pick<PackageEvent, 'assistance_phone' | 'medical_phone'> | null | undefined,
  kind: EmergencyKind,
) {
  const raw = kind === 'assistance' ? event?.assistance_phone : event?.medical_phone;
  return raw?.trim() || undefined;
}

/**
 * Wählbare Form einer eingegebenen Nummer. Die übliche Schreibweise
 * "+49 (0)151 …" ergab bisher "+490151…", also eine falsche Nummer: die
 * eingeklammerte Null nach einer Ländervorwahl entfällt beim Wählen.
 */
export function dialableNumber(raw: string) {
  const withoutTrunkZero = raw.trim().startsWith('+') ? raw.replace(/\(\s*0\s*\)/g, '') : raw;
  return withoutTrunkZero.replace(/[^\d+]/g, '');
}

/**
 * Startet einen nativen Anruf. Ein nicht gestarteter Anruf wird nie als
 * Erfolg gemeldet (AGENTS.md): ohne Nummer `not_configured`, bei Fehlern
 * `unavailable`. Auf Web öffnet `tel:` den Telefon-Handler des Systems.
 */
export async function callNumber(raw: string | undefined): Promise<CallResult> {
  if (!raw) return 'not_configured';
  const digits = dialableNumber(raw);
  if (!/\d{3,}/.test(digits)) return 'not_configured';
  const tel = `tel:${digits}`;
  try {
    await Linking.openURL(tel);
    return 'started';
  } catch {
    return 'unavailable';
  }
}
