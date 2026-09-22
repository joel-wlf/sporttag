/**
 * Zeitleiste des Veranstaltungstags: aus Plan und tatsächlichem Ablauf.
 *
 * Die geplanten Uhrzeiten sind am Sporttag nur eine Absicht. Ein Block startet
 * gemeinsam, eine Runde endet aber erst, wenn das letzte Spiel fertig ist —
 * dadurch verschieben sich Gruppen gegeneinander: eine wartet an der Station,
 * weil das Spiel davor noch läuft, eine andere ist früher fertig. Statt die
 * Uhrzeit zu betonen, zeigt diese Ableitung, *wie weit* eine Gruppe vom Plan
 * abweicht und wo die Zeit hingeht:
 *
 *   Plan        ├─────── Runde ───────┤
 *   Ist                 ├── warten ──┤├─ Spiel ─┤   ├─ Weg ─┤
 *               ↑ geplanter Start     ↑ angekommen  ↑ weitergeschickt
 *
 * - Verzug    (delayMs)  – angekommen/gestartet gegenüber dem geplanten Start
 * - Wartezeit (waitMs)   – angekommen, aber das Spiel läuft noch nicht
 * - Wegzeit   (travelMs) – weitergeschickt bis zur Ankunft an der nächsten Station
 *
 * Alles hier ist reine Ableitung ohne Datenzugriff, damit Backoffice und
 * Stationsgerät dieselbe Rechnung benutzen. Siehe docs/datenkonzept.md 11.7.
 */

export type TimelineInput = {
  rounds: { id: string; block_id: string; label: string | null; position: number; kind: string; starts_at: string; ends_at: string }[];
  blocks: { id: string; position: number; starts_at: string; ends_at: string }[];
  stationSetups: { id: string; block_id: string; station_id: string }[];
  stations: { id: string; name: string }[];
  matches: {
    id: string;
    round_id: string;
    station_setup_id: string;
    status: string;
    actual_started_at?: string | null;
    actual_ended_at?: string | null;
  }[];
  participants: { id: string; match_id: string; team_id: string; slot: number }[];
  teams: { id: string; name: string; number?: number | null; color?: string | null }[];
  visits: { participant_id: string; arrived_at: string | null; released_at: string | null }[];
  /** Optionaler Live-Start je Match, falls das Gerät ihn früher meldet als `matches`. */
  liveStartedAt?: Record<string, string | null>;
};

/** Ein Aufenthalt einer Gruppe an einer Station – geplant und tatsächlich. */
export type TimelineLeg = {
  key: string;
  participantId: string;
  matchId: string;
  teamId: string;
  teamName: string;
  teamNumber: number | null;
  stationId: string;
  stationName: string;
  roundId: string;
  roundLabel: string;
  roundPosition: number;
  cancelled: boolean;
  /** Geplantes Fenster aus dem Zeitplan (ms). */
  plannedStart: number;
  plannedEnd: number;
  /** Tatsächliche Marken (ms), soweit gemeldet. */
  arrivedAt: number | null;
  startedAt: number | null;
  endedAt: number | null;
  releasedAt: number | null;
  /** Wartezeit an der Station vor dem Spielstart. */
  waitMs: number | null;
  /** Wegzeit von der vorherigen Station bis zur Ankunft hier. */
  travelMs: number | null;
  /** Verzug gegenüber dem geplanten Rundenstart; negativ = früher als geplant. */
  delayMs: number | null;
  phase: LegPhase;
};

export type LegPhase =
  | 'planned' // noch nichts gemeldet
  | 'waiting' // Gruppe ist da, Spiel läuft noch nicht
  | 'playing' // Spiel läuft
  | 'played' //  Spiel fertig, Gruppe noch an der Station
  | 'released' // weitergeschickt
  | 'cancelled';

export type TeamTrack = {
  teamId: string;
  teamName: string;
  teamNumber: number | null;
  teamColor: string | null;
  legs: TimelineLeg[];
  /** Verzug der Gruppe jetzt: aus dem laufenden bzw. zuletzt erreichten Aufenthalt. */
  delayMs: number | null;
  /** Summierte Wartezeit an Stationen. */
  waitMs: number;
  /** Summierte Wegzeit zwischen Stationen. */
  travelMs: number;
  currentLeg: TimelineLeg | null;
};

