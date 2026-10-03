/// <reference types="node" />
import assert from 'node:assert/strict';
import { test } from 'node:test';
import * as store from '@/lib/station/store';

/**
 * Lokaler Speicher unter gleichzeitigen Zugriffen (docs/datenkonzept.md
 * 11.2): Abgaben laufen, während Check-ins gespeichert und Sync-Status
 * übernommen werden. Vor dem Fix scheiterten dabei Abgaben, und manche lagen
 * ohne Übertragungsauftrag auf dem Gerät.
 */
test('Abgaben parallel zu Check-ins und Statusabgleich: nichts geht verloren, Sequenz lückenlos', async () => {
  await store.ensureStationState('E', 'acc');
  const base = {
    eventId: 'E',
    matchId: 'm',
    checkinId: 'c0',
    baseResultVersion: 0,
    planVersion: 1,
    payload: { values: [] },
    payloadHash: 'h',
    capturedAt: '2026-10-03T08:00:00Z',
    reason: null,
  };
  const outcomes: PromiseSettledResult<number>[] = [];
  const saves = (async () => {
    for (let i = 0; i < 15; i += 1) {
      outcomes.push(...(await Promise.allSettled([store.saveResultSubmission({ ...base, requestId: `r${i}` })])));
    }
  })();
  const noise = (async () => {
    for (let i = 0; i < 15; i += 1) {
      await Promise.allSettled([
        store.saveCheckin({
          id: `c${i}`,
          eventId: 'E',
          stationSetupId: 's',
          checkedInAt: '2026-10-03T08:00:00Z',
          checkedOutAt: null,
          staffIds: [],
        }),
        store.updateReceiptStatus(`r${i}`, 'resolved'),
      ]);
    }
  })();
  await Promise.all([saves, noise]);

  assert.equal(outcomes.filter((o) => o.status === 'rejected').length, 0);
  const submissions = await store.loadResultSubmissions('E');
  const outbox = (await store.loadOutbox('E')).filter((o) => o.kind === 'result');
  assert.equal(submissions.length, 15);
  assert.equal(outbox.length, 15);
  assert.deepEqual(
    submissions.map((s) => s.localSequence),
    Array.from({ length: 15 }, (_, i) => i + 1),
  );
  assert.equal((await store.getStationState('E'))?.nextSequence, 16);
});

test('Sequenz wiederholt nie eine Nummer, auch ohne Stationszustand', async () => {
  const base = {
    eventId: 'F',
    matchId: 'm',
    checkinId: 'c',
    baseResultVersion: 0,
    planVersion: 1,
    payload: { values: [] },
    payloadHash: 'h',
    capturedAt: 'x',
    reason: null,
  };
  const first = await store.saveResultSubmission({ ...base, requestId: 'f1' });
  const second = await store.saveResultSubmission({ ...base, requestId: 'f2' });
  assert.deepEqual([first, second], [1, 2]);
});

test('erster Start: parallele Geräteabfragen liefern dieselbe Geräte-ID', async () => {
  let n = 0;
  const ids = await Promise.all(
    Array.from({ length: 5 }, () => store.getOrCreateDevice(() => `d${(n += 1)}`, () => 'Label')),
  );
  assert.equal(new Set(ids.map((d) => d.id)).size, 1);
});
