import type { ImperativeRouter } from 'expo-router';

/**
 * Führt nach Verlassen oder Zurücksetzen zurück zum Codebeitritt und räumt
 * dabei den Stationsstapel ab. Ein bloßes `replace` ließe Tagesplan, Karte
 * oder Cockpit darunter liegen — eine Zurück-Geste führte dann in einen
 * Screen ohne Veranstaltung.
 */
export function resetToJoin(router: ImperativeRouter) {
  if (router.canDismiss()) router.dismissAll();
  router.replace('/join');
}