export type StationTrack = {
  stationId: string;
  stationName: string;
  /** Ein Balken je Match an dieser Station, über alle Runden. */
  bars: StationBar[];
  /** Leerlauf zwischen zwei belegten Matches – der sichtbare Overhead. */
  idleMs: number;
};

export type StationBar = {
  key: string;
  matchId: string;
  roundId: string;
  roundLabel: string;
  label: string;
  cancelled: boolean;
  plannedStart: number;
  plannedEnd: number;
  /** Tatsächliche Belegung: erste Ankunft bis letzte Weiterschickung. */
  actualStart: number | null;
  actualEnd: number | null;
  startedAt: number | null;
  phase: LegPhase;
  /** Anzahl Gruppen, die schon eingecheckt sind, und wie viele erwartet werden. */
  arrivedCount: number;
  teamCount: number;
};

export type Timeline = {
  /** Zeitfenster der Darstellung (ms). */
  domainStart: number;
  domainEnd: number;
  teams: TeamTrack[];
  stations: StationTrack[];
  /** Verzug über alle Gruppen: Median-nahes Bild ohne Ausreißer-Drama. */
  medianDelayMs: number | null;
  worstDelayMs: number | null;
};

const ms = (iso: string | null | undefined): number | null => {
  if (!iso) return null;
  const value = new Date(iso).getTime();
  return Number.isFinite(value) ? value : null;
};

function phaseOf(leg: {
  cancelled: boolean;
  arrivedAt: number | null;
  startedAt: number | null;
  endedAt: number | null;
  releasedAt: number | null;
}): LegPhase {
  if (leg.cancelled) return 'cancelled';
  if (leg.releasedAt !== null) return 'released';
  if (leg.endedAt !== null) return 'played';
  if (leg.startedAt !== null) return 'playing';
  if (leg.arrivedAt !== null) return 'waiting';
  return 'planned';
}

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? sorted[middle] : Math.round((sorted[middle - 1] + sorted[middle]) / 2);
}

/**
 * Baut die vollständige Zeitleiste. `now` fließt nur in das Ende des
 * dargestellten Fensters ein, nicht in die gemessenen Zeiten — so bleibt die
 * Ableitung bei gleichen Daten stabil.
 */
