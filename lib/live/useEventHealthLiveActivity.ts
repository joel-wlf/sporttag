import { useEffect, useMemo, useRef } from 'react';
import { AppState } from 'react-native';
import {
  endEventHealthActivity,
  isEventHealthActivityRunning,
  startEventHealthActivity,
  updateEventHealthActivity,
  type EventHealthState,
} from '@/lib/live/liveActivity';
import { liveGroupOf, liveStatusLabel, liveStatusOrder, type StationLive } from '@/lib/live/derive';

/**
 * Event-Health-Live-Activity für die Organisatoren-Ansicht (Backoffice
 * "Live-Betrieb"): Stationen je Status als Balken und Kacheln plus die
 * dringendste Station. Läuft automatisch, solange `enabled` gilt (auf
 * Web/Android no-op). Wischt der Nutzer sie weg, bleibt sie für diese
 * Sitzung aus, statt sich sofort neu zu starten.
 */
export function useEventHealthLiveActivity({
  enabled,
  ready,
  eventName,
  rows,
  roundLabel,
  roundEndsAt,
}: {
  /** Ob die Aktivität existieren soll (Veranstaltung läuft). */
  enabled: boolean;
  /** Ob die Daten vollständig sind; sonst bleibt der letzte Stand stehen. */
  ready: boolean;
  eventName: string;
  rows: StationLive[];
  roundLabel: string | null;
  roundEndsAt: string | null;
}): void {
  const started = useRef(false);
  const dismissed = useRef(false);

  const state = useMemo<EventHealthState>(() => {
    const count = (group: string) => rows.filter((r) => liveGroupOf[r.status] === group).length;
    const top = rows
      .filter((r) => liveGroupOf[r.status] === 'attention')
      .sort((a, b) => liveStatusOrder.indexOf(a.status) - liveStatusOrder.indexOf(b.status))[0];
    return {
      attention: count('attention'),
      running: count('running'),
      ready: count('ready'),
      done: count('done'),
      other: count('other'),
      topIssue: top?.station.name ?? null,
      topIssueReason: top ? liveStatusLabel[top.status] : null,
      roundLabel,
      roundEndsAtMs: roundEndsAt ? new Date(roundEndsAt).getTime() : null,
    };
  }, [rows, roundLabel, roundEndsAt]);

  // Nur echte Inhaltsänderungen lösen ein natives Update aus, nicht jeder 15-s-Tick.
  const stateKey = JSON.stringify(state);

  useEffect(() => {
    if (!enabled) {
      if (started.current) {
        endEventHealthActivity();
        started.current = false;
      }
      return;
    }
    if (dismissed.current || !ready) return;
    if (!started.current) {
      started.current = startEventHealthActivity(eventName, 'sporttag:///live', state);
      // z. B. Live Activities in den Systemeinstellungen deaktiviert: nicht bei jedem Update erneut versuchen.
      if (!started.current) dismissed.current = true;
      return;
    }
    updateEventHealthActivity(state);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- stateKey bildet `state` ab
  }, [enabled, ready, eventName, stateKey]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (next) => {
      if (next !== 'active' || !started.current) return;
      if (!isEventHealthActivityRunning()) {
        started.current = false;
        dismissed.current = true;
      }
    });
    return () => subscription.remove();
  }, []);

  useEffect(
    () => () => {
      if (started.current) endEventHealthActivity();
    },
    [],
  );
}
