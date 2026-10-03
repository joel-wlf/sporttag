/// <reference types="node" />
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildTimeline, formatDelay } from '@/lib/live/timeline';

const at = (hhmm: string) => `2026-10-03T${hhmm}:00Z`;

const base = {
  rounds: [
    { id: 'r1', block_id: 'b1', label: 'R1', position: 1, kind: 'play', starts_at: at('08:00'), ends_at: at('08:20') },
    { id: 'p', block_id: 'b1', label: null, position: 2, kind: 'break', starts_at: at('08:20'), ends_at: at('08:30') },
    { id: 'r2', block_id: 'b1', label: 'R2', position: 3, kind: 'play', starts_at: at('08:30'), ends_at: at('08:50') },
  ],
  blocks: [{ id: 'b1', position: 1, starts_at: at('08:00'), ends_at: at('09:00') }],
  stationSetups: [{ id: 's1', block_id: 'b1', station_id: 'A' }],
  stations: [{ id: 'A', name: 'Station A' }],
  teams: [
    { id: 't1', name: 'Rot' },
    { id: 't2', name: 'Blau' },
  ],
};

test('Zeitleiste: leere Daten stürzen nicht ab', () => {
  const tl = buildTimeline(
    { rounds: [], blocks: [], stationSetups: [], stations: [], matches: [], participants: [], teams: [], visits: [] },
    new Date(at('08:00')),
  );
  assert.ok(tl);
});

test('Zeitleiste: unvollständige und verdrehte Daten stürzen nicht ab', () => {
  const tl = buildTimeline(
    {
      ...base,
      matches: [
        { id: 'm1', round_id: 'r1', station_setup_id: 's1', status: 'completed', actual_started_at: at('08:05'), actual_ended_at: at('08:02') },
        { id: 'm2', round_id: 'fehlt', station_setup_id: 's1', status: 'scheduled' },
        { id: 'm3', round_id: 'r2', station_setup_id: 'fehlt', status: 'scheduled' },
        { id: 'm4', round_id: 'r2', station_setup_id: 's1', status: 'cancelled' },
      ],
      participants: [
        { id: 'p1', match_id: 'm1', team_id: 't1', slot: 1 },
        { id: 'p2', match_id: 'm1', team_id: 'unbekannt', slot: 2 },
        { id: 'p3', match_id: 'm4', team_id: 't2', slot: 1 },
      ],
      visits: [
        { participant_id: 'p1', arrived_at: at('08:10'), released_at: at('08:01') },
        { participant_id: 'p2', arrived_at: 'kein Datum', released_at: null },
      ],
    },
    new Date(at('08:40')),
  );
  assert.ok(tl);
  // Keine NaN-Werte in Kennzahlen oder Balken (würden als "NaN min" erscheinen).
  const nan: string[] = [];
  const walk = (value: unknown, path: string) => {
    if (typeof value === 'number' && Number.isNaN(value)) nan.push(path);
    else if (value instanceof Map) value.forEach((v, k) => walk(v, `${path}.${String(k)}`));
    else if (value && typeof value === 'object') for (const [k, v] of Object.entries(value)) walk(v, `${path}.${k}`);
  };
  walk(tl, 'timeline');
  assert.deepEqual(nan, []);
});

test('Verzug wird lesbar formatiert', () => {
  assert.equal(typeof formatDelay(null), 'string');
  assert.equal(typeof formatDelay(7 * 60_000), 'string');
  assert.equal(typeof formatDelay(-3 * 60_000), 'string');
});
