import { Linking } from 'react-native';

export type EmergencyKind = 'assistance' | 'medical';

export type CallResult = 'started' | 'unavailable' | 'not_configured';

const numbers: Record<EmergencyKind, string | undefined> = {
  assistance: process.env.EXPO_PUBLIC_ASSISTANCE_PHONE,
  medical: process.env.EXPO_PUBLIC_MEDICAL_PHONE,
};

export const emergencyNumber = (kind: EmergencyKind) => numbers[kind];

/**
 * Startet einen nativen Anruf auf die in der Umgebung hinterlegte Nummer.
 * Auf Web öffnet `tel:` den Telefon-Handler des Systems, sofern vorhanden.
 */
export async function callEmergency(kind: EmergencyKind): Promise<CallResult> {
  const raw = numbers[kind];
  if (!raw) return 'not_configured';
  const tel = `tel:${raw.replace(/[^\d+]/g, '')}`;
  try {
    await Linking.openURL(tel);
    return 'started';
  } catch {
    return 'unavailable';
  }
}
