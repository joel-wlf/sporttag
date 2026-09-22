import * as SQLite from 'expo-sqlite';
import type {
  LocalCheckin,
  LocalResultSubmission,
  OutboxEntry,
  OutboxKind,
  StationPackage,
  SyncCounts,
} from './types';

/**
 * Persistenter lokaler Speicher des Stationsgeräts. Native Implementierung
 * über expo-sqlite (WAL, Fremdschlüssel aktiv, synchronous=FULL). Ein
 * Ergebnis wird in einer einzigen Transaktion gesichert: Abgabe, Sequenz und
 * Outbox-Eintrag gemeinsam — siehe docs/datenkonzept.md Abschnitt 11.2.
 * Web verwendet `store.web.ts` mit derselben Schnittstelle.
 */

let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;

function getDb() {
  if (!dbPromise) dbPromise = openDb();
  return dbPromise;
}

async function openDb() {
  const db = await SQLite.openDatabaseAsync('sporttag_station.db');
  await db.execAsync(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;
    PRAGMA synchronous = FULL;

    CREATE TABLE IF NOT EXISTS device (
      id TEXT PRIMARY KEY,
      label TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS station_state (
      event_id TEXT PRIMARY KEY,
      access_id TEXT,
      staff_id TEXT,
      active_checkin_id TEXT,
      next_sequence INTEGER NOT NULL DEFAULT 1,
      last_download_at TEXT,
      last_manifest_result TEXT
    );

    CREATE TABLE IF NOT EXISTS local_event_packages (
      event_id TEXT PRIMARY KEY,
      plan_version INTEGER NOT NULL,
      package_json TEXT NOT NULL,
      content_hash TEXT NOT NULL,
      downloaded_at TEXT NOT NULL,
      verified_at TEXT
    );

    CREATE TABLE IF NOT EXISTS local_checkins (
      id TEXT PRIMARY KEY,
      event_id TEXT NOT NULL,
      station_setup_id TEXT NOT NULL,
      checked_in_at TEXT NOT NULL,
      checked_out_at TEXT,
      staff_ids TEXT NOT NULL DEFAULT '[]'
    );

    CREATE TABLE IF NOT EXISTS local_result_submissions (
      request_id TEXT PRIMARY KEY,
      event_id TEXT NOT NULL,
      match_id TEXT NOT NULL,
      checkin_id TEXT NOT NULL,
      local_sequence INTEGER NOT NULL,
      base_result_version INTEGER NOT NULL,
      plan_version INTEGER NOT NULL,
      payload_json TEXT NOT NULL,
      payload_hash TEXT NOT NULL,
      captured_at TEXT NOT NULL,
      reason TEXT,
      server_status TEXT,
      server_version INTEGER
    );

    CREATE TABLE IF NOT EXISTS local_outbox (
      request_id TEXT PRIMARY KEY,
      kind TEXT NOT NULL,
      position INTEGER NOT NULL,
      state TEXT NOT NULL DEFAULT 'pending',
      attempt_count INTEGER NOT NULL DEFAULT 0,
      next_attempt_at TEXT,
      last_error TEXT,
      receipt_status TEXT
    );

    CREATE TABLE IF NOT EXISTS local_result_drafts (
      match_id TEXT PRIMARY KEY,
      event_id TEXT NOT NULL,
      draft_json TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS local_tool_state (
      id TEXT PRIMARY KEY,
      event_id TEXT NOT NULL,
      match_id TEXT,
      tool_key TEXT NOT NULL,
      state_json TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `);
  return db;
}

// ---------------------------------------------------------------------------
// Gerät
// ---------------------------------------------------------------------------

export async function getOrCreateDevice(makeId: () => string, makeLabel: () => string) {
  const db = await getDb();
  const existing = await db.getFirstAsync<{ id: string; label: string }>('SELECT id, label FROM device LIMIT 1');
  if (existing) return existing;
  const id = makeId();
  const label = makeLabel();
  await db.runAsync('INSERT INTO device (id, label) VALUES (?, ?)', id, label);
  return { id, label };
}

// ---------------------------------------------------------------------------
// Stationszustand (gewählte Person, aktiver Check-in, Sequenzzähler)
// ---------------------------------------------------------------------------

export type StationState = {
  eventId: string;
  accessId: string | null;
  staffId: string | null;
  activeCheckinId: string | null;
  nextSequence: number;
  lastDownloadAt: string | null;
  lastManifestResult: string | null;
};

export async function getStationState(eventId: string): Promise<StationState | null> {
  const db = await getDb();
  const row = await db.getFirstAsync<{
    event_id: string;
    access_id: string | null;
    staff_id: string | null;
    active_checkin_id: string | null;
    next_sequence: number;
    last_download_at: string | null;
    last_manifest_result: string | null;
  }>('SELECT * FROM station_state WHERE event_id = ?', eventId);
  if (!row) return null;
  return {
    eventId: row.event_id,
    accessId: row.access_id,
    staffId: row.staff_id,
    activeCheckinId: row.active_checkin_id,
    nextSequence: row.next_sequence,
    lastDownloadAt: row.last_download_at,
    lastManifestResult: row.last_manifest_result,
  };
}

export async function getAnyStationState(): Promise<StationState | null> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ event_id: string }>('SELECT event_id FROM station_state LIMIT 1');
  if (!row) return null;
  return getStationState(row.event_id);
}

export async function ensureStationState(eventId: string, accessId: string) {
  const db = await getDb();
  await db.runAsync(
    `INSERT INTO station_state (event_id, access_id, next_sequence) VALUES (?, ?, 1)
     ON CONFLICT(event_id) DO UPDATE SET access_id = excluded.access_id`,
    eventId,
    accessId,
  );
}

export async function setStaffId(eventId: string, staffId: string) {
  const db = await getDb();
  await db.runAsync('UPDATE station_state SET staff_id = ? WHERE event_id = ?', staffId, eventId);
}

export async function setActiveCheckin(eventId: string, checkinId: string | null) {
  const db = await getDb();
  await db.runAsync('UPDATE station_state SET active_checkin_id = ? WHERE event_id = ?', checkinId, eventId);
}

export async function setLastDownloadAt(eventId: string, iso: string) {
  const db = await getDb();
  await db.runAsync('UPDATE station_state SET last_download_at = ? WHERE event_id = ?', iso, eventId);
}

export async function setLastManifestResult(eventId: string, json: string) {
  const db = await getDb();
  await db.runAsync('UPDATE station_state SET last_manifest_result = ? WHERE event_id = ?', json, eventId);
}

export async function clearStationSession(eventId: string) {
  const db = await getDb();
  await db.runAsync('UPDATE station_state SET staff_id = NULL, active_checkin_id = NULL WHERE event_id = ?', eventId);
}

// ---------------------------------------------------------------------------
// Offline-Paket
// ---------------------------------------------------------------------------

export async function savePackage(eventId: string, pkg: StationPackage, contentHash: string) {
  const db = await getDb();
  const now = new Date().toISOString();
  await db.runAsync(
    `INSERT INTO local_event_packages (event_id, plan_version, package_json, content_hash, downloaded_at, verified_at)
     VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT(event_id) DO UPDATE SET
       plan_version = excluded.plan_version,
       package_json = excluded.package_json,
       content_hash = excluded.content_hash,
       downloaded_at = excluded.downloaded_at,
       verified_at = excluded.verified_at`,
    eventId,
    pkg.event.plan_version,
    JSON.stringify(pkg),
    contentHash,
    now,
    now,
  );
}

export async function loadPackage(eventId: string): Promise<StationPackage | null> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ package_json: string }>(
    'SELECT package_json FROM local_event_packages WHERE event_id = ?',
    eventId,
  );
  if (!row) return null;
  return JSON.parse(row.package_json) as StationPackage;
}

export async function loadAnyPackage(): Promise<{ eventId: string; pkg: StationPackage } | null> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ event_id: string; package_json: string }>(
    'SELECT event_id, package_json FROM local_event_packages ORDER BY downloaded_at DESC LIMIT 1',
  );
  if (!row) return null;
  return { eventId: row.event_id, pkg: JSON.parse(row.package_json) as StationPackage };
}

// ---------------------------------------------------------------------------
// Check-ins (lokal) + Outbox
// ---------------------------------------------------------------------------

async function nextPosition(db: SQLite.SQLiteDatabase) {
  const row = await db.getFirstAsync<{ maxpos: number | null }>('SELECT MAX(position) as maxpos FROM local_outbox');
  return (row?.maxpos ?? 0) + 1;
}

/** Speichert einen Check-in lokal und reiht ihn atomar in die Outbox ein. */
export async function saveCheckin(checkin: LocalCheckin) {
  const db = await getDb();
  await db.withTransactionAsync(async () => {
    await db.runAsync(
      `INSERT INTO local_checkins (id, event_id, station_setup_id, checked_in_at, checked_out_at, staff_ids)
       VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         station_setup_id = excluded.station_setup_id,
         checked_in_at = excluded.checked_in_at,
         checked_out_at = excluded.checked_out_at,
         staff_ids = excluded.staff_ids`,
      checkin.id,
      checkin.eventId,
      checkin.stationSetupId,
      checkin.checkedInAt,
      checkin.checkedOutAt,
      JSON.stringify(checkin.staffIds),
    );
    const position = await nextPosition(db);
    await db.runAsync(
      `INSERT INTO local_outbox (request_id, kind, position, state)
       VALUES (?, 'checkin', ?, 'pending')
       ON CONFLICT(request_id) DO UPDATE SET state = 'pending', position = excluded.position`,
      checkin.id,
      position,
    );
  });
}

export async function loadCheckins(eventId: string): Promise<LocalCheckin[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<{
    id: string;
    event_id: string;
    station_setup_id: string;
    checked_in_at: string;
    checked_out_at: string | null;
    staff_ids: string;
  }>('SELECT * FROM local_checkins WHERE event_id = ? ORDER BY checked_in_at', eventId);
  return rows.map((r) => ({
    id: r.id,
    eventId: r.event_id,
    stationSetupId: r.station_setup_id,
    checkedInAt: r.checked_in_at,
    checkedOutAt: r.checked_out_at,
    staffIds: JSON.parse(r.staff_ids),
  }));
}

export async function loadActiveCheckin(eventId: string): Promise<LocalCheckin | null> {
  const db = await getDb();
  const row = await db.getFirstAsync<{
    id: string;
    event_id: string;
    station_setup_id: string;
    checked_in_at: string;
    checked_out_at: string | null;
    staff_ids: string;
  }>('SELECT * FROM local_checkins WHERE event_id = ? AND checked_out_at IS NULL ORDER BY checked_in_at DESC LIMIT 1', eventId);
  if (!row) return null;
  return {
    id: row.id,
    eventId: row.event_id,
    stationSetupId: row.station_setup_id,
    checkedInAt: row.checked_in_at,
    checkedOutAt: row.checked_out_at,
    staffIds: JSON.parse(row.staff_ids),
  };
}

// ---------------------------------------------------------------------------
// Ergebnisabgaben (lokal) + Outbox, in EINER Transaktion.
// ---------------------------------------------------------------------------

export async function saveResultSubmission(submission: LocalResultSubmission) {
  const db = await getDb();
  await db.withTransactionAsync(async () => {
    await db.runAsync(
      `INSERT INTO local_result_submissions (
        request_id, event_id, match_id, checkin_id, local_sequence, base_result_version,
        plan_version, payload_json, payload_hash, captured_at, reason
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      submission.requestId,
      submission.eventId,
      submission.matchId,
      submission.checkinId,
      submission.localSequence,
      submission.baseResultVersion,
      submission.planVersion,
      JSON.stringify(submission.payload),
      submission.payloadHash,
      submission.capturedAt,
      submission.reason,
    );
    const position = await nextPosition(db);
    await db.runAsync(
      `INSERT INTO local_outbox (request_id, kind, position, state) VALUES (?, 'result', ?, 'pending')`,
      submission.requestId,
      position,
    );
    await db.runAsync(
      'UPDATE station_state SET next_sequence = ? WHERE event_id = ? AND next_sequence <= ?',
      submission.localSequence + 1,
      submission.eventId,
      submission.localSequence,
    );
  });
}

export async function loadResultSubmissions(eventId: string): Promise<LocalResultSubmission[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<{
    request_id: string;
    event_id: string;
    match_id: string;
    checkin_id: string;
    local_sequence: number;
    base_result_version: number;
    plan_version: number;
    payload_json: string;
    payload_hash: string;
    captured_at: string;
    reason: string | null;
  }>('SELECT * FROM local_result_submissions WHERE event_id = ? ORDER BY local_sequence', eventId);
  return rows.map((r) => ({
    requestId: r.request_id,
    eventId: r.event_id,
    matchId: r.match_id,
    checkinId: r.checkin_id,
    localSequence: r.local_sequence,
    baseResultVersion: r.base_result_version,
    planVersion: r.plan_version,
    payload: JSON.parse(r.payload_json),
    payloadHash: r.payload_hash,
    capturedAt: r.captured_at,
    reason: r.reason,
  }));
}

export async function setSubmissionServerStatus(requestId: string, status: string, version: number | null) {
  const db = await getDb();
  await db.runAsync(
    'UPDATE local_result_submissions SET server_status = ?, server_version = ? WHERE request_id = ?',
    status,
    version,
    requestId,
  );
}

export async function getSubmissionServerStatus(requestId: string): Promise<{ status: string | null; version: number | null } | null> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ server_status: string | null; server_version: number | null }>(
    'SELECT server_status, server_version FROM local_result_submissions WHERE request_id = ?',
    requestId,
  );
  if (!row) return null;
  return { status: row.server_status, version: row.server_version };
}

