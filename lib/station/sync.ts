import { supabase } from '@/lib/supabase';
import * as store from './store';
import { getDevice } from './identity';
import type { StationState } from './store';
import type { LocalLiveState, LocalTeamVisit } from './types';

/**
 * Sync-Engine: leert die Outbox in Erstellungsreihenfolge (Check-ins vor
 * Ergebnissen), mit Backoff und Jitter, ohne je etwas zu löschen. Siehe
 * docs/datenkonzept.md Abschnitt 11.3.
 */

export type SyncOutcome = 'ok' | 'offline' | 'unauthorized' | 'error';

function backoffMs(attempt: number) {
  const base = Math.min(30000, 1000 * 2 ** attempt);
  return base + Math.random() * 500;
}

/**
 * Fehlertext aus Supabase-Fehlern. PostgREST liefert Fehler als schlichte
 * Objekte mit `message`, nicht als `Error` — `String(error)` ergab bisher
 * "[object Object]", wodurch weder "offline" noch ein widerrufener Zugang
 * erkannt wurde.
 */
export function syncErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (error && typeof error === 'object' && 'message' in error) {
    return String((error as { message: unknown }).message);
  }
  return String(error);
}

function isNetworkError(error: unknown) {
  return /network request failed|failed to fetch|fetch failed|networkerror|network error|timed? ?out|aborted|load failed/i.test(
    syncErrorMessage(error),
  );
}

function isAuthError(error: unknown) {
  // "permission denied for function": Die Anfrage lief ohne gültige
  // Gerätesitzung (nur mit dem öffentlichen Schlüssel), etwa nach verlorener
  // anonymer Sitzung. Ohne diesen Fall erschien nie "Neu beitreten".
  return /not authorized|authentication required|revoked|permission denied for function/i.test(
    syncErrorMessage(error),
  );
}

async function syncOneCheckin(eventId: string, requestId: string, deviceId: string) {
  const checkins = await store.loadCheckins(eventId);
  const checkin = checkins.find((c) => c.id === requestId);
  if (!checkin) return;
  await store.markOutboxSending(requestId);
  const { error } = await supabase.rpc('sync_station_checkin', {
    p_id: checkin.id,
    p_event_id: checkin.eventId,
    p_station_setup_id: checkin.stationSetupId,
    p_device_id: deviceId,
    p_checked_in_at: checkin.checkedInAt,
    p_checked_out_at: checkin.checkedOutAt ?? undefined,
    p_staff_ids: checkin.staffIds,
  });
  if (error) throw error;
  await store.markOutboxReceived(requestId, 'accepted');
}

async function syncOneResult(eventId: string, requestId: string, deviceId: string, accessId: string) {
  const submissions = await store.loadResultSubmissions(eventId);
  const submission = submissions.find((s) => s.requestId === requestId);
  if (!submission) return;
  await store.markOutboxSending(requestId);
  const { data, error } = await supabase.rpc('submit_result', {
    p_request_id: submission.requestId,
    p_event_id: submission.eventId,
    p_match_id: submission.matchId,
    p_device_id: deviceId,
    p_device_access_id: accessId,
    p_checkin_id: submission.checkinId,
    p_local_sequence: submission.localSequence,
    p_base_result_version: submission.baseResultVersion,
    p_plan_version: submission.planVersion,
    p_payload: submission.payload,
    p_payload_hash: submission.payloadHash,
    p_captured_at: submission.capturedAt,
    p_reason: submission.reason ?? undefined,
  });
  if (error) throw error;
  const row = Array.isArray(data) ? data[0] : data;
  await store.setSubmissionServerStatus(requestId, row.status, row.result_version ?? null);
  await store.markOutboxReceived(requestId, row.status);
}

/** Überträgt einen Live-Zwischenstand; er ist nie Teil der nummerierten Ergebnisse. */
async function syncOneLive(eventId: string, live: LocalLiveState, deviceId: string, accessId: string) {
  const { error } = await supabase.rpc('sync_match_live', {
    p_event_id: eventId,
    p_match_id: live.matchId,
    p_device_id: deviceId,
    p_device_access_id: accessId,
    p_checkin_id: live.checkinId,
    p_values: live.values,
    p_started: live.started,
    p_updated_at: live.updatedAt,
  });
  if (error) throw error;
  await store.markLiveStateSynced(live.matchId, live.updatedAt);
}

