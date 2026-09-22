import AsyncStorage from '@react-native-async-storage/async-storage';
import type {
  LocalCheckin,
  LocalResultSubmission,
  OutboxEntry,
  StationPackage,
  SyncCounts,
} from './types';
import type { StationState } from './store';

/**
 * Web-Fallback des Stationsspeichers: dieselbe Schnittstelle wie `store.ts`,
 * aber auf AsyncStorage (im Browser localStorage) statt SQLite. Web ist für
 * verlässliche Offline-Ergebnissicherung nicht qualifiziert — siehe README
 * und docs/datenkonzept.md Abschnitt 11.2.
 */

type Db = {
  device: { id: string; label: string } | null;
  stationState: Record<string, StationState>;
  packages: Record<string, { pkg: StationPackage; contentHash: string }>;
  checkins: Record<string, LocalCheckin>;
  submissions: Record<string, LocalResultSubmission & { serverStatus?: string | null; serverVersion?: number | null }>;
  outbox: Record<string, OutboxEntry>;
  drafts: Record<string, unknown>;
  toolState: Record<string, unknown>;
  positionCounter: number;
};

const STORAGE_KEY = 'sporttag_station_store_v1';
let cache: Db | null = null;

function emptyDb(): Db {
  return {
    device: null,
    stationState: {},
    packages: {},
    checkins: {},
    submissions: {},
    outbox: {},
    drafts: {},
    toolState: {},
    positionCounter: 0,
  };
}

async function load(): Promise<Db> {
  if (cache) return cache;
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    cache = raw ? (JSON.parse(raw) as Db) : emptyDb();
  } catch {
    cache = emptyDb();
  }
  return cache;
}

async function persist() {
  if (!cache) return;
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(cache));
  } catch {
    // Web-Speicher ist best effort; siehe Modulkommentar.
  }
}

export async function getOrCreateDevice(makeId: () => string, makeLabel: () => string) {
  const db = await load();
  if (db.device) return db.device;
  db.device = { id: makeId(), label: makeLabel() };
  await persist();
  return db.device;
}

export type { StationState };

export async function getStationState(eventId: string): Promise<StationState | null> {
  const db = await load();
  return db.stationState[eventId] ?? null;
}

export async function getAnyStationState(): Promise<StationState | null> {
  const db = await load();
  const first = Object.values(db.stationState)[0];
  return first ?? null;
}

export async function ensureStationState(eventId: string, accessId: string) {
  const db = await load();
  db.stationState[eventId] = db.stationState[eventId] ?? {
    eventId,
    accessId,
    staffId: null,
    activeCheckinId: null,
    nextSequence: 1,
    lastDownloadAt: null,
    lastManifestResult: null,
  };
  db.stationState[eventId].accessId = accessId;
  await persist();
}

export async function setStaffId(eventId: string, staffId: string) {
  const db = await load();
  if (db.stationState[eventId]) db.stationState[eventId].staffId = staffId;
  await persist();
}

export async function setActiveCheckin(eventId: string, checkinId: string | null) {
  const db = await load();
  if (db.stationState[eventId]) db.stationState[eventId].activeCheckinId = checkinId;
  await persist();
}

export async function setLastDownloadAt(eventId: string, iso: string) {
  const db = await load();
  if (db.stationState[eventId]) db.stationState[eventId].lastDownloadAt = iso;
  await persist();
}

export async function setLastManifestResult(eventId: string, json: string) {
  const db = await load();
  if (db.stationState[eventId]) db.stationState[eventId].lastManifestResult = json;
  await persist();
}

export async function clearStationSession(eventId: string) {
  const db = await load();
  if (db.stationState[eventId]) {
    db.stationState[eventId].staffId = null;
    db.stationState[eventId].activeCheckinId = null;
  }
  await persist();
}

export async function savePackage(eventId: string, pkg: StationPackage, contentHash: string) {
  const db = await load();
  db.packages[eventId] = { pkg, contentHash };
  await persist();
}

export async function loadPackage(eventId: string): Promise<StationPackage | null> {
  const db = await load();
  return db.packages[eventId]?.pkg ?? null;
}

export async function loadAnyPackage(): Promise<{ eventId: string; pkg: StationPackage } | null> {
  const db = await load();
  const entry = Object.entries(db.packages)[0];
  if (!entry) return null;
  return { eventId: entry[0], pkg: entry[1].pkg };
}

async function nextPosition(db: Db) {
  db.positionCounter += 1;
  return db.positionCounter;
}

