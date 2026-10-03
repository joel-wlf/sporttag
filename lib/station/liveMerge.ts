import type { LiveValue, LocalLiveState } from './types';

/**
 * Zusammenführung des geteilten Live-Zwischenstands (docs/datenkonzept.md 11.6).
 *
 * Zählerspiele schreiben je Team einen Eintrag mit Versionsnummer `rev`. Zwei
 * Geräte, die verschiedene Teams zählen, überschreiben sich dadurch nicht;
 * pro Team gewinnt die höhere Version. Bei gleicher Version entscheidet das
 * Gerät (`by`), danach der Wert, damit alle Beteiligten – auch der Server –
 * unabhängig von der Ankunftsreihenfolge zum selben Ergebnis kommen. Die
 * Regel muss mit `sync_match_live` in der Datenbank übereinstimmen.
 *
 * Stände ohne `rev` (Ausgang, Platzierungen) sind Gesamtmomentaufnahmen:
 * dort gilt weiterhin der zuletzt geschriebene Stand.
 */

export function isCounterState(values: LiveValue[]): boolean {
  return values.some((v) => v.rev !== undefined && v.rev !== null);
}

function compareText(a: string, b: string): number {
  // Wie `collate "C"` in der Datenbank: Vergleich nach Codepunkten.
  return a < b ? -1 : a > b ? 1 : 0;
}

/** Positiv, wenn `a` den Eintrag `b` desselben Teams verdrängt. */
function compareEntries(a: LiveValue, b: LiveValue): number {
  const rev = (a.rev ?? 0) - (b.rev ?? 0);
  if (rev !== 0) return rev;
  const by = compareText(a.by ?? '', b.by ?? '');
  if (by !== 0) return by;
  return (a.measured_value ?? Number.NEGATIVE_INFINITY) - (b.measured_value ?? Number.NEGATIVE_INFINITY) || 0;
}

export function mergeLiveValues(a: LiveValue[], b: LiveValue[]): LiveValue[] {
  const byParticipant = new Map<string, LiveValue>();
  for (const entry of [...a, ...b]) {
    const current = byParticipant.get(entry.participant_id);
    if (!current || compareEntries(entry, current) > 0) byParticipant.set(entry.participant_id, entry);
  }
  return [...byParticipant.values()].sort((x, y) => compareText(x.participant_id, y.participant_id));
}

export function sameLiveValues(a: LiveValue[], b: LiveValue[]): boolean {
  if (a.length !== b.length) return false;
  const key = (v: LiveValue) =>
    `${v.participant_id}|${v.rev ?? 0}|${v.by ?? ''}|${v.measured_value ?? ''}|${v.placement ?? ''}`;
  const left = a.map(key).sort();
  const right = b.map(key).sort();
  return left.every((entry, index) => entry === right[index]);
}

/**
 * Trägt eine lokale Zähleränderung ein. Jede Änderung erhöht die Version des
 * betroffenen Teams gegenüber dem bekannten Stand (lokal oder von anderen
 * Geräten übernommen); Teams ohne Änderung bleiben unberührt.
 */
export function applyCounterChanges(
  current: LiveValue[],
  changes: { participant_id: string; measured_value: number }[],
  deviceId: string,
): LiveValue[] {
  const changed: LiveValue[] = changes.map((change) => {
    const known = current.find((v) => v.participant_id === change.participant_id);
    return {
      participant_id: change.participant_id,
      measured_value: change.measured_value,
      rev: (known?.rev ?? 0) + 1,
      by: deviceId,
    };
  });
  return mergeLiveValues(current, changed);
}

type RemoteLive = { values: LiveValue[]; startedAt: string | null; updatedAt: string };

/**
 * Führt einen vom Server gelesenen Stand mit dem lokalen zusammen.
 *
 * Zähler: je Team die höhere Version. Hat das Gerät Einträge, die der Server
 * noch nicht kennt (zum Beispiel offen gezählt), bleibt der Stand ungesendet
 * und geht beim nächsten Abgleich hinaus, statt vom Serverstand verdrängt zu
 * werden. Momentaufnahmen: ein ungesendeter, neuerer lokaler Stand gewinnt,
 * sonst gilt der Serverstand (ein bereits übertragener Stand mit einer
 * vorgehenden Gerätezeit darf spätere Änderungen anderer Geräte nicht
 * dauerhaft verdecken).
 */
export function mergeLiveState(
  local: LocalLiveState | undefined,
  remote: RemoteLive,
  eventId: string,
  matchId: string,
): LocalLiveState {
  const remoteState: LocalLiveState = {
    matchId,
    eventId,
    checkinId: local?.checkinId ?? '',
    values: remote.values,
    started: Boolean(remote.startedAt),
    dirty: false,
    updatedAt: remote.updatedAt,
  };
  if (!local) return remoteState;

  if (isCounterState(local.values) || isCounterState(remote.values)) {
    const values = mergeLiveValues(local.values, remote.values);
    const dirty = !sameLiveValues(values, remote.values);
    const newer = Date.parse(local.updatedAt) > Date.parse(remote.updatedAt) ? local.updatedAt : remote.updatedAt;
    return {
      ...remoteState,
      values,
      started: local.started || remoteState.started,
      dirty,
      updatedAt: dirty ? newer : remote.updatedAt,
    };
  }

  if (local.dirty && Date.parse(local.updatedAt) >= Date.parse(remote.updatedAt)) return local;
  return remoteState;
}
