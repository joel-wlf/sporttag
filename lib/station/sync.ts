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

function isNetworkError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return /network|fetch|timeout|failed to fetch/i.test(message);
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

async function syncOneResult(eventId: string, requestId: string, deviceId: string, accessId: string) {  const submissions = await store.loadResultSubmissions(eventId);
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

/** Leert die Outbox eines Events. Gibt zurück, wie es lief, ohne zu werfen. */
export async function syncNow(eventId: string): Promise<SyncOutcome> {
  const device = await getDevice();
  const state = await store.getStationState(eventId);
  if (!state?.accessId) return 'unauthorized';

  const outbox = await store.loadOutbox(eventId);
  const pending = outbox.filter((o) => o.state !== 'received');

  for (const entry of pending) {
    try {
      if (entry.kind === 'checkin') {
        await syncOneCheckin(eventId, entry.requestId, device.id);
      } else {
        await syncOneResult(eventId, entry.requestId, device.id, state.accessId);
      }
    } catch (error) {
      if (isNetworkError(error)) return 'offline';
      const message = error instanceof Error ? error.message : String(error);
      const isAuthError = /not authorized|authentication required|revoked/i.test(message);
      await store.markOutboxFailed(entry.requestId, message, new Date(Date.now() + backoffMs(entry.attemptCount)).toISOString());
      if (isAuthError) return 'unauthorized';
      return 'error';
    }
  }

  // Live-Zwischenstände erst nach den Check-ins: der Server verlangt einen
  // passenden Check-in. Ein Fehlschlag (z. B. Check-in noch nicht übertragen)
  // lässt den Stand schmutzig; der nächste Sync versucht es erneut.
  const dirtyLive = await store.loadDirtyLiveStates(eventId);
  for (const live of dirtyLive) {
    try {
      await syncOneLive(eventId, live, device.id, state.accessId);
    } catch (error) {
      if (isNetworkError(error)) return 'offline';
      const message = error instanceof Error ? error.message : String(error);
      if (/not authorized|authentication required|revoked/i.test(message)) return 'unauthorized';
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
      const message = error instanceof Error ? error.message : String(error);
      if (/not authorized|authentication required|revoked/i.test(message)) return 'unauthorized';
      await store.markTeamVisitSynced(visit.participantId, visit.updatedAt);
    }
  }

  await reportDeviceState(eventId, state);
  return 'ok';
}

export async function reportDeviceState(eventId: string, state?: StationState | null) {
  const device = await getDevice();
  const current = state ?? (await store.getStationState(eventId));
  if (!current) return;
  const pkg = await store.loadPackage(eventId);
  try {
    await supabase.rpc('report_device_state', {
      p_event_id: eventId,
      p_device_id: device.id,
      p_plan_version: pkg?.event.plan_version ?? 1,
      p_last_sequence: current.nextSequence - 1,
    });
  } catch {
    // Heartbeat ist informativ; ein Fehlschlag darf die Outbox nicht blockieren.
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
