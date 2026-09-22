import * as Crypto from 'expo-crypto';
import { AppState, Platform } from 'react-native';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { supabase } from '@/lib/supabase';
import * as store from '@/lib/station/store';
import { getDevice, redeemCode, isStationSession } from '@/lib/station/identity';
import { downloadPackage, getAnyStoredPackage, getStoredPackage, dayPlan } from '@/lib/station/package';
import { hashPayload } from '@/lib/station/scoring';
import { syncNow, submitManifest as submitManifestRpc, type ManifestResult, type SyncOutcome } from '@/lib/station/sync';
import { subscribeStationRealtime } from '@/lib/station/realtime';
import type { DayEntry, LocalCheckin, ResultPayload, StationPackage, SyncCounts } from '@/lib/station/types';

type StationSessionValue = {
  isReady: boolean;
  eventId: string | null;
  pkg: StationPackage | null;
  staffId: string | null;
  staffName: string | null;
  entries: DayEntry[];
  activeCheckin: LocalCheckin | null;
  checkedInEntryId: string | null;
  syncCounts: SyncCounts;
  syncOutcome: SyncOutcome | 'idle' | 'syncing';
  lastSyncedAt: string | null;

  joinWithCode: (code: string) => Promise<{ ok: true } | { ok: false; error: string }>;
  retryDownload: () => Promise<{ ok: true } | { ok: false; error: string }>;
  selectStaff: (staffId: string) => void;
  checkIn: (setupId: string) => Promise<void>;
  checkOut: () => Promise<void>;
  saveResult: (matchId: string, payload: ResultPayload, reason?: string) => Promise<void>;
  syncNow: () => Promise<void>;
  submitManifest: () => Promise<ManifestResult>;
  refreshPackage: () => Promise<void>;
  leave: () => Promise<void>;
};

const StationSessionContext = createContext<StationSessionValue | undefined>(undefined);

/**
 * Arbeitskontext eines Stationsgeräts: Offline-Paket, gewählte Person,
 * aktiver Check-in und Sync-Zustand — auf dem lokalen Speicher aufgebaut
 * (siehe lib/station/), damit der Sporttagsbetrieb ohne Internet
 * funktioniert (docs/datenkonzept.md Abschnitt 11 und 12).
 */
