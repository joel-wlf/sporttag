/// <reference types="node" />
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildMatrix } from '@/lib/schedule/matrix';
const t = (h: number) => `2026-10-03T${String(h).padStart(2, '0')}:00:00Z`;
test('Pause innerhalb eines Blocks erzeugt keinen zweiten Blockkopf', () => {
  const m = buildMatrix({
    blocks: [{ id: 'B1', kind: 'play', position: 1, starts_at: t(8), ends_at: t(11) }, { id: 'B2', kind: 'play', position: 2, starts_at: t(12), ends_at: t(13) }],
    rounds: [
      { id: 'r1', block_id: 'B1', kind: 'play', position: 1, starts_at: t(8), ends_at: t(9) } as any,
      { id: 'p', block_id: 'B1', kind: 'break', position: 2, starts_at: t(9), ends_at: t(10) } as any,
      { id: 'r2', block_id: 'B1', kind: 'play', position: 3, starts_at: t(10), ends_at: t(11) } as any,
      { id: 'r3', block_id: 'B2', kind: 'play', position: 1, starts_at: t(12), ends_at: t(13) } as any,
    ],
    setups: [], matches: [], participants: [], stations: [],
  });
  const headers = m.rows.filter((r) => r.kind === 'block').map((r: any) => `${r.block.id}#${r.blockNumber}`);
  assert.deepEqual(headers, ['B1#1', 'B2#2']);
});