/**
 * Überträgt einen Laufzettel-Eintrag (Ankunft/Weiterschickung einer Gruppe).
 * Wie der Live-Stand ist er fortlaufend und nie Teil der Ergebnissicherung.
 */
async function syncOneVisit(eventId: string, visit: LocalTeamVisit, deviceId: string, accessId: string) {
  const { error } = await supabase.rpc('sync_team_visit', {
    p_event_id: eventId,
    p_participant_id: visit.participantId,
    p_device_id: deviceId,
    p_device_access_id: accessId,
    p_checkin_id: visit.checkinId,
    p_arrived_at: visit.arrivedAt ?? undefined,
    p_released_at: visit.releasedAt ?? undefined,
    p_updated_at: visit.updatedAt,
  });
  if (error) throw error;
  await store.markTeamVisitSynced(visit.participantId, visit.updatedAt);
}

/**
 * Leert die Outbox eines Events. Gibt zurück, wie es lief, ohne zu werfen.
 *
 * Ein vom Server abgelehnter Eintrag (z. B. Match inzwischen gelöscht) darf
 * die übrigen nicht aufhalten: er bekommt Backoff und die Schleife läuft
 * weiter. Nur fehlendes Netz oder ein ungültiger Gerätezugang brechen ab.
 * `force` (manueller Sync) ignoriert den Backoff.
 */
export async function syncNow(eventId: string, options?: { force?: boolean }): Promise<SyncOutcome> {
  const device = await getDevice();
  const state = await store.getStationState(eventId);
  if (!state?.accessId) return 'unauthorized';

  const outbox = await store.loadOutbox(eventId);
  const now = Date.now();
  const pending = outbox.filter(
    (o) =>
      o.state !== 'received' &&
      (options?.force || !o.nextAttemptAt || new Date(o.nextAttemptAt).getTime() <= now),
  );
  let hadError = outbox.some((o) => o.state !== 'received' && !pending.includes(o));

  // Reihenfolge: Check-ins (Voraussetzung für alles andere), dann Live-Stände
  // und Laufzettel, zuletzt Ergebnisse. Kam das Ergebnis zuerst an, setzte
  // der Server Start = Ende, und der danach eintreffende Live-Start wurde am
  // abgeschlossenen Match ignoriert — offline erfasste Matches hatten in der
  // Zeitleiste die Dauer null.
  const sendEntries = async (kind: 'checkin' | 'result'): Promise<SyncOutcome | null> => {
    for (const entry of pending.filter((o) => o.kind === kind)) {
      try {
        if (entry.kind === 'checkin') {
          await syncOneCheckin(eventId, entry.requestId, device.id);
        } else {
          await syncOneResult(eventId, entry.requestId, device.id, state.accessId!);
        }
      } catch (error) {
        if (isNetworkError(error)) {
          await store.markOutboxPending(entry.requestId);
          return 'offline';
        }
        await store.markOutboxFailed(
          entry.requestId,
          syncErrorMessage(error),
          new Date(Date.now() + backoffMs(entry.attemptCount)).toISOString(),
        );
        if (isAuthError(error)) return 'unauthorized';
        hadError = true;
      }
    }
    return null;
  };

  const checkinOutcome = await sendEntries('checkin');
  if (checkinOutcome) return checkinOutcome;

  // Live-Stände erst nach den Check-ins: der Server verlangt einen
  // passenden Check-in. Ein Fehlschlag (z. B. Check-in noch nicht übertragen)
  // lässt den Stand schmutzig; der nächste Sync versucht es erneut.
  const dirtyLive = await store.loadDirtyLiveStates(eventId);
  for (const live of dirtyLive) {
    try {
      await syncOneLive(eventId, live, device.id, state.accessId);
    } catch (error) {
      if (isNetworkError(error)) return 'offline';
      if (isAuthError(error)) return 'unauthorized';
      // Live-Stände sind unkritisch: einen dauerhaft abgelehnten Stand (z. B.
      // Check-in passt nicht mehr) nicht endlos erneut versuchen. Die nächste
      // Eingabe setzt den Stand wieder schmutzig.
      await store.markLiveStateSynced(live.matchId, live.updatedAt);
    }
  }

  // Laufzettel der Gruppen, aus denselben Gründen und mit derselben Nachsicht
  // wie die Live-Stände: sie dokumentieren den Ablauf, nicht das Ergebnis.
  const dirtyVisits = await store.loadDirtyTeamVisits(eventId);
  for (const visit of dirtyVisits) {
    try {
      await syncOneVisit(eventId, visit, device.id, state.accessId);
    } catch (error) {
      if (isNetworkError(error)) return 'offline';
      if (isAuthError(error)) return 'unauthorized';
      await store.markTeamVisitSynced(visit.participantId, visit.updatedAt);
    }
  }

  const resultOutcome = await sendEntries('result');
  if (resultOutcome) return resultOutcome;

  await refreshReviewStatuses(eventId);

  // Der Heartbeat zeigt zugleich, ob der Server überhaupt erreichbar ist:
  // ohne ihn meldete ein Gerät ohne offene Einträge offline "synchronisiert".
  const heartbeat = await reportDeviceState(eventId, state);
  if (heartbeat === 'offline' || heartbeat === 'unauthorized') return heartbeat;
  return hadError ? 'error' : 'ok';
}

