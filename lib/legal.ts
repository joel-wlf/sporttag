/**
 * Angaben für Datenschutz- und Supportseite. Sie kommen aus öffentlichen
 * Client-Variablen (kein Geheimnis, die Seiten sind ohnehin öffentlich) und
 * müssen vor der Store-Veröffentlichung gesetzt sein:
 *
 *   EXPO_PUBLIC_SUPPORT_EMAIL=...
 *   EXPO_PUBLIC_LEGAL_CONTROLLER="Name, Straße Nr., PLZ Ort"
 */
export const SUPPORT_EMAIL = process.env.EXPO_PUBLIC_SUPPORT_EMAIL?.trim() || undefined;
export const LEGAL_CONTROLLER = process.env.EXPO_PUBLIC_LEGAL_CONTROLLER?.trim() || undefined;

export const POLICY_UPDATED = '3. Oktober 2026';
