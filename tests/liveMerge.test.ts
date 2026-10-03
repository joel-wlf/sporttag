/// <reference types="node" />
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { applyCounterChanges, mergeLiveState, mergeLiveValues } from '@/lib/station/liveMerge';
import { buildNumberPayload, hasBlockingTie, rewardedPlaces } from '@/lib/station/scoring';

// Live-Zähler: Zusammenführung mehrerer Geräte (docs/datenkonzept.md 11.6)

const countOf = (values: any[], id: string) => values.find((v) => v.participant_id === id)?.measured_value;

test('Live: zwei Geräte zählen verschiedene Teams, keiner überschreibt den anderen', () => {
  const base = applyCounterChanges(
    applyCounterChanges([], [{ participant_id: 'a', measured_value: 4 }], 'd1'),
    [{ participant_id: 'b', measured_value: 3 }],
    'd1',
  );
  const onA = applyCounterChanges(base, [{ participant_id: 'a', measured_value: 5 }], 'd1');
  const onB = applyCounterChanges(base, [{ participant_id: 'b', measured_value: 4 }], 'd2');
  const left = mergeLiveValues(onA, onB);
  assert.deepEqual(left, mergeLiveValues(onB, onA), 'Reihenfolge des Eintreffens darf nichts ändern');
  assert.equal(countOf(left, 'a'), 5);
  assert.equal(countOf(left, 'b'), 4);
});
test('Live: Änderung meldet nur das geänderte Team, andere bleiben unberührt', () => {
  const current = [
    { participant_id: 'a', measured_value: 2, rev: 3, by: 'd2' },
    { participant_id: 'b', measured_value: 7, rev: 5, by: 'd2' },
  ];
  const next = applyCounterChanges(current, [{ participant_id: 'a', measured_value: 3 }], 'd1');
  assert.deepEqual(next.find((v) => v.participant_id === 'a'), { participant_id: 'a', measured_value: 3, rev: 4, by: 'd1' });
  assert.deepEqual(next.find((v) => v.participant_id === 'b'), current[1]);
});
test('Live: gleiche Version, anderes Gerät – gleiche Entscheidung auf jeder Seite', () => {
  const x = [{ participant_id: 'a', measured_value: 6, rev: 2, by: 'd1' }];
  const y = [{ participant_id: 'a', measured_value: 4, rev: 2, by: 'd2' }];
  assert.deepEqual(mergeLiveValues(x, y), mergeLiveValues(y, x));
  assert.equal(countOf(mergeLiveValues(x, y), 'a'), 4);
});
test('Live: offline gezählter Stand bleibt beim Abgleich erhalten und wird nachgesendet', () => {
  const local: any = {
    matchId: 'm', eventId: 'e', checkinId: 'c', started: true, dirty: true, updatedAt: '2026-10-03T10:00:00.000Z',
    values: [{ participant_id: 'a', measured_value: 9, rev: 4, by: 'd1' }],
  };
  const remote = {
    values: [
      { participant_id: 'a', measured_value: 6, rev: 2, by: 'd1' },
      { participant_id: 'b', measured_value: 3, rev: 1, by: 'd2' },
    ],
    startedAt: '2026-10-03T09:00:00.000Z',
    updatedAt: '2026-10-03T10:05:00.000Z',
  };
  const merged = mergeLiveState(local, remote, 'e', 'm');
  assert.equal(countOf(merged.values, 'a'), 9);
  assert.equal(countOf(merged.values, 'b'), 3);
  assert.equal(merged.dirty, true, 'der offene a-Stand muss noch hinaus');
  const again = mergeLiveState(merged, { values: merged.values, startedAt: remote.startedAt, updatedAt: '2026-10-03T10:06:00.000Z' }, 'e', 'm');
  assert.equal(again.dirty, false);
});
test('Live: Momentaufnahme (Ausgang) – ungesendet und neuer gewinnt, sonst Serverstand', () => {
  const local: any = {
    matchId: 'm', eventId: 'e', checkinId: 'c', started: true, dirty: true, updatedAt: '2026-10-03T10:10:00.000Z',
    values: [{ participant_id: 'a', placement: 1 }, { participant_id: 'b', placement: 2 }],
  };
  const remote = {
    values: [{ participant_id: 'a', placement: 2 }, { participant_id: 'b', placement: 1 }],
    startedAt: null,
    updatedAt: '2026-10-03T10:05:00.000Z',
  };
  assert.equal(mergeLiveState(local, remote, 'e', 'm'), local);
  // Übertragener Stand mit vorgehender Gerätezeit darf spätere Serverstände nicht verdecken.
  const synced = { ...local, dirty: false, updatedAt: '2026-10-03T12:00:00.000Z' };
  assert.deepEqual(mergeLiveState(synced, remote, 'e', 'm').values, remote.values);
});
test('Mehrteam-Zähler: Gleichstand nur unter gewerteten Plätzen blockiert', () => {
  const pkg: any = { scoring_rules: [{ id: 'r', mode: 'placement', config: { points_by_place: { '1': 3, '2': 2, '3': 1 } } }] };
  assert.equal(rewardedPlaces(pkg, { scoring_rule_id: 'r' } as any, {} as any), 3);
  assert.equal(rewardedPlaces(pkg, { scoring_rule_id: null } as any, {} as any), 3);
  const six: any = { id: 'm6', participants: ['a', 'b', 'c', 'd', 'e', 'f'].map((id) => ({ id, team_id: id })) };
  const game = { comparison_direction: 'higher' } as any;
  assert.equal(hasBlockingTie(buildNumberPayload(six, game, { a: 9, b: 9, c: 5, d: 4, e: 3, f: 2 }), 3), true);
  const tieLast = buildNumberPayload(six, game, { a: 9, b: 8, c: 7, d: 2, e: 2, f: 1 });
  assert.equal(hasBlockingTie(tieLast, 3), false);
  assert.deepEqual(tieLast.values.map((v) => v.placement).sort(), [1, 2, 3, 4, 4, 6]);
});
test('Rohpunkte: kein Platz ist gewertet, Gleichstand blockiert nicht', () => {
  const pkg: any = { scoring_rules: [{ id: 'raw', mode: 'raw_value', config: { factor: 1 } }] };
  assert.equal(rewardedPlaces(pkg, { scoring_rule_id: 'raw' } as any, {} as any), 0);
  const two: any = { id: 'm2', participants: [{ id: 'a', team_id: 'A' }, { id: 'b', team_id: 'B' }, { id: 'c', team_id: 'C' }] };
  const payload = buildNumberPayload(two, { comparison_direction: 'higher' } as any, { a: 5, b: 5, c: 1 });
  assert.equal(hasBlockingTie(payload, 0), false);
});
