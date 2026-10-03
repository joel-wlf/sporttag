/**
 * Kennzahlen, Indikatoren und automatische Verteilung für die
 * Teamzusammenstellung. Rein und deterministisch, damit eine Vorschau
 * reproduzierbar ist und sich ohne UI prüfen lässt.
 *
 * Stärke: 1 (schwach) bis 6 (sehr stark). Fehlende Werte (unbewertet, ohne
 * Alter, ohne Geschlecht) zählen neutral und verzerren weder Kennzahlen noch
 * Verteilung.
 */

export type Gender = 'f' | 'm' | 'd';

export type BalancePlayer = {
  id: string;
  name: string;
  teamId: string | null;
  locked: boolean;
  gender: Gender | null;
  skill: number | null;
  age: number | null;
};

export type TeamStats = {
  teamId: string;
  count: number;
  rated: number;
  skillAvg: number | null;
  skillSum: number;
  female: number;
  male: number;
  diverse: number;
  aged: number;
  ageAvg: number | null;
};

export type BalanceWeights = { skill: number; gender: number; age: number };

export type IndicatorTone = 'success' | 'warning' | 'danger' | 'neutral';

export type TeamIndicator = {
  key: string;
  label: string;
  tone: IndicatorTone;
  icon: 'alert' | 'check-circle' | 'users' | 'user';
};

export const SKILL_MIN = 1;
export const SKILL_MAX = 6;

export const genderShort: Record<Gender, string> = { f: 'w', m: 'm', d: 'd' };
export const genderLabel: Record<Gender, string> = { f: 'weiblich', m: 'männlich', d: 'divers' };

function emptyStats(teamId: string): TeamStats {
  return { teamId, count: 0, rated: 0, skillAvg: null, skillSum: 0, female: 0, male: 0, diverse: 0, aged: 0, ageAvg: null };
}

export function teamStats(players: BalancePlayer[], teamIds: string[]): Map<string, TeamStats> {
  const stats = new Map(teamIds.map((id) => [id, emptyStats(id)]));
  const ageSums = new Map<string, number>();
  for (const p of players) {
    if (!p.teamId) continue;
    const s = stats.get(p.teamId);
    if (!s) continue;
    s.count += 1;
    if (p.skill != null) {
      s.rated += 1;
      s.skillSum += p.skill;
    }
    if (p.gender === 'f') s.female += 1;
    else if (p.gender === 'm') s.male += 1;
    else if (p.gender === 'd') s.diverse += 1;
    if (p.age != null) {
      s.aged += 1;
      ageSums.set(p.teamId, (ageSums.get(p.teamId) ?? 0) + p.age);
    }
  }
  for (const s of stats.values()) {
    s.skillAvg = s.rated > 0 ? s.skillSum / s.rated : null;
    s.ageAvg = s.aged > 0 ? (ageSums.get(s.teamId) ?? 0) / s.aged : null;
  }
  return stats;
}

type Overall = {
  teams: number;
  meanSize: number;
  skillAvg: number | null;
  femaleShare: number | null;
  ageAvg: number | null;
};

function overall(stats: TeamStats[]): Overall {
  const assigned = stats.reduce((sum, s) => sum + s.count, 0);
  const rated = stats.reduce((sum, s) => sum + s.rated, 0);
  const skillSum = stats.reduce((sum, s) => sum + s.skillSum, 0);
  const female = stats.reduce((sum, s) => sum + s.female, 0);
  const male = stats.reduce((sum, s) => sum + s.male, 0);
  const aged = stats.reduce((sum, s) => sum + s.aged, 0);
  const ageSum = stats.reduce((sum, s) => sum + (s.ageAvg ?? 0) * s.aged, 0);
  return {
    teams: stats.length,
    meanSize: stats.length ? assigned / stats.length : 0,
    skillAvg: rated ? skillSum / rated : null,
    femaleShare: female + male ? female / (female + male) : null,
    ageAvg: aged ? ageSum / aged : null,
  };
}

/** Schwellwerte für die Hinweise über den Team-Feldern. */
export const indicatorThresholds = {
  skill: 0.5, // Abweichung der Ø-Stärke (Skala 1–6) vom Durchschnitt aller Teams
  size: 2, // Abweichung der Spielerzahl vom Durchschnitt
  genderShare: 0.2, // Abweichung des Mädchenanteils
  genderMinPlayers: 4,
  age: 1.5, // Jahre
};