// ---------------------------------------------------------------------------
// Outbox
// ---------------------------------------------------------------------------

export async function loadOutbox(eventId: string): Promise<OutboxEntry[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<{
    request_id: string;
    kind: OutboxKind;
    position: number;
    state: string;
    attempt_count: number;
    next_attempt_at: string | null;
    last_error: string | null;
    receipt_status: string | null;
  }>(
    `SELECT o.* FROM local_outbox o
     LEFT JOIN local_checkins c ON o.kind = 'checkin' AND c.id = o.request_id
     LEFT JOIN local_result_submissions r ON o.kind = 'result' AND r.request_id = o.request_id
     WHERE (c.event_id = ? OR r.event_id = ?)
     ORDER BY o.position`,
    eventId,
    eventId,
  );
  return rows.map((r) => ({
    requestId: r.request_id,
    kind: r.kind,
    position: r.position,
    state: r.state as OutboxEntry['state'],
    attemptCount: r.attempt_count,
    nextAttemptAt: r.next_attempt_at,
    lastError: r.last_error,
    receiptStatus: r.receipt_status,
  }));
}

export async function markOutboxSending(requestId: string) {
  const db = await getDb();
  await db.runAsync('UPDATE local_outbox SET state = ? WHERE request_id = ?', 'sending', requestId);
}

