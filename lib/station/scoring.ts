import { sha256 } from './identity';
import type { PackageGame, PackageMatch, ResultPayload, ResultPayloadValue } from './types';

/**
 * Baut die Ergebnis-Payload aus der UI-Eingabe. `number` erzeugt zusätzlich
 * eine abgeleitete Wettbewerbsplatzierung, da `standings` auf `placement`
 * zählt (siehe docs/datenkonzept.md Abschnitt 5).
 */

export function buildNumberPayload(
  match: PackageMatch,
  game: PackageGame,
  values: Record<string, number>,
): ResultPayload {
  const direction = game.comparison_direction === 'lower' ? -1 : 1;
  const ranked = [...match.participants].sort((a, b) => direction * ((values[a.id] ?? 0) - (values[b.id] ?? 0)) * -1);
  const out: ResultPayloadValue[] = [];
  let place = 1;
  for (let i = 0; i < ranked.length; i += 1) {
    if (i > 0) {
      const prevValue = values[ranked[i - 1].id] ?? 0;
      const curValue = values[ranked[i].id] ?? 0;
      if (curValue !== prevValue) place = i + 1;
    }
    out.push({ participant_id: ranked[i].id, measured_value: values[ranked[i].id] ?? 0, placement: place });
  }
  return { values: out };
}

export function buildOutcomePayload(match: PackageMatch, outcome: 'home' | 'draw' | 'away'): ResultPayload {
  const [home, away] = match.participants;
  if (outcome === 'draw') {
    return { values: [{ participant_id: home.id, placement: 1 }, { participant_id: away.id, placement: 1 }] };
  }
  const winner = outcome === 'home' ? home : away;
  const loser = outcome === 'home' ? away : home;
  return { values: [{ participant_id: winner.id, placement: 1 }, { participant_id: loser.id, placement: 2 }] };
}

export function buildPlacementPayload(
  match: PackageMatch,
  mode: 'winner' | 'top3',
  placements: Record<string, number>,
): ResultPayload {
  const fallback = mode === 'winner' ? 2 : 4;
  return {
    values: match.participants.map((p) => ({
      participant_id: p.id,
      placement: placements[p.id] ?? fallback,
    })),
  };
}

export function canonicalPayloadJson(payload: ResultPayload) {
  const sorted = [...payload.values].sort((a, b) => a.participant_id.localeCompare(b.participant_id));
  return JSON.stringify({ values: sorted });
}

export async function hashPayload(payload: ResultPayload) {
  return sha256(canonicalPayloadJson(payload));
}