export function buildTimeline(input: TimelineInput, now: Date): Timeline {
  const roundById = new Map(input.rounds.map((r) => [r.id, r]));
  const setupById = new Map(input.stationSetups.map((s) => [s.id, s]));
  const stationById = new Map(input.stations.map((s) => [s.id, s]));
  const teamById = new Map(input.teams.map((t) => [t.id, t]));
  const visitByParticipant = new Map(input.visits.map((v) => [v.participant_id, v]));
  const participantsByMatch = new Map<string, TimelineInput['participants']>();
  for (const participant of input.participants) {
    const list = participantsByMatch.get(participant.match_id);
    if (list) list.push(participant);
    else participantsByMatch.set(participant.match_id, [participant]);
  }

  // --- Aufenthalte je Gruppe -------------------------------------------------
  const legsByTeam = new Map<string, TimelineLeg[]>();
  const legsByStation = new Map<string, TimelineLeg[]>();

  for (const match of input.matches) {
    const round = roundById.get(match.round_id);
    const setup = setupById.get(match.station_setup_id);
    if (!round || !setup) continue;
    const station = stationById.get(setup.station_id);
    if (!station) continue;

    const plannedStart = ms(round.starts_at);
    const plannedEnd = ms(round.ends_at);
    if (plannedStart === null || plannedEnd === null) continue;

    const startedAt = ms(match.actual_started_at) ?? ms(input.liveStartedAt?.[match.id] ?? null);
    const endedAt = ms(match.actual_ended_at);
    const cancelled = match.status === 'cancelled';

    for (const participant of participantsByMatch.get(match.id) ?? []) {
      const team = teamById.get(participant.team_id);
      const visit = visitByParticipant.get(participant.id);
      const arrivedAt = ms(visit?.arrived_at ?? null);
      const releasedAt = ms(visit?.released_at ?? null);

      const leg: TimelineLeg = {
        key: participant.id,
        participantId: participant.id,
        matchId: match.id,
        teamId: participant.team_id,
        teamName: team?.name ?? 'Unbekannte Gruppe',
        teamNumber: team?.number ?? null,
        stationId: station.id,
        stationName: station.name,
        roundId: round.id,
        roundLabel: round.label ?? `Runde ${round.position}`,
        roundPosition: round.position,
        cancelled,
        plannedStart,
        plannedEnd,
        arrivedAt,
        startedAt,
        endedAt,
        releasedAt,
        waitMs: arrivedAt !== null && startedAt !== null ? Math.max(0, startedAt - arrivedAt) : null,
        travelMs: null, // erst bekannt, wenn die Aufenthalte der Gruppe sortiert sind
        delayMs: null,
        phase: phaseOf({ cancelled, arrivedAt, startedAt, endedAt, releasedAt }),
      };

      const teamLegs = legsByTeam.get(participant.team_id);
      if (teamLegs) teamLegs.push(leg);
      else legsByTeam.set(participant.team_id, [leg]);

      const stationLegs = legsByStation.get(station.id);
      if (stationLegs) stationLegs.push(leg);
      else legsByStation.set(station.id, [leg]);
    }
  }

  // --- Verzug und Wegzeit je Gruppe -----------------------------------------
  const teams: TeamTrack[] = [];
  for (const [teamId, legs] of legsByTeam) {
    legs.sort((a, b) => a.roundPosition - b.roundPosition || a.plannedStart - b.plannedStart);

    let previous: TimelineLeg | null = null;
    for (const leg of legs) {
      // Verzug misst den Zeitpunkt, an dem die Gruppe die Station tatsächlich
      // erreicht hat. Ohne Ankunftsmeldung zählt der Spielstart, sonst gar
      // nichts: ein noch nicht erreichter Aufenthalt ist nicht "verspätet".
      const reference = leg.arrivedAt ?? leg.startedAt;
      leg.delayMs = reference !== null ? reference - leg.plannedStart : null;
      if (previous?.releasedAt != null && leg.arrivedAt != null) {
        leg.travelMs = Math.max(0, leg.arrivedAt - previous.releasedAt);
      }
      previous = leg;
    }

    const team = teamById.get(teamId);
    // Der laufende Aufenthalt ist der erste, der noch nicht abgeschlossen ist.
    const currentLeg = legs.find((l) => l.phase !== 'released' && l.phase !== 'cancelled') ?? legs[legs.length - 1] ?? null;
    const reached = legs.filter((l) => l.delayMs !== null);
    const lastReached = reached[reached.length - 1] ?? null;

    teams.push({
      teamId,
      teamName: team?.name ?? 'Unbekannte Gruppe',
      teamNumber: team?.number ?? null,
      teamColor: team?.color ?? null,
      legs,
      delayMs: lastReached?.delayMs ?? null,
      waitMs: legs.reduce((sum, l) => sum + (l.waitMs ?? 0), 0),
      travelMs: legs.reduce((sum, l) => sum + (l.travelMs ?? 0), 0),
      currentLeg,
    });
  }
  teams.sort((a, b) => (a.teamNumber ?? 9999) - (b.teamNumber ?? 9999) || a.teamName.localeCompare(b.teamName));

  // --- Belegung je Station ---------------------------------------------------
  const stations: StationTrack[] = [];
  for (const station of input.stations) {
    const legs = legsByStation.get(station.id) ?? [];
    const byMatch = new Map<string, TimelineLeg[]>();
    for (const leg of legs) {
      const list = byMatch.get(leg.matchId);
      if (list) list.push(leg);
      else byMatch.set(leg.matchId, [leg]);
    }

    const bars: StationBar[] = [];
    for (const [matchId, matchLegs] of byMatch) {
      const first = matchLegs[0];
      const arrivals = matchLegs.map((l) => l.arrivedAt).filter((v): v is number => v !== null);
      const releases = matchLegs.map((l) => l.releasedAt).filter((v): v is number => v !== null);
      // Die Station ist erst frei, wenn *alle* Gruppen weitergeschickt sind.
      const actualEnd = releases.length === matchLegs.length ? Math.max(...releases) : null;
      bars.push({
        key: matchId,
        matchId,
        roundId: first.roundId,
        roundLabel: first.roundLabel,
        label: matchLegs.map((l) => l.teamName).join(' – '),
        cancelled: first.cancelled,
        plannedStart: first.plannedStart,
        plannedEnd: first.plannedEnd,
        actualStart: arrivals.length > 0 ? Math.min(...arrivals) : null,
        actualEnd,
        startedAt: first.startedAt,
        phase: first.cancelled
          ? 'cancelled'
          : actualEnd !== null
            ? 'released'
            : first.endedAt !== null
              ? 'played'
              : first.startedAt !== null
                ? 'playing'
                : arrivals.length > 0
                  ? 'waiting'
                  : 'planned',
        arrivedCount: arrivals.length,
        teamCount: matchLegs.length,
      });
    }
    bars.sort((a, b) => a.plannedStart - b.plannedStart);

    // Leerlauf: die Lücken zwischen zwei tatsächlich belegten Matches.
    let idleMs = 0;
    let previousEnd: number | null = null;
    for (const bar of bars) {
      if (bar.cancelled) continue;
      if (previousEnd !== null && bar.actualStart !== null && bar.actualStart > previousEnd) {
        idleMs += bar.actualStart - previousEnd;
      }
      if (bar.actualEnd !== null) previousEnd = bar.actualEnd;
    }

    stations.push({ stationId: station.id, stationName: station.name, bars, idleMs });
  }
  stations.sort((a, b) => a.stationName.localeCompare(b.stationName));

  // --- Fenster und Kennzahlen ------------------------------------------------
  const plannedStarts = input.blocks.map((b) => ms(b.starts_at)).filter((v): v is number => v !== null);
  const plannedEnds = input.blocks.map((b) => ms(b.ends_at)).filter((v): v is number => v !== null);
  const marks = [
    ...plannedStarts,
    ...plannedEnds,
    ...teams.flatMap((t) => t.legs.flatMap((l) => [l.arrivedAt, l.releasedAt, l.startedAt, l.endedAt])),
  ].filter((v): v is number => v !== null && v !== undefined);

  const nowMs = now.getTime();
  const domainStart = marks.length > 0 ? Math.min(...marks) : nowMs;
  // Das Fenster endet am letzten bekannten Zeitpunkt (Plan oder Ist) – nicht an
  // "jetzt", sonst würde die Zeitleiste einfach mit der Uhr immer weiterwachsen.
  const domainEnd = (marks.length > 0 ? Math.max(...marks) : nowMs) + 5 * 60_000;

  const delays = teams.map((t) => t.delayMs).filter((v): v is number => v !== null);

  return {
    domainStart,
    domainEnd,
    teams,
    stations,
    medianDelayMs: median(delays),
    worstDelayMs: delays.length > 0 ? Math.max(...delays) : null,
  };
}

