import { PostgrestError } from '@supabase/supabase-js';

/**
 * Übersetzt bekannte Postgres-/PostgREST-Fehler in deutsche, für
 * Organisatoren verständliche Meldungen. Unbekannte Fehler geben die
 * Originalmeldung zurück, damit nichts verschwiegen wird.
 */
export function friendlyErrorMessage(error: unknown): string {
  if (isPostgrestError(error)) {
    const message = error.message ?? '';
    if (message.includes('block overlaps')) return 'Der Zeitraum überschneidet sich mit einem anderen Block.';
    if (message.includes('round overlaps')) return 'Die Runde überschneidet sich mit einer anderen Runde im selben Block.';
    if (message.includes('round is not within its block bounds')) return 'Die Runde liegt außerhalb ihres Blocks.';
    if (message.includes('matches cannot be scheduled in a break round')) return 'In einer Pausenrunde können keine Matches angelegt werden.';
    if (message.includes('match round and station setup must belong to the same block')) return 'Runde und Stationsbelegung gehören zu unterschiedlichen Blöcken.';
    if (message.includes('team is already scheduled in this round')) return 'Dieses Team ist in dieser Runde bereits eingeplant.';
    if (message.includes('station has no game in this block')) return 'Wähle zuerst ein Spiel für diese Station im Block.';
    if (message.includes('station setup still has matches')) return 'An dieser Station sind in diesem Block noch Teams eingetragen. Leere zuerst die Zellen.';
    if (message.includes('too many teams for this game')) return 'Für dieses Spiel sind zu viele Teams eingetragen.';
    if (message.includes('existing matches have more teams than the game allows')) return 'Das Spiel erlaubt weniger Teams, als in diesem Block bereits eingetragen sind.';
    if (message.includes('event is no longer a draft, this field is locked')) return 'Die Veranstaltung ist veröffentlicht; dieses Feld ist gesperrt.';
    if (message.includes('invalid or expired access code')) return 'Der Veranstaltungscode ist ungültig oder abgelaufen.';
    if (message.includes('too many attempts')) return 'Zu viele Versuche. Bitte in einigen Minuten erneut versuchen.';
    if (message.includes('cannot remove the last active organizer')) return 'Der letzte aktive Organisator kann nicht entfernt werden.';
    if (message.includes('no organizer account found for this email')) return 'Für diese E-Mail-Adresse existiert kein Organisatorenkonto.';
    if (message.includes('only draft events can be deleted')) return 'Nur Entwürfe können gelöscht werden.';
    if (message.includes('only draft events can be published')) return 'Nur Entwürfe können veröffentlicht werden.';
    if (message.includes('event has submissions, cannot return to draft')) return 'Es liegen bereits Ergebnisabgaben vor; die Veranstaltung kann nicht zurück in den Entwurf.';
    if (message.includes('event is not ready to publish')) return 'Die Veranstaltung erfüllt noch nicht alle Voraussetzungen für die Veröffentlichung.';
    if (message.includes('organizer membership required')) return 'Dafür ist eine Organisatoren-Mitgliedschaft nötig.';
    if (message.includes('organizer account required')) return 'Dafür ist ein persönliches Organisatorenkonto nötig.';
    if (message.includes('result_version_changed')) return 'Der Ergebnisstand hat sich zwischenzeitlich geändert. Bitte neu laden und erneut prüfen.';
    if (message.includes('reason_required')) return 'Bitte eine Begründung angeben.';
    if (message.includes('ties_not_allowed')) return 'Für dieses Spiel sind Unentschieden nicht erlaubt.';
    if (message.includes('match is cancelled')) return 'Für ein abgesagtes Match kann kein Ergebnis erfasst werden.';
    if (
      message.includes('exactly one value per match participant') ||
      message.includes('invalid participant') ||
      message.includes('duplicate participants')
    ) {
      return 'Die Ergebniswerte passen nicht zu den Teilnehmenden dieses Matches.';
    }
    if (error.code === '23505') return 'Dieser Eintrag existiert bereits.';
    if (error.code === '23503') {
      const details = error.details ?? '';
      if (details.includes('station_setups')) {
        return 'Diese Station ist noch für ein Spiel in einem Block eingeteilt. Entferne zuerst die Zuordnung im Zeitplan, bevor du die Station löschst.';
      }
      // 23503 = foreign_key_violation: Löschen blockiert, weil ein anderer Eintrag noch darauf verweist –
      // nicht, weil etwas fehlt. Die alte Meldung "Verknüpfter Eintrag nicht gefunden" behauptete fälschlich das Gegenteil.
      return 'Dieser Eintrag wird an anderer Stelle noch verwendet und kann deshalb nicht gelöscht werden.';
    }
    if (error.code === '42501') return 'Keine Berechtigung für diese Aktion.';
    return message || 'Unbekannter Datenbankfehler.';
  }
  if (error instanceof Error) return error.message;
  return 'Unbekannter Fehler.';
}

function isPostgrestError(error: unknown): error is PostgrestError {
  return Boolean(error && typeof error === 'object' && 'message' in error && 'code' in error);
}
