import type { OutboxEntry, SyncCounts } from './types';

/**
 * Angenommen oder von der Leitung geklärt: für das Gerät erledigt. Geklärt
 * heißt übernommen oder bewusst verworfen — beides braucht an der Station
 * nichts mehr.
 */
export function isSettledReceipt(status: string | null | undefined) {
  return status === 'accepted' || status === 'resolved';
}

export const emptySyncCounts: SyncCounts = {
  pending: 0,
  sending: 0,
  review: 0,
  synced: 0,
  failed: 0,
  lastError: null,
};

/**
 * Zählt den Übertragungsstand der Outbox. Ergebnisse zählen als ausstehend,
 * geklärt oder übertragen; abgelehnte Einträge (auch Check-ins, von denen
 * Ergebnisse abhängen) werden zusätzlich mit ihrer letzten Meldung gezeigt.
 */
export function countOutbox(outbox: OutboxEntry[]): SyncCounts {
  const counts = { ...emptySyncCounts };
  for (const entry of outbox) {
    // "[object Object]" stammt aus älteren Versionen, die Netzfehler nicht
    // lesen konnten; das ist keine Ablehnung durch den Server.
    if (
      entry.state !== 'received' &&
      entry.lastError &&
      entry.lastError !== '[object Object]' &&
      entry.attemptCount > 0
    ) {
      counts.failed += 1;
      counts.lastError = entry.lastError;
    }
    if (entry.kind !== 'result') continue;
    if (entry.state === 'pending') counts.pending += 1;
    else if (entry.state === 'sending') counts.sending += 1;
    else if (isSettledReceipt(entry.receiptStatus)) counts.synced += 1;
    else counts.review += 1;
  }
  return counts;
}
