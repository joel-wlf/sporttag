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
import { downloadPackage, fetchLiveStates, fetchTeamVisits, getStoredPackage, dayPlan } from '@/lib/station/package';
import { hashPayload } from '@/lib/station/scoring';
import { syncNow, submitManifest as submitManifestRpc, type ManifestResult, type SyncOutcome } from '@/lib/station/sync';
import { subscribeStationRealtime } from '@/lib/station/realtime';
import { applyCounterChanges, mergeLiveState, sameLiveValues } from '@/lib/station/liveMerge';
import { loadMatchSync, type MatchSyncEntry } from '@/lib/station/matchSync';
import { emptySyncCounts } from '@/lib/station/syncCounts';
import type { DayEntry, LiveValue, LocalCheckin, LocalLiveState, LocalTeamVisit, ResultPayload, StationPackage, SyncCounts } from '@/lib/station/types';

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
  /** Übertragungsstand der letzten eigenen Abgabe je Match (nur Matches mit Abgabe). */
  matchSync: Record<string, MatchSyncEntry>;
  syncOutcome: SyncOutcome | 'idle' | 'syncing';
  lastSyncedAt: string | null;
  /** Live-Zwischenstände je Match, geteilt mit anderen Geräten der Station. */
  liveStates: Record<string, LocalLiveState>;
  /** Laufzettel je Match-Teilnehmer: wann die Gruppe kam und wann sie weiterzog. */
  teamVisits: Record<string, LocalTeamVisit>;

  /**
   * `redeemed` ist true, wenn der Code angenommen wurde und nur der
   * Paket-Download fehlschlug — dann reicht `retryDownload` ohne neuen Code.
   */
  joinWithCode: (code: string) => Promise<{ ok: true } | { ok: false; error: string; redeemed: boolean }>;
  retryDownload: () => Promise<{ ok: true } | { ok: false; error: string }>;
  selectStaff: (staffId: string) => void;
  checkIn: (setupId: string) => Promise<void>;
  checkOut: () => Promise<void>;
  saveResult: (matchId: string, payload: ResultPayload, reason?: string) => Promise<void>;
  /**
   * Meldet einen Live-Zwischenstand. Mit `counter` sind `values` nur die
   * geänderten Zählerstände; sie werden je Team in den Stand eingefügt und mit
   * den Ständen anderer Geräte zusammengeführt. Sonst ersetzt `values` den Stand.
   */
  setLiveValues: (
    matchId: string,
    values: LiveValue[],
    options?: { started?: boolean; counter?: boolean },
  ) => Promise<void>;
  /** Hält Ankunft bzw. Weiterschickung einer Gruppe an dieser Station fest. */
  setTeamVisit: (participantId: string, patch: { arrivedAt?: string | null; releasedAt?: string | null }) => Promise<void>;
  /** Manueller Sync: versucht auch Einträge im Backoff sofort erneut. */
  syncNow: () => Promise<void>;
  submitManifest: () => Promise<ManifestResult>;
  refreshPackage: () => Promise<void>;
  leave: () => Promise<void>;
  /**
   * Eine bewusst verlassene Veranstaltung mit gespeichertem Paket. Der
   * Beitritt bietet damit einen Rückweg ohne Internet und ohne Code.
   */
  resumableEvent: { eventId: string; name: string } | null;
  resumeEvent: () => Promise<void>;
  /** Bewusster Reset: löscht alle lokalen Daten und führt zurück zum Beitritt. */
  resetDevice: () => Promise<void>;
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
  const [syncCounts, setSyncCounts] = useState<SyncCounts>(emptySyncCounts);
  const [matchSync, setMatchSync] = useState<Record<string, MatchSyncEntry>>({});
  const [syncOutcome, setSyncOutcome] = useState<StationSessionValue['syncOutcome']>('idle');
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);
  const [liveStates, setLiveStates] = useState<Record<string, LocalLiveState>>({});
  const [teamVisits, setTeamVisits] = useState<Record<string, LocalTeamVisit>>({});
  const [resumableEvent, setResumableEvent] = useState<{ eventId: string; name: string } | null>(null);
  const syncingRef = useRef(false);
  // Ergebnisabgaben nacheinander: Sequenz lesen und Abgabe speichern dürfen
  // sich nicht überlappen (Doppeltipp ergab sonst zweimal dieselbe Sequenz,
  // die der Server als Unique-Verletzung dauerhaft ablehnt).
  const saveChainRef = useRef<Promise<unknown>>(Promise.resolve());
  // Live-Stände: Der Speicherstand im Arbeitsspeicher ist maßgeblich und wird
  // synchron fortgeschrieben (Lesen und Schreiben ohne `await` dazwischen), die
  // Datenbank folgt in derselben Reihenfolge. So können sich schnelle Tipps und
  // ein eintreffender Serverstand nicht gegenseitig überschreiben.
  const liveRef = useRef<Record<string, LocalLiveState>>({});
  const liveChainRef = useRef<Promise<unknown>>(Promise.resolve());
  const deviceIdRef = useRef<string | null>(null);

  const commitLive = useCallback((next: Record<string, LocalLiveState>) => {
    liveRef.current = next;
    setLiveStates(next);
  }, []);

  const persistLive = useCallback((state: LocalLiveState) => {
    // Live-Stände sind unkritisch (das Ergebnis sichert die Abgabe); ein
    // Schreibfehler darf die Kette nicht abbrechen.
    liveChainRef.current = liveChainRef.current
      .then(() => store.saveLiveState(state))
      .catch(() => {});
  }, []);
  const queuedSyncRef = useRef(false);

  const refreshCounts = useCallback(async (id: string) => {
    setSyncCounts(await store.countSyncByEvent(id));
    setMatchSync(await loadMatchSync(id));
  }, []);

  const refreshLiveStates = useCallback(async () => {
    if (!eventId) return;
    let remote: Awaited<ReturnType<typeof fetchLiveStates>> = [];
    try {
      remote = await fetchLiveStates(eventId);
    } catch {
      // offline: lokale Live-Stände bleiben maßgeblich.
      return;
    }
    // Ab hier ohne `await`: der lokale Stand wird erst jetzt gelesen, damit ein
    // Tipp während des Abrufs nicht überschrieben wird.
    let next = liveRef.current;
    for (const entry of remote) {
      const local = next[entry.matchId];
      const merged = mergeLiveState(local, entry, eventId, entry.matchId);
      if (
        local &&
        local.dirty === merged.dirty &&
        local.updatedAt === merged.updatedAt &&
        local.started === merged.started &&
        sameLiveValues(local.values, merged.values)
      ) {
        continue;
      }
      next = { ...next, [entry.matchId]: merged };
      persistLive(merged);
    }
    if (next !== liveRef.current) commitLive(next);
  }, [eventId, commitLive, persistLive]);

  /**
   * Führt den Laufzettel mit dem Server zusammen. Ein neuerer lokaler Eintrag
   * (auch ein noch nicht übertragener) gewinnt; sonst gilt der Serverstand —
   * so sieht ein Gerät, das eine Station übernimmt, die bereits erfassten
   * Ankünfte. Offline bleibt der lokale Stand maßgeblich; das zuletzt
   * geladene Paket dient dabei als Ausgangspunkt.
   */
  const refreshTeamVisits = useCallback(async () => {
    if (!eventId) return;
    let remote: { participantId: string; matchId: string; teamId: string; arrivedAt: string | null; releasedAt: string | null; updatedAt: string }[] = [];
    try {
      remote = await fetchTeamVisits(eventId);
    } catch {
      const stored = await store.loadPackage(eventId);
      remote = (stored?.team_visits ?? []).map((v) => ({
        participantId: v.participant_id,
        matchId: v.match_id,
        teamId: v.team_id,
        arrivedAt: v.arrived_at,
        releasedAt: v.released_at,
        updatedAt: v.updated_at,
      }));
    }
    for (const entry of remote) {
      const local = await store.loadTeamVisit(entry.participantId);
      if (local && (local.dirty || Date.parse(local.updatedAt) >= Date.parse(entry.updatedAt))) continue;
      await store.saveTeamVisit({
        participantId: entry.participantId,
        eventId,
        matchId: entry.matchId,
        teamId: entry.teamId,
        checkinId: local?.checkinId ?? '',
        arrivedAt: entry.arrivedAt,
        releasedAt: entry.releasedAt,
        dirty: false,
        updatedAt: entry.updatedAt,
      });
    }
    const list = await store.loadTeamVisits(eventId);
    setTeamVisits(Object.fromEntries(list.map((v) => [v.participantId, v])));
  }, [eventId]);

  const refreshPackage = useCallback(async () => {
    if (!eventId) return;
    try {
      const fresh = await downloadPackage(eventId);
      setPkg(fresh);
    } catch {
      // offline: die zuletzt gespeicherte Kopie bleibt gültig.
    }
  }, [eventId]);

  const runSync = useCallback(async (options?: { force?: boolean }) => {
    if (!eventId || syncingRef.current) {
      if (eventId) queuedSyncRef.current = true;
      return;
    }
    syncingRef.current = true;
    setSyncOutcome('syncing');
    try {
      // Läuft erneut, solange während des Syncs neue Live-Stände eintreffen,
      // damit auch die zuletzt getippte Eingabe noch übertragen wird.
      do {
        queuedSyncRef.current = false;
        const outcome = await syncNow(eventId, options);
        setSyncOutcome(outcome);
        if (outcome === 'ok') setLastSyncedAt(new Date().toISOString());
        await refreshCounts(eventId);
        if (outcome === 'ok') {
          await refreshPackage();
          await refreshLiveStates();
          await refreshTeamVisits();
        }
      } while (queuedSyncRef.current);
    } finally {
      syncingRef.current = false;
    }
  }, [eventId, refreshCounts, refreshPackage, refreshLiveStates, refreshTeamVisits]);

  /** Stellt den lokalen Arbeitsstand eines Events her, ganz ohne Netz. */
  const loadEvent = useCallback(async (id: string, stored: StationPackage | null, staff: string | null) => {
    setEventId(id);
    if (stored) setPkg(stored);
    setStaffIdState(staff);
    setActiveCheckinState(await store.loadActiveCheckin(id));
    await refreshCounts(id);
    const liveList = await store.loadLiveStates(id);
    commitLive(Object.fromEntries(liveList.map((s) => [s.matchId, s])));
    const visitList = await store.loadTeamVisits(id);
    setTeamVisits(Object.fromEntries(visitList.map((v) => [v.participantId, v])));
  }, [refreshCounts, commitLive]);

  // Startet mit dem zuletzt gespeicherten Event, ohne Online-Anforderung.
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const state = await store.getCurrentStationState();
        if (!state) return;
        const stored = await getStoredPackage(state.eventId);
        if (!active) return;
        if (!state.left) {
          await loadEvent(state.eventId, stored, state.staffId);
        } else if (stored) {
          // Bewusst verlassene Veranstaltung nicht automatisch wieder öffnen,
          // aber als Rückweg anbieten.
          setResumableEvent({ eventId: state.eventId, name: stored.event.name });
        }
      } catch {
        // Ein beschädigter lokaler Speicher darf den Start nicht blockieren.
      } finally {
        if (active) setIsReady(true);
      }
    })();
    return () => {
      active = false;
    };
  }, [loadEvent]);

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
  // Das Laden ist ein externer Abruf; setPkg läuft erst nach dem await.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (isReady && eventId && !pkg) void refreshPackage();
  }, [isReady, eventId, pkg, refreshPackage]);

  // Realtime: Match-/Check-in-Signale laden das Paket neu, Live-Zwischenstände
  // werden leichtgewichtig nachgeführt.
  useEffect(() => {
    if (!eventId) return;
    const unsubscribe = subscribeStationRealtime(eventId, {
      onPackageChange: () => void refreshPackage(),
      onLiveChange: () => {
        void refreshLiveStates();
        void refreshTeamVisits();
      },
    });
    return unsubscribe;
  }, [eventId, refreshPackage, refreshLiveStates, refreshTeamVisits]);

  const joinWithCode = useCallback(async (code: string) => {
    const result = await redeemCode(code);
    if (!result.ok) return { ok: false as const, error: result.error, redeemed: false };
    // Web: schützt den localStorage vor automatischer Löschung durch den Browser.
    if (Platform.OS === 'web') void navigator.storage?.persist?.().catch(() => {});
    // Das Gerät ist beim Server bereits registriert; ab hier merken wir uns
    // das Event auch bei einem fehlgeschlagenen Download, damit ein erneuter
    // Versuch ohne Code-Neueingabe möglich ist (retryDownload).
    setEventId(result.eventId);
    setResumableEvent(null);
    try {
      const fresh = await downloadPackage(result.eventId);
      setPkg(fresh);
    } catch (err) {
      return {
        ok: false as const,
        error: err instanceof Error ? err.message : 'Offline-Paket konnte nicht geladen werden.',
        redeemed: true,
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
    const saveNow = async () => {
      if (!eventId || !pkg || !activeCheckin) throw new Error('kein aktiver Check-in');
      const match = pkg.matches.find((m) => m.id === matchId);
      if (!match) throw new Error('Match nicht im Offline-Paket gefunden');
      const requestId = Crypto.randomUUID();
      const payloadHash = await hashPayload(payload);
      // In EINER lokalen Transaktion gespeichert (siehe store.ts); erst danach
      // gilt das Ergebnis als "Auf Gerät gespeichert".
      await store.saveResultSubmission({
        requestId,
        eventId,
        matchId,
        checkinId: activeCheckin.id,
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
    };
    const run = saveChainRef.current.catch(() => undefined).then(saveNow);
    saveChainRef.current = run;
    return run;
  }, [eventId, pkg, activeCheckin, refreshCounts, runSync]);

  /**
   * Meldet einen Live-Zwischenstand (fortlaufend, nicht revisionsbasiert).
   * Wird bei jeder Eingabe aufgerufen, damit das Backoffice den laufenden
   * Punktestand und den Status "läuft" live sieht, ohne einen Konflikt oder
   * Korrekturvorschlag auszulösen.
   */
  const setLiveValues = useCallback(async (
    matchId: string,
    values: LiveValue[],
    options?: { started?: boolean; counter?: boolean },
  ) => {
    if (!eventId) return;
    // Das Gerät vor dem synchronen Teil laden; danach kein `await` mehr.
    if (options?.counter && !deviceIdRef.current) deviceIdRef.current = (await getDevice()).id;
    const existing = liveRef.current[matchId];
    const nextValues = options?.counter
      ? applyCounterChanges(
          existing?.values ?? [],
          values.map((v) => ({ participant_id: v.participant_id, measured_value: v.measured_value ?? 0 })),
          deviceIdRef.current ?? '',
        )
      : values;
    // Strikt aufsteigend, auch bei zwei Tipps in derselben Millisekunde oder
    // einer zurückgestellten Uhr: "übertragen" gilt nur für genau diesen Stand.
    const now = Date.now();
    const previous = existing ? Date.parse(existing.updatedAt) : 0;
    const next: LocalLiveState = {
      matchId,
      eventId,
      checkinId: activeCheckin?.id ?? existing?.checkinId ?? '',
      values: nextValues,
      started: options?.started ?? existing?.started ?? false,
      // Ohne Check-in bleibt der Stand auf dem Gerät; er geht mit dem nächsten
      // Tipp nach dem Einchecken hinaus.
      dirty: Boolean(activeCheckin),
      updatedAt: new Date(Math.max(now, previous + 1)).toISOString(),
    };
    commitLive({ ...liveRef.current, [matchId]: next });
    persistLive(next);
    if (activeCheckin) void runSync();
  }, [eventId, activeCheckin, runSync, commitLive, persistLive]);

  /**
   * Hält fest, dass eine Gruppe an dieser Station eingetroffen ist bzw.
   * weitergeschickt wurde. Das ist operative Telemetrie, kein Ergebnis: sie
   * läuft fortlaufend mit (last-write-wins) und erzeugt nie einen Konflikt.
   * Ohne aktiven Check-in gibt es nichts zu melden — der Server verlangt
   * einen Check-in, der zu dieser Stationsbelegung passt.
   */
  const setTeamVisit = useCallback(async (
    participantId: string,
    patch: { arrivedAt?: string | null; releasedAt?: string | null },
  ) => {
    if (!eventId || !pkg || !activeCheckin) return;
    const match = pkg.matches.find((m) => m.participants.some((p) => p.id === participantId));
    const participant = match?.participants.find((p) => p.id === participantId);
    if (!match || !participant) return;

    const existing = await store.loadTeamVisit(participantId);
    const arrivedAt = patch.arrivedAt !== undefined ? patch.arrivedAt : (existing?.arrivedAt ?? null);
    const releasedAt = patch.releasedAt !== undefined ? patch.releasedAt : (existing?.releasedAt ?? null);
    // Eine zurückgenommene Ankunft nimmt die Weiterschickung mit: sonst bliebe
    // ein Laufzettel zurück, den der Server wegen der Reihenfolge ablehnt.
    const next: LocalTeamVisit = {
      participantId,
      eventId,
      matchId: match.id,
      teamId: participant.team_id,
      checkinId: activeCheckin.id,
      arrivedAt,
      releasedAt: arrivedAt === null ? null : releasedAt,
      dirty: true,
      updatedAt: new Date().toISOString(),
    };
    await store.saveTeamVisit(next);
    setTeamVisits((prev) => ({ ...prev, [participantId]: next }));
    void runSync();
  }, [eventId, pkg, activeCheckin, runSync]);

  const submitManifest = useCallback(async () => {
    if (!eventId) throw new Error('kein Event geladen');
    // Erst alles Offene übertragen: sonst meldete das Manifest gerade noch
    // nicht gesendete Abgaben als fehlend.
    await runSync({ force: true });
    return submitManifestRpc(eventId);
  }, [eventId, runSync]);

  const leave = useCallback(async () => {
    if (!eventId) return;
    // Behält das Journal (unbestätigte Abgaben, Sequenzzähler, Zugang); nur
    // Sitzungsauswahl und Eventbindung werden gelöst. Die Markierung `left`
    // verhindert, dass ein vorbereitetes Gerät beim Start automatisch wieder
    // in die Personenansicht springt.
    // Ein offener Check-in wird beendet: sonst galt die Station im Backoffice
    // weiter als betreut, und nach einem Neustart tauchte er wieder auf.
    const open = await store.loadActiveCheckin(eventId);
    if (open) await store.saveCheckin({ ...open, checkedOutAt: new Date().toISOString() });
    await store.clearStationSession(eventId);
    await store.setEventLeft(eventId, true);
    // Letzter Versuch, Offenes zu übertragen, solange die Sitzung noch gilt —
    // höchstens kurz: bei schlechtem Netz hing das Verlassen sonst so lange,
    // wie der Sync dauerte. Nicht Übertragenes bleibt ohnehin im Journal.
    await Promise.race([
      syncNow(eventId).catch(() => 'error' as const),
      new Promise((resolve) => setTimeout(resolve, 8000)),
    ]);
    const name = pkg?.event.name ?? (await store.loadPackage(eventId))?.event.name;
    setResumableEvent(name ? { eventId, name } : null);
    setMatchSync({});
    setStaffIdState(null);
    setActiveCheckinState(null);
    commitLive({});
    setTeamVisits({});
    setEventId(null);
    setPkg(null);
    // Die anonyme Gerätesitzung bleibt bestehen: Mit ihr kann eine wieder
    // aufgenommene Veranstaltung weiter übertragen, ohne neuen Code.
  }, [eventId, pkg, commitLive]);

  /** Kehrt ohne Netz und Code zu einer bewusst verlassenen Veranstaltung zurück. */
  const resumeEvent = useCallback(async () => {
    if (!resumableEvent) return;
    const id = resumableEvent.eventId;
    const stored = await getStoredPackage(id);
    if (!stored) {
      setResumableEvent(null);
      return;
    }
    await store.setEventLeft(id, false);
    setResumableEvent(null);
    await loadEvent(id, stored, null);
  }, [resumableEvent, loadEvent]);

  const resetDevice = useCallback(async () => {
    await liveChainRef.current;
    await store.clearAllStationData();
    setResumableEvent(null);
    setStaffIdState(null);
    setActiveCheckinState(null);
    commitLive({});
    setTeamVisits({});
    setEventId(null);
    setPkg(null);
    setSyncCounts(emptySyncCounts);
    setMatchSync({});
    setSyncOutcome('idle');
    setLastSyncedAt(null);
    const stillOrganizer = await isStationSession();
    if (stillOrganizer) await supabase.auth.signOut();
  }, [commitLive]);

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
      matchSync,
      syncOutcome,
      lastSyncedAt,
      liveStates,
      teamVisits,
      joinWithCode,
      retryDownload,
      selectStaff,
      checkIn,
      checkOut,
      saveResult,
      setLiveValues,
      setTeamVisit,
      syncNow: () => runSync({ force: true }),
      submitManifest,
      refreshPackage,
      leave,
      resumableEvent,
      resumeEvent,
      resetDevice,
    }),
    [
      isReady, eventId, pkg, staffId, staffName, entries, activeCheckin, checkedInEntryId,
      syncCounts, matchSync, syncOutcome, lastSyncedAt, liveStates, teamVisits, joinWithCode, retryDownload, selectStaff, checkIn, checkOut,
      saveResult, setLiveValues, setTeamVisit, runSync, submitManifest, refreshPackage, leave, resumableEvent, resumeEvent, resetDevice,
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