/**
 * Holt den aktuellen Serverstatus eigener Abgaben, die bei der Übertragung
 * Klärung brauchten. Ohne diesen Abgleich blieb "Klärung nötig" am Gerät
 * stehen, auch nachdem die Leitung die Abgabe längst übernommen hatte.
 */
async function refreshReviewStatuses(eventId: string) {
  const outbox = await store.loadOutbox(eventId);
  const open = outbox.filter(
    (o) => o.kind === 'result' && o.state === 'received' && (o.receiptStatus === 'conflict' || o.receiptStatus === 'needs_review'),
  );
  if (open.length === 0) return;
  try {
    const { data, error } = await supabase
      .from('result_submissions')
      .select('request_id, status')
      .in('request_id', open.map((o) => o.requestId));
    if (error || !data) return;
    for (const row of data) {
      const entry = open.find((o) => o.requestId === row.request_id);
      if (entry && row.status !== entry.receiptStatus) {
        await store.updateReceiptStatus(row.request_id, row.status);
      }
    }
  } catch {
    // Informativ: der nächste Sync versucht es erneut.
  }
}

export async function reportDeviceState(
  eventId: string,
  state?: StationState | null,
): Promise<'ok' | 'offline' | 'unauthorized' | 'error'> {
  const device = await getDevice();
  const current = state ?? (await store.getStationState(eventId));
  if (!current) return 'error';
  const pkg = await store.loadPackage(eventId);
  // Heartbeat ist informativ; ein Fehlschlag darf die Outbox nicht blockieren.
  try {
    const { error } = await supabase.rpc('report_device_state', {
      p_event_id: eventId,
      p_device_id: device.id,
      p_plan_version: pkg?.event.plan_version ?? 1,
      p_last_sequence: current.nextSequence - 1,
    });
    if (!error) return 'ok';
    return isNetworkError(error) ? 'offline' : isAuthError(error) ? 'unauthorized' : 'error';
  } catch (error) {
    return isNetworkError(error) ? 'offline' : isAuthError(error) ? 'unauthorized' : 'error';
  }
}

export type ManifestResult = { complete: boolean; missing_sequences: number[]; mismatched: unknown[] };

/** Meldet das Abschlussmanifest — der garantierte Mindestweg ohne Internet zwischendurch. */
export async function submitManifest(eventId: string): Promise<ManifestResult> {
  const device = await getDevice();
  const state = await store.getStationState(eventId);
  const submissions = await store.loadResultSubmissions(eventId);
  const finalSequence = state ? state.nextSequence - 1 : 0;
  const entries = submissions.map((s) => ({
    request_id: s.requestId,
    local_sequence: s.localSequence,
    payload_hash: s.payloadHash,
  }));
  const { data, error } = await supabase.rpc('submit_device_manifest', {
    p_event_id: eventId,
    p_device_id: device.id,
    p_final_sequence: finalSequence,
    p_entries: entries,
  });
  if (error) throw error;
  const result = data as ManifestResult;
  await store.setLastManifestResult(eventId, JSON.stringify(result));
  return result;
}