export async function markOutboxReceived(requestId: string, receiptStatus: string) {
  const db = await getDb();
  await db.runAsync(
    'UPDATE local_outbox SET state = ?, receipt_status = ? WHERE request_id = ?',
    'received',
    receiptStatus,
    requestId,
  );
}

export async function markOutboxFailed(requestId: string, error: string, nextAttemptAt: string) {
  const db = await getDb();
  await db.runAsync(
    `UPDATE local_outbox SET state = 'pending', attempt_count = attempt_count + 1,
     last_error = ?, next_attempt_at = ? WHERE request_id = ?`,
    error,
    nextAttemptAt,
    requestId,
  );
}

export async function countSyncByEvent(eventId: string): Promise<SyncCounts> {
  const outbox = await loadOutbox(eventId);
  const submissions = await loadResultSubmissions(eventId);
  const statusByRequest = new Map(submissions.map((s) => [s.requestId, s]));
  let pending = 0;
  let sending = 0;
  let review = 0;
  let synced = 0;
  for (const entry of outbox) {
    if (entry.kind !== 'result') continue;
    if (entry.state === 'pending') pending += 1;
    else if (entry.state === 'sending') sending += 1;
    else if (entry.state === 'received') {
      if (entry.receiptStatus === 'accepted') synced += 1;
      else review += 1;
    }
    void statusByRequest;
  }
  return { pending, sending, review, synced };
}

