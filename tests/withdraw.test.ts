/// <reference types="node" />
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isResultWithdrawn } from '@/lib/station/package';
import { progressMatchForSetup } from '@/lib/live/derive';

test('Rückzug erkannt, normales Ergebnis nicht', () => {
  const pkg: any = { current_result_values: [{ match_id: 'm1', version: 1 }] };
  assert.equal(isResultWithdrawn(pkg, { id: 'm1', current_result_version: 1, status: 'completed' } as any), false);
  assert.equal(isResultWithdrawn(pkg, { id: 'm2', current_result_version: 2, status: 'scheduled' } as any), true);
  assert.equal(isResultWithdrawn(pkg, { id: 'm3', current_result_version: 0, status: 'scheduled' } as any), false);
});
test('Live: zurückgezogenes Match ist wieder fällig', () => {
  const rounds: any = [
    { id: 'r1', starts_at: '2026-10-03T08:00:00Z', ends_at: '2026-10-03T08:20:00Z' },
    { id: 'r2', starts_at: '2026-10-03T08:30:00Z', ends_at: '2026-10-03T08:50:00Z' },
  ];
  const matches: any = [
    { id: 'a', station_setup_id: 's', round_id: 'r1', status: 'scheduled', current_result_version: 2 },
    { id: 'b', station_setup_id: 's', round_id: 'r2', status: 'scheduled', current_result_version: 0 },
  ];
  const got = progressMatchForSetup('s', matches, rounds, [], new Date('2026-10-03T08:40:00Z'));
  assert.equal(got?.match.id, 'a');
});
