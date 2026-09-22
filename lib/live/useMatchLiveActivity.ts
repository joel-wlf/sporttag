import { useEffect, useRef } from 'react';
import { endMatchActivity, startMatchActivity, updateMatchActivity } from '@/lib/live/liveActivity';

export type MatchLiveActivityInfo = {
  matchId: string;
  gameName: string;
  teamsLabel: string;
  scoreLabel: string | null;
  roundEndsAt: string | null;
};

/**
 * Startet/aktualisiert/beendet die Match-Live-Activity (Sperrbildschirm +
 * Dynamic Island) für das aktuell laufende Match an dieser Station. Läuft
 * automatisch mit, sobald ein Match als "LÄUFT" erkannt wird – siehe die
 * gleichnamige Karte in app/(station)/cockpit/index.tsx.
 */
export function useMatchLiveActivity(running: MatchLiveActivityInfo | null): void {
  const activeMatchId = useRef<string | null>(null);

  useEffect(() => {
    if (!running) {
      if (activeMatchId.current) {
        endMatchActivity();
        activeMatchId.current = null;
      }
      return;
    }

    const roundEndsAtMs = running.roundEndsAt ? new Date(running.roundEndsAt).getTime() : null;

    if (activeMatchId.current !== running.matchId) {
      startMatchActivity({
        gameName: running.gameName,
        matchId: running.matchId,
        deepLinkUrl: `sporttag:///match/${running.matchId}`,
        teamsLabel: running.teamsLabel,
        scoreLabel: running.scoreLabel,
        roundEndsAtMs,
      });
      activeMatchId.current = running.matchId;
      return;
    }

    updateMatchActivity({ teamsLabel: running.teamsLabel, scoreLabel: running.scoreLabel, roundEndsAtMs });
  }, [running?.matchId, running?.gameName, running?.teamsLabel, running?.scoreLabel, running?.roundEndsAt]);

  useEffect(
    () => () => {
      if (activeMatchId.current) endMatchActivity();
    },
    [],
  );
}