// ---------------------------------------------------------------------------
// Ergebnis-Entwürfe (unbestätigte Eingabe)
// ---------------------------------------------------------------------------

export async function saveDraft(matchId: string, eventId: string, draft: unknown) {
  const db = await getDb();
  await db.runAsync(
    `INSERT INTO local_result_drafts (match_id, event_id, draft_json, updated_at) VALUES (?, ?, ?, ?)
     ON CONFLICT(match_id) DO UPDATE SET draft_json = excluded.draft_json, updated_at = excluded.updated_at`,
    matchId,
    eventId,
    JSON.stringify(draft),
    new Date().toISOString(),
  );
}

export async function loadDraft<T>(matchId: string): Promise<T | null> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ draft_json: string }>(
    'SELECT draft_json FROM local_result_drafts WHERE match_id = ?',
    matchId,
  );
  if (!row) return null;
  return JSON.parse(row.draft_json) as T;
}

export async function clearDraft(matchId: string) {
  const db = await getDb();
  await db.runAsync('DELETE FROM local_result_drafts WHERE match_id = ?', matchId);
}

// ---------------------------------------------------------------------------
// Werkzeugzustände (Timer/Stoppuhr/Zähler)
// ---------------------------------------------------------------------------

export async function saveToolState(id: string, eventId: string, matchId: string | null, toolKey: string, state: unknown) {
  const db = await getDb();
  await db.runAsync(
    `INSERT INTO local_tool_state (id, event_id, match_id, tool_key, state_json, updated_at) VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET state_json = excluded.state_json, updated_at = excluded.updated_at`,
    id,
    eventId,
    matchId,
    toolKey,
    JSON.stringify(state),
    new Date().toISOString(),
  );
}

export async function loadToolState<T>(id: string): Promise<T | null> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ state_json: string }>('SELECT state_json FROM local_tool_state WHERE id = ?', id);
  if (!row) return null;
  return JSON.parse(row.state_json) as T;
}