export function teamIndicators(all: Map<string, TeamStats>): Map<string, TeamIndicator[]> {
  const list = [...all.values()];
  const o = overall(list);
  const result = new Map<string, TeamIndicator[]>();
  for (const s of list) {
    const items: TeamIndicator[] = [];
    if (s.count === 0) {
      items.push({ key: 'empty', label: 'Noch leer', tone: 'neutral', icon: 'user' });
      result.set(s.teamId, items);
      continue;
    }
    if (o.teams > 1 && s.skillAvg != null && o.skillAvg != null) {
      const diff = s.skillAvg - o.skillAvg;
      if (diff <= -indicatorThresholds.skill) items.push({ key: 'weak', label: 'Zu schwach', tone: 'danger', icon: 'alert' });
      else if (diff >= indicatorThresholds.skill) items.push({ key: 'strong', label: 'Zu stark', tone: 'warning', icon: 'alert' });
    }
    if (o.teams > 1) {
      const diff = s.count - o.meanSize;
      if (diff <= -indicatorThresholds.size) items.push({ key: 'small', label: 'Zu klein', tone: 'warning', icon: 'users' });
      else if (diff >= indicatorThresholds.size) items.push({ key: 'large', label: 'Zu groß', tone: 'warning', icon: 'users' });
    }
    const gendered = s.female + s.male;
    if (o.teams > 1 && o.femaleShare != null && gendered >= indicatorThresholds.genderMinPlayers) {
      if (Math.abs(s.female / gendered - o.femaleShare) >= indicatorThresholds.genderShare) {
        items.push({ key: 'gender', label: 'Geschlecht unausgewogen', tone: 'warning', icon: 'users' });
      }
    }
    if (o.teams > 1 && s.ageAvg != null && o.ageAvg != null) {
      const diff = s.ageAvg - o.ageAvg;
      if (diff <= -indicatorThresholds.age) items.push({ key: 'young', label: 'Deutlich jünger', tone: 'warning', icon: 'user' });
      else if (diff >= indicatorThresholds.age) items.push({ key: 'old', label: 'Deutlich älter', tone: 'warning', icon: 'user' });
    }
    const unrated = s.count - s.rated;
    if (unrated > 0) {
      items.push({ key: 'unrated', label: `${unrated} unbewertet`, tone: 'neutral', icon: 'user' });
    }
    if (items.length === 0) items.push({ key: 'ok', label: 'Ausgeglichen', tone: 'success', icon: 'check-circle' });
    result.set(s.teamId, items);
  }
  return result;
}

// ---------------------------------------------------------------------------
// Automatische Verteilung
// ---------------------------------------------------------------------------

export type AutoAssignMode = 'unassigned' | 'all';

export type AutoAssignResult = {
  assignments: { playerId: string; teamId: string }[];
  /** Spieler ↦ Team nach der Verteilung (inklusive unveränderter). */
  players: BalancePlayer[];
};

type Acc = { n: number; skill: number; female: number; male: number; gendered: number; age: number };

/**
 * Verteilt Spieler auf Teams:
 * 1. Fixierte (und im Modus „unassigned“ alle bereits zugeteilten) bleiben stehen.
 * 2. Gierig, stärkste zuerst: Jeder Spieler geht in eines der aktuell kleinsten
 *    Teams, und zwar in das mit den geringsten Zusatzkosten.
 * 3. Paartausch zwischen Teams, solange die Gesamtkosten sinken.
 *
 * Die Teamgröße wird immer ausgeglichen; Stärke, Geschlecht und Alter fließen
 * mit ihrem Gewicht (0 = aus) in die Kosten ein.
 */
