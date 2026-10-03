/// <reference types="node" />
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildNumberPayload, buildOutcomePayload, buildPlacementPayload, canonicalPayloadJson, placementModeFor } from '@/lib/station/scoring';
import { callNumber, dialableNumber } from '@/lib/emergency';
import { countOutbox, isSettledReceipt } from '@/lib/station/syncCounts';

const match: any = { id: 'm', participants: [{ id: 'a', team_id: 'A' }, { id: 'b', team_id: 'B' }, { id: 'c', team_id: 'C' }] };
const two: any = { id: 'm2', participants: [{ id: 'a', team_id: 'A' }, { id: 'b', team_id: 'B' }] };

test('Zahl: höher gewinnt, Wettbewerbsrang mit Gleichstand', () => {
  const p = buildNumberPayload(match, { comparison_direction: 'higher' } as any, { a: 5, b: 9, c: 5 });
  const by = Object.fromEntries(p.values.map((v) => [v.participant_id, v.placement]));
  assert.deepEqual(by, { b: 1, a: 2, c: 2 });
});
test('Zahl: niedriger gewinnt (Zeit)', () => {
  const p = buildNumberPayload(two, { comparison_direction: 'lower' } as any, { a: 12.5, b: 10 });
  const by = Object.fromEntries(p.values.map((v) => [v.participant_id, v.placement]));
  assert.deepEqual(by, { b: 1, a: 2 });
});
test('Zahl: fehlender Wert zählt als 0, nicht als fehlend', () => {
  const p = buildNumberPayload(two, { comparison_direction: 'higher' } as any, { a: 3 });
  assert.equal(p.values.find((v) => v.participant_id === 'b')!.measured_value, 0);
});
test('Zahl, niedriger gewinnt: Payload wertet fehlende Werte als 0 (UI verlangt deshalb alle Werte)', () => {
  const p = buildNumberPayload(two, { comparison_direction: 'lower' } as any, { a: 42 });
  const by = Object.fromEntries(p.values.map((v) => [v.participant_id, v.placement]));
  // dokumentiert das Verhalten: b ohne Eingabe bekommt Platz 1
  assert.deepEqual(by, { b: 1, a: 2 });
});
test('Ausgang und Unentschieden', () => {
  assert.deepEqual(buildOutcomePayload(two, 'draw').values.map((v) => v.placement), [1, 1]);
  const away = buildOutcomePayload(two, 'away').values;
  assert.equal(away.find((v) => v.participant_id === 'b')!.placement, 1);
});
test('Platzierung: Fallback-Plätze', () => {
  assert.deepEqual(buildPlacementPayload(match, 'winner', { c: 1 }).values.map((v) => v.placement), [2, 2, 1]);
  assert.deepEqual(buildPlacementPayload(match, 'top3', { a: 1, b: 2 }).values.map((v) => v.placement), [1, 2, 4]);
});
test('Hash ist reihenfolgeunabhängig', () => {
  const x = { values: [{ participant_id: 'b', placement: 2 }, { participant_id: 'a', placement: 1 }] };
  const y = { values: [{ participant_id: 'a', placement: 1 }, { participant_id: 'b', placement: 2 }] };
  assert.equal(canonicalPayloadJson(x), canonicalPayloadJson(y));
});
test('Platzierungsmodus aus Regel', () => {
  const pkg: any = { scoring_rules: [{ id: 'r', mode: 'placement', config: { points_by_place: { '1': 3 } } }, { id: 't', mode: 'placement', config: { points_by_place: { '1': 3, '2': 2 } } }] };
  assert.equal(placementModeFor(pkg, { scoring_rule_id: 'r' } as any, {} as any), 'winner');
  assert.equal(placementModeFor(pkg, { scoring_rule_id: null } as any, { scoring_rule_id: 't' } as any), 'top3');
});
test('Rufnummern', async () => {
  assert.equal(dialableNumber('+49 (0)151 / 234 56'), '+4915123456');
  assert.equal(dialableNumber('0151 23456'), '015123456');
  assert.equal(await callNumber('—'), 'not_configured');
  assert.equal(await callNumber('112'), 'started');
});
test('Outbox-Zählung', () => {
  const c = countOutbox([
    { requestId: '1', kind: 'result', position: 1, state: 'pending', attemptCount: 0, nextAttemptAt: null, lastError: null, receiptStatus: null },
    { requestId: '2', kind: 'result', position: 2, state: 'received', attemptCount: 0, nextAttemptAt: null, lastError: null, receiptStatus: 'conflict' },
    { requestId: '3', kind: 'checkin', position: 3, state: 'pending', attemptCount: 2, nextAttemptAt: null, lastError: 'station setup not found', receiptStatus: null },
  ] as any);
  assert.equal(c.pending, 1); assert.equal(c.review, 1); assert.equal(c.failed, 1);
  assert.ok(isSettledReceipt('resolved'));
});
