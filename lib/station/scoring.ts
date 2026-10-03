import { sha256 } from './identity';
import type { PackageGame, PackageMatch, ResultPayload, ResultPayloadValue, StationPackage } from './types';

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

/**
 * Eingabemodus für Mehrteamspiele aus der konfigurierten Wertungsregel.
 * Werden mehrere Plätze belohnt (z. B. 4/3/2), müssen sie auch erfasst
 * werden: im Modus "Nur Gewinner" bekämen alle übrigen Teams gemeinsam
 * Platz 2 und damit die Punkte des zweiten Platzes.
 */
export function placementModeFor(
  pkg: StationPackage,
  match: PackageMatch,
  game: PackageGame,
): 'winner' | 'top3' {
  const ruleId = match.scoring_rule_id ?? game.scoring_rule_id;
  const rule = ruleId ? pkg.scoring_rules.find((r) => r.id === ruleId) : undefined;
  if (rule?.mode === 'placement') {
    const points = (rule.config as { points_by_place?: Record<string, unknown> }).points_by_place ?? {};
    return Object.keys(points).length <= 1 ? 'winner' : 'top3';
  }
  return 'top3';
}

/**
 * Höchster Platz, der in der Wertungsregel Punkte bringt (Standard 3). Nur
 * unter diesen Plätzen ist ein Gleichstand entscheidungspflichtig.
 */
export function rewardedPlaces(pkg: StationPackage, match: PackageMatch, game: PackageGame): number {
  const ruleId = match.scoring_rule_id ?? game.scoring_rule_id;
  const rule = ruleId ? pkg.scoring_rules.find((r) => r.id === ruleId) : undefined;
  // Rohpunkte zählen den Wert, nicht den Platz: ein Gleichstand ist unerheblich.
  if (rule?.mode === 'raw_value') return 0;
  if (rule?.mode === 'placement') {
    const places = Object.keys((rule.config as { points_by_place?: Record<string, unknown> }).points_by_place ?? {})
      .map(Number)
      .filter((n) => Number.isInteger(n) && n > 0);
    if (places.length > 0) return Math.max(...places);
  }
  return 3;
}

/** Teilen mehrere Teams einen Platz bis `rewarded`, ist das Ergebnis nicht eindeutig. */
export function hasBlockingTie(payload: ResultPayload, rewarded: number): boolean {
  const counts = new Map<number, number>();
  for (const v of payload.values) {
    if (v.placement == null || v.placement > rewarded) continue;
    counts.set(v.placement, (counts.get(v.placement) ?? 0) + 1);
  }
  return [...counts.values()].some((n) => n > 1);
}
