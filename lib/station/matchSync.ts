import * as store from './store';
import { isSettledReceipt } from './syncCounts';

/**
 * Übertragungsstand der jeweils letzten lokalen Abgabe je Match — getrennt
 * nach lokal gesichert (`pending`), zentral angenommen (`synced`) und
 * Klärungsbedarf (`review`), wie es docs/datenkonzept.md verlangt. Der
 * Matchstatus aus dem Paket allein sagt nichts über dieses Gerät aus.
 */
export type MatchSyncStatus = 'pending' | 'review' | 'synced';

export type MatchSyncEntry = {
  status: MatchSyncStatus;
  requestId: string;
  capturedAt: string;
};

export async function loadMatchSync(eventId: string): Promise<Record<string, MatchSyncEntry>> {
  const [outbox, submissions] = await Promise.all([
    store.loadOutbox(eventId),
    store.loadResultSubmissions(eventId),
  ]);
  const entries = new Map(outbox.filter((entry) => entry.kind === 'result').map((entry) => [entry.requestId, entry]));
  const byMatch: Record<string, MatchSyncEntry> = {};
  // Nach lokaler Sequenz sortiert: die spätere Abgabe desselben Matches gewinnt.
  for (const submission of submissions) {
    const entry = entries.get(submission.requestId);
    const status: MatchSyncStatus =
      entry?.state !== 'received' ? 'pending' : isSettledReceipt(entry.receiptStatus) ? 'synced' : 'review';
    byMatch[submission.matchId] = { status, requestId: submission.requestId, capturedAt: submission.capturedAt };
  }
  return byMatch;
}
