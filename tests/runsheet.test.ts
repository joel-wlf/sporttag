/// <reference types="node" />
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildMatrix } from '@/lib/schedule/matrix';
import { buildRunsheets, sheetNames } from '@/lib/schedule/runsheet';

const t = (h: number) => `2026-10-03T${String(h).padStart(2, '0')}:00:00Z`;
const rounds = [
  { id: 'r1', block_id: 'B1', kind: 'play', position: 1, starts_at: t(8), ends_at: t(9) } as any,
  { id: 'p', block_id: 'B1', kind: 'break', position: 2, starts_at: t(9), ends_at: t(10) } as any,
  { id: 'r2', block_id: 'B1', kind: 'play', position: 3, starts_at: t(10), ends_at: t(11) } as any,
];
const teams = [
  { id: 'A', name: 'Adler', number: 1, color: '#f00' },
  { id: 'B', name: 'Bären', number: 2, color: null },
  { id: 'C', name: 'Chamäleons', number: 3, color: null },
];

function setup(matchStatus = 'planned') {
  const matrix = buildMatrix({
    blocks: [{ id: 'B1', kind: 'play', position: 1, starts_at: t(8), ends_at: t(11) }],
    rounds,
    setups: [{ id: 's1', block_id: 'B1', station_id: 'S1', event_game_id: 'G1' }],
    matches: [{ id: 'm1', round_id: 'r1', station_setup_id: 's1', status: matchStatus }],
    participants: [{ match_id: 'm1', team_id: 'A', slot: 1 }, { match_id: 'm1', team_id: 'B', slot: 2 }],
    stations: [{ id: 'S1', name: 'Seilziehen' }],
  });
  return buildRunsheets({
    matrix,
    teams,
    stations: [{ id: 'S1', name: 'Seilziehen', location: 'Wiese' }],
    gameNames: new Map([['G1', 'Tauziehen']]),
    timeZone: 'UTC',
  });
}

test('Laufzettel zeigt Station, Spiel und Gegner; Pause und freie Runde sind markiert', () => {
  const [a, b, c] = setup();
  assert.equal(a.rows.length, 3);
  assert.deepEqual(
    { s: a.rows[0].station, l: a.rows[0].location, g: a.rows[0].game, o: a.rows[0].opponents, st: a.rows[0].start },
    { s: 'Seilziehen', l: 'Wiese', g: 'Tauziehen', o: 'Bären', st: '08:00' },
  );
  assert.equal(b.rows[0].opponents, 'Adler');
  assert.equal(a.rows[1].kind, 'break');
  assert.equal(a.rows[2].kind, 'free');
  assert.equal(c.rows[0].kind, 'free');
});

test('Abgesagte Matches erscheinen nicht im Laufzettel', () => {
  const [a] = setup('cancelled');
  assert.equal(a.rows[0].kind, 'free');
});

test('Blattnamen sind gültig und eindeutig', () => {
  const names = sheetNames(['A/B:C', 'Alle', 'x'.repeat(40), 'x'.repeat(40), ''], ['Alle']);
  assert.equal(names[0], 'ABC');
  assert.equal(names[1], 'Alle 2');
  assert.ok(names.every((n) => n.length <= 31));
  assert.equal(new Set(names.map((n) => n.toLowerCase())).size, names.length);
});