export function StationSessionProvider({ children }: { children: React.ReactNode }) {
  const [isReady, setIsReady] = useState(false);
  const [eventId, setEventId] = useState<string | null>(null);
  const [pkg, setPkg] = useState<StationPackage | null>(null);
  const [staffId, setStaffIdState] = useState<string | null>(null);
  const [activeCheckin, setActiveCheckinState] = useState<LocalCheckin | null>(null);
  const [syncCounts, setSyncCounts] = useState<SyncCounts>({ pending: 0, sending: 0, review: 0, synced: 0 });
  const [syncOutcome, setSyncOutcome] = useState<StationSessionValue['syncOutcome']>('idle');
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);
  const syncingRef = useRef(false);

  const refreshCounts = useCallback(async (id: string) => {
    setSyncCounts(await store.countSyncByEvent(id));
  }, []);

  const refreshPackage = useCallback(async () => {
    if (!eventId) return;
    try {
      const fresh = await downloadPackage(eventId);
      setPkg(fresh);
    } catch {
      // offline: die zuletzt gespeicherte Kopie bleibt gültig.
    }
  }, [eventId]);

  const runSync = useCallback(async () => {
    if (!eventId || syncingRef.current) return;
    syncingRef.current = true;
    setSyncOutcome('syncing');
    try {
      const outcome = await syncNow(eventId);
      setSyncOutcome(outcome);
      if (outcome === 'ok') setLastSyncedAt(new Date().toISOString());
      await refreshCounts(eventId);
      if (outcome === 'ok') await refreshPackage();
    } finally {
      syncingRef.current = false;
    }
  }, [eventId, refreshCounts, refreshPackage]);

  // Startet mit dem zuletzt gespeicherten Event, ohne Online-Anforderung.
  useEffect(() => {
    let active = true;
    (async () => {
      const stored = await getAnyStoredPackage();
      // Code eingelöst, aber Download nie geglückt: Event trotzdem kennen,
      // damit das Paket nachgeladen werden kann.
      const storedEventId = stored?.eventId ?? (await store.getAnyStationState())?.eventId ?? null;
      if (!active) return;
      if (storedEventId) {
        setEventId(storedEventId);
        if (stored) setPkg(stored.pkg);
        const state = await store.getStationState(storedEventId);
        setStaffIdState(state?.staffId ?? null);
        const active_checkin = await store.loadActiveCheckin(storedEventId);
        setActiveCheckinState(active_checkin);
        await refreshCounts(storedEventId);
      }
      setIsReady(true);
    })();
    return () => {
      active = false;
    };
  }, [refreshCounts]);

  // Sync-Auslöser: App-Start, Vordergrund, Intervall, manuell.
  useEffect(() => {
    if (!eventId) return;
    void runSync();
    const interval = setInterval(() => void runSync(), 30000);
    const sub = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active') void runSync();
    });
    return () => {
      clearInterval(interval);
      sub.remove();
    };
  }, [eventId, runSync]);

  // Fehlt das Paket, sofort nachladen statt auf einen erfolgreichen Sync zu warten.
  useEffect(() => {
    if (isReady && eventId && !pkg) void refreshPackage();
  }, [isReady, eventId, pkg, refreshPackage]);

  // Realtime: ein Signal löst einen Paket-Refresh aus.
  useEffect(() => {
    if (!eventId) return;
    const unsubscribe = subscribeStationRealtime(eventId, () => void refreshPackage());
    return unsubscribe;
  }, [eventId, refreshPackage]);

  const joinWithCode = useCallback(async (code: string) => {
    const result = await redeemCode(code);
    if (!result.ok) return { ok: false as const, error: result.error };
    // Web: schützt den localStorage vor automatischer Löschung durch den Browser.
    if (Platform.OS === 'web') void navigator.storage?.persist?.().catch(() => {});
    // Das Gerät ist beim Server bereits registriert; ab hier merken wir uns
    // das Event auch bei einem fehlgeschlagenen Download, damit ein erneuter
    // Versuch ohne Code-Neueingabe möglich ist (retryDownload).
    setEventId(result.eventId);
    try {
      const fresh = await downloadPackage(result.eventId);
      setPkg(fresh);
    } catch (err) {
      return {
        ok: false as const,
        error: err instanceof Error ? err.message : 'Offline-Paket konnte nicht geladen werden.',
      };
    }
    await refreshCounts(result.eventId);
    return { ok: true as const };
  }, [refreshCounts]);

  const retryDownload = useCallback(async () => {
    if (!eventId) return { ok: false as const, error: 'Kein Veranstaltungscode eingelöst.' };
    try {
      const fresh = await downloadPackage(eventId);
      setPkg(fresh);
    } catch (err) {
      return {
        ok: false as const,
        error: err instanceof Error ? err.message : 'Offline-Paket konnte nicht geladen werden.',
      };
    }
    await refreshCounts(eventId);
    return { ok: true as const };
  }, [eventId, refreshCounts]);

  const selectStaff = useCallback((id: string) => {
    if (!eventId) return;
    setStaffIdState(id);
    void store.setStaffId(eventId, id);
  }, [eventId]);

  const checkIn = useCallback(async (setupId: string) => {
    if (!eventId) return;
    const id = Crypto.randomUUID();
    const now = new Date().toISOString();
    // Beendet lokal den vorherigen aktiven Check-in (höchstens einer gleichzeitig).
    const previous = await store.loadActiveCheckin(eventId);
    if (previous) {
      await store.saveCheckin({ ...previous, checkedOutAt: now });
    }
    const checkin: LocalCheckin = {
      id,
      eventId,
      stationSetupId: setupId,
      checkedInAt: now,
      checkedOutAt: null,
      staffIds: staffId ? [staffId] : [],
    };
    await store.saveCheckin(checkin);
    await store.setActiveCheckin(eventId, id);
    setActiveCheckinState(checkin);
    void runSync();
  }, [eventId, staffId, runSync]);

  const checkOut = useCallback(async () => {
    if (!eventId || !activeCheckin) return;
    const closed = { ...activeCheckin, checkedOutAt: new Date().toISOString() };
    await store.saveCheckin(closed);
    await store.setActiveCheckin(eventId, null);
    setActiveCheckinState(null);
    void runSync();
  }, [eventId, activeCheckin, runSync]);

  const saveResult = useCallback(async (matchId: string, payload: ResultPayload, reason?: string) => {
    if (!eventId || !pkg || !activeCheckin) throw new Error('kein aktiver Check-in');
    const match = pkg.matches.find((m) => m.id === matchId);
    if (!match) throw new Error('Match nicht im Offline-Paket gefunden');
    const state = await store.getStationState(eventId);
    const localSequence = state?.nextSequence ?? 1;
    const requestId = Crypto.randomUUID();
    const payloadHash = await hashPayload(payload);
    // In EINER lokalen Transaktion gespeichert (siehe store.ts); erst danach
    // gilt das Ergebnis als "Auf Gerät gespeichert".
    await store.saveResultSubmission({
      requestId,
      eventId,
      matchId,
      checkinId: activeCheckin.id,
      localSequence,
      baseResultVersion: match.current_result_version,
      planVersion: pkg.event.plan_version,
      payload,
      payloadHash,
      capturedAt: new Date().toISOString(),
      reason: reason ?? null,
    });
    await store.clearDraft(matchId);
    await refreshCounts(eventId);
    void runSync();
  }, [eventId, pkg, activeCheckin, refreshCounts, runSync]);

  const submitManifest = useCallback(async () => {
    if (!eventId) throw new Error('kein Event geladen');
    return submitManifestRpc(eventId);
  }, [eventId]);

  const leave = useCallback(async () => {
    if (!eventId) return;
    // Behält das Journal; ein erneuter Beitritt kann fortsetzen. Nur die
    // Sitzungsauswahl (Person, aktiver Check-in) wird lokal geleert.
    await store.clearStationSession(eventId);
    setStaffIdState(null);
    setActiveCheckinState(null);
    const stillOrganizer = await isStationSession();
    if (stillOrganizer) await supabase.auth.signOut();
  }, [eventId]);

  const entries = useMemo(() => (pkg && staffId ? dayPlan(pkg, staffId) : []), [pkg, staffId]);
  const checkedInEntryId = useMemo(() => {
    if (!activeCheckin) return null;
    return entries.find((e) => e.kind === 'assignment' && e.setupId === activeCheckin.stationSetupId)?.id ?? null;
  }, [entries, activeCheckin]);

  const staffName = useMemo(
    () => (pkg && staffId ? (pkg.event_staff.find((s) => s.id === staffId)?.display_name ?? null) : null),
    [pkg, staffId],
  );

  const value = useMemo<StationSessionValue>(
    () => ({
      isReady,
      eventId,
      pkg,
      staffId,
      staffName,
      entries,
      activeCheckin,
      checkedInEntryId,
      syncCounts,
      syncOutcome,
      lastSyncedAt,
      joinWithCode,
      retryDownload,
      selectStaff,
      checkIn,
      checkOut,
      saveResult,
      syncNow: runSync,
      submitManifest,
      refreshPackage,
      leave,
    }),
    [
      isReady, eventId, pkg, staffId, staffName, entries, activeCheckin, checkedInEntryId,
      syncCounts, syncOutcome, lastSyncedAt, joinWithCode, retryDownload, selectStaff, checkIn, checkOut,
      saveResult, runSync, submitManifest, refreshPackage, leave,
    ],
  );

  return <StationSessionContext.Provider value={value}>{children}</StationSessionContext.Provider>;
}

export function useStationSession() {
  const value = useContext(StationSessionContext);
  if (!value) throw new Error('useStationSession must be used within StationSessionProvider');
  return value;
}

export async function getStationDeviceId() {
  return (await getDevice()).id;
}

export { getStoredPackage };