/** „+7 min", „−3 min" oder „im Plan" – die Uhrzeit interessiert dabei nicht. */
export function formatDelay(delayMs: number | null): string {
  if (delayMs === null) return 'noch nicht da';
  const minutes = Math.round(delayMs / 60_000);
  if (minutes === 0) return 'im Plan';
  return minutes > 0 ? `+${minutes} min` : `−${Math.abs(minutes)} min`;
}

export function formatDuration(value: number | null): string | null {
  if (value === null || value <= 0) return null;
  const minutes = Math.round(value / 60_000);
  if (minutes < 60) return `${minutes} min`;
  return `${Math.floor(minutes / 60)} h ${String(minutes % 60).padStart(2, '0')} min`;
}

export type DelayTone = 'ahead' | 'onTime' | 'slipping' | 'late';

/** Ab wann ein Verzug erwähnenswert bzw. kritisch ist. */
export const SLIPPING_MS = 5 * 60_000;
export const LATE_MS = 12 * 60_000;

export function delayTone(delayMs: number | null): DelayTone {
  if (delayMs === null) return 'onTime';
  if (delayMs <= -SLIPPING_MS) return 'ahead';
  if (delayMs >= LATE_MS) return 'late';
  if (delayMs >= SLIPPING_MS) return 'slipping';
  return 'onTime';
}

export const legPhaseLabel: Record<LegPhase, string> = {
  planned: 'Noch nicht da',
  waiting: 'Wartet',
  playing: 'Spielt',
  played: 'Fertig',
  released: 'Weitergeschickt',
  cancelled: 'Abgesagt',
};
