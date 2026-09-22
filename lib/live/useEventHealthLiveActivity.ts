import { useEffect, useMemo, useRef, useState } from 'react';
import { endEventHealthActivity, startEventHealthActivity, updateEventHealthActivity } from '@/lib/live/liveActivity';
import { liveGroupOf, type StationLive } from '@/lib/live/derive';

/**
 * Event-Health-Live-Activity für die Organisatoren-Ansicht (Backoffice
 * "Live-Betrieb"): Zählt Stationen je Gruppe (liveGroupOf) in einen kompakten
 * Text, z. B. "5 läuft · 1 Klärung nötig · 2 bereit". Anders als die
 * Match-Activity im Cockpit läuft diese nicht automatisch, sondern wird vom
 * Organisator per Schalter gestartet (die Backoffice-Ansicht läuft auch im
 * Web/Desktop, wo eine Live Activity keinen Sinn ergibt).
 */
export function useEventHealthLiveActivity({
  eventName,
  rows,
  roundEndsAt,
}: {
  eventName: string;
  rows: StationLive[];
  roundEndsAt: string | null;
}): { active: boolean; start: () => void; stop: () => void } {
  const [active, setActive] = useState(false);
  const started = useRef(false);

  const attentionCount = useMemo(() => rows.filter((r) => liveGroupOf[r.status] === 'attention').length, [rows]);
  const summary = useMemo(() => {
    const runningCount = rows.filter((r) => liveGroupOf[r.status] === 'running').length;
    const readyCount = rows.filter((r) => liveGroupOf[r.status] === 'ready').length;
    const doneCount = rows.filter((r) => liveGroupOf[r.status] === 'done').length;
    const parts: string[] = [];
    if (attentionCount > 0) parts.push(`${attentionCount} braucht Aufmerksamkeit`);
    parts.push(`${runningCount} läuft`);
    parts.push(`${readyCount} bereit`);
    parts.push(`${doneCount} fertig`);
    return parts.join(' · ');
  }, [rows, attentionCount]);

  useEffect(() => {
    if (!active) return;
    const roundEndsAtMs = roundEndsAt ? new Date(roundEndsAt).getTime() : null;
    if (!started.current) {
      started.current = startEventHealthActivity({
        eventName,
        deepLinkUrl: 'sporttag:///live',
        summary,
        attentionCount,
        roundEndsAtMs,
      });
      return;
    }
    updateEventHealthActivity({ summary, attentionCount, roundEndsAtMs });
  }, [active, eventName, summary, attentionCount, roundEndsAt]);

  useEffect(
    () => () => {
      if (started.current) endEventHealthActivity();
    },
    [],
  );

  return {
    active,
    start: () => setActive(true),
    stop: () => {
      setActive(false);
      if (started.current) {
        endEventHealthActivity();
        started.current = false;
      }
    },
  };
}