export function autoAssign(
  players: BalancePlayer[],
  teamIds: string[],
  weights: BalanceWeights,
  mode: AutoAssignMode,
): AutoAssignResult {
  if (teamIds.length === 0) return { assignments: [], players };
  const teamIndex = new Map(teamIds.map((id, i) => [id, i]));

  const isMovable = (p: BalancePlayer) =>
    !p.locked && (mode === 'all' || p.teamId == null || !teamIndex.has(p.teamId));

  // Globale Zielwerte über alle Spieler, die nach der Verteilung in Teams sind.
  const pool = players.filter((p) => isMovable(p) || (p.teamId != null && teamIndex.has(p.teamId)));
  const rated = pool.filter((p) => p.skill != null);
  const skillMean = rated.length ? rated.reduce((s, p) => s + (p.skill as number), 0) / rated.length : 3.5;
  const skillVar = Math.max(
    0.25,
    rated.length ? rated.reduce((s, p) => s + ((p.skill as number) - skillMean) ** 2, 0) / rated.length : 1,
  );
  const gendered = pool.filter((p) => p.gender === 'f' || p.gender === 'm');
  const femaleShare = gendered.length ? gendered.filter((p) => p.gender === 'f').length / gendered.length : 0.5;
  const aged = pool.filter((p) => p.age != null);
  const ageMean = aged.length ? aged.reduce((s, p) => s + (p.age as number), 0) / aged.length : 0;
  const ageVar = Math.max(
    1,
    aged.length ? aged.reduce((s, p) => s + ((p.age as number) - ageMean) ** 2, 0) / aged.length : 1,
  );

  const skillOf = (p: BalancePlayer) => p.skill ?? skillMean;
  const ageOf = (p: BalancePlayer) => p.age ?? ageMean;

  const acc: Acc[] = teamIds.map(() => ({ n: 0, skill: 0, female: 0, male: 0, gendered: 0, age: 0 }));
  const add = (a: Acc, p: BalancePlayer, sign: 1 | -1) => {
    a.n += sign;
    a.skill += sign * skillOf(p);
    a.age += sign * ageOf(p);
    if (p.gender === 'f') {
      a.female += sign;
      a.gendered += sign;
    } else if (p.gender === 'm') {
      a.male += sign;
      a.gendered += sign;
    }
  };

  const teamCost = (a: Acc) => {
    if (a.n === 0) return 0;
    let cost = 0;
    if (weights.skill > 0) cost += (weights.skill * a.n * (a.skill / a.n - skillMean) ** 2) / skillVar;
    if (weights.gender > 0 && a.gendered > 0) {
      // Abweichung des Mädchenanteils, mit der Zahl der Spieler gewichtet.
      cost += weights.gender * 4 * a.gendered * (a.female / a.gendered - femaleShare) ** 2;
    }
    if (weights.age > 0) cost += (weights.age * a.n * (a.age / a.n - ageMean) ** 2) / ageVar;
    return cost;
  };

  const assignment = new Map<string, number>();
  for (const p of players) {
    if (!isMovable(p) && p.teamId != null && teamIndex.has(p.teamId)) {
      const idx = teamIndex.get(p.teamId) as number;
      add(acc[idx], p, 1);
      assignment.set(p.id, idx);
    }
  }

  const movable = players
    .filter(isMovable)
    .sort((a, b) => skillOf(b) - skillOf(a) || a.name.localeCompare(b.name, 'de') || a.id.localeCompare(b.id));

  for (const p of movable) {
    const minSize = Math.min(...acc.map((a) => a.n));
    let best = -1;
    let bestDelta = Infinity;
    acc.forEach((a, idx) => {
      if (a.n !== minSize) return;
      const before = teamCost(a);
      add(a, p, 1);
      const delta = teamCost(a) - before;
      add(a, p, -1);
      if (delta < bestDelta - 1e-12) {
        bestDelta = delta;
        best = idx;
      }
    });
    add(acc[best], p, 1);
    assignment.set(p.id, best);
  }

  // Paartausch-Verbesserung (Teamgrößen bleiben unverändert).
  if (weights.skill > 0 || weights.gender > 0 || weights.age > 0) {
    for (let pass = 0; pass < 30; pass += 1) {
      let improved = false;
      for (let i = 0; i < movable.length; i += 1) {
        for (let j = i + 1; j < movable.length; j += 1) {
          const p = movable[i];
          const q = movable[j];
          const ti = assignment.get(p.id) as number;
          const tj = assignment.get(q.id) as number;
          if (ti === tj) continue;
          const before = teamCost(acc[ti]) + teamCost(acc[tj]);
          add(acc[ti], p, -1);
          add(acc[ti], q, 1);
          add(acc[tj], q, -1);
          add(acc[tj], p, 1);
          const after = teamCost(acc[ti]) + teamCost(acc[tj]);
          if (after < before - 1e-9) {
            assignment.set(p.id, tj);
            assignment.set(q.id, ti);
            improved = true;
          } else {
            add(acc[ti], q, -1);
            add(acc[ti], p, 1);
            add(acc[tj], p, -1);
            add(acc[tj], q, 1);
          }
        }
      }
      if (!improved) break;
    }
  }

  const assignments = movable
    .map((p) => ({ playerId: p.id, teamId: teamIds[assignment.get(p.id) as number] }))
    .filter((a) => players.find((p) => p.id === a.playerId)?.teamId !== a.teamId);

  const next = players.map((p) =>
    assignment.has(p.id) && isMovable(p) ? { ...p, teamId: teamIds[assignment.get(p.id) as number] } : p,
  );
  return { assignments, players: next };
}

/** Anzeige der Stärke als Zahl mit einer Nachkommastelle. */
export function formatSkill(value: number | null) {
  if (value == null) return '–';
  return value.toLocaleString('de-DE', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
}