export async function saveCheckin(checkin: LocalCheckin) {
  const db = await load();
  db.checkins[checkin.id] = checkin;
  const position = await nextPosition(db);
  db.outbox[checkin.id] = {
    requestId: checkin.id,
    kind: 'checkin',
    position,
    state: 'pending',
    attemptCount: 0,
    nextAttemptAt: null,
    lastError: null,
    receiptStatus: null,
  };
  await persist();
}

export async function loadCheckins(eventId: string): Promise<LocalCheckin[]> {
  const db = await load();
  return Object.values(db.checkins)
    .filter((c) => c.eventId === eventId)
    .sort((a, b) => a.checkedInAt.localeCompare(b.checkedInAt));
}

export async function loadActiveCheckin(eventId: string): Promise<LocalCheckin | null> {
  const all = await loadCheckins(eventId);
  const active = all.filter((c) => !c.checkedOutAt);
  return active[active.length - 1] ?? null;
}

export async function saveResultSubmission(submission: LocalResultSubmission) {
  const db = await load();
  db.submissions[submission.requestId] = submission;
  const position = await nextPosition(db);
  db.outbox[submission.requestId] = {
    requestId: submission.requestId,
    kind: 'result',
    position,
    state: 'pending',
    attemptCount: 0,
    nextAttemptAt: null,
    lastError: null,
    receiptStatus: null,
  };
  const state = db.stationState[submission.eventId];
  if (state && state.nextSequence <= submission.localSequence) {
    state.nextSequence = submission.localSequence + 1;
  }
  await persist();
}

export async function loadResultSubmissions(eventId: string): Promise<LocalResultSubmission[]> {
  const db = await load();
  return Object.values(db.submissions)
    .filter((s) => s.eventId === eventId)
    .sort((a, b) => a.localSequence - b.localSequence);
}

export async function setSubmissionServerStatus(requestId: string, status: string, version: number | null) {
  const db = await load();
  const submission = db.submissions[requestId];
  if (submission) {
    submission.serverStatus = status;
    submission.serverVersion = version;
  }
  await persist();
}

export async function getSubmissionServerStatus(requestId: string): Promise<{ status: string | null; version: number | null } | null> {
  const db = await load();
  const submission = db.submissions[requestId];
  if (!submission) return null;
  return { status: submission.serverStatus ?? null, version: submission.serverVersion ?? null };
}

export async function loadOutbox(eventId: string): Promise<OutboxEntry[]> {
  const db = await load();
  const relevantIds = new Set([
    ...Object.values(db.checkins).filter((c) => c.eventId === eventId).map((c) => c.id),
    ...Object.values(db.submissions).filter((s) => s.eventId === eventId).map((s) => s.requestId),
  ]);
  return Object.values(db.outbox)
    .filter((o) => relevantIds.has(o.requestId))
    .sort((a, b) => a.position - b.position);
}

export async function markOutboxSending(requestId: string) {
  const db = await load();
  if (db.outbox[requestId]) db.outbox[requestId].state = 'sending';
  await persist();
}

export async function markOutboxReceived(requestId: string, receiptStatus: string) {
  const db = await load();
  if (db.outbox[requestId]) {
    db.outbox[requestId].state = 'received';
    db.outbox[requestId].receiptStatus = receiptStatus;
  }
  await persist();
}

export async function markOutboxFailed(requestId: string, error: string, nextAttemptAt: string) {
  const db = await load();
  const entry = db.outbox[requestId];
  if (entry) {
    entry.state = 'pending';
    entry.attemptCount += 1;
    entry.lastError = error;
    entry.nextAttemptAt = nextAttemptAt;
  }
  await persist();
}

export async function countSyncByEvent(eventId: string): Promise<SyncCounts> {
  const outbox = await loadOutbox(eventId);
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
  }
  return { pending, sending, review, synced };
}

export async function saveDraft(matchId: string, eventId: string, draft: unknown) {
  const db = await load();
  db.drafts[matchId] = draft;
  void eventId;
  await persist();
}

export async function loadDraft<T>(matchId: string): Promise<T | null> {
  const db = await load();
  return (db.drafts[matchId] as T) ?? null;
}

export async function clearDraft(matchId: string) {
  const db = await load();
  delete db.drafts[matchId];
  await persist();
}

export async function saveToolState(id: string, eventId: string, matchId: string | null, toolKey: string, state: unknown) {
  const db = await load();
  db.toolState[id] = state;
  void eventId;
  void matchId;
  void toolKey;
  await persist();
}

export async function loadToolState<T>(id: string): Promise<T | null> {
  const db = await load();
  return (db.toolState[id] as T) ?? null;
}
