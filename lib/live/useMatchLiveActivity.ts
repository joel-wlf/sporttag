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
 * gleichnamige Karte in app/(station)/(tabs)/cockpit.tsx.
 */
export function useMatchLiveActivity(running: MatchLiveActivityInfo | null): void {
  const activeMatchId = useRef<string | null>(null);

  // Nur die angezeigten Felder lösen ein Update aus, nicht jede neue
  // Objektidentität von `running`.
  const matchId = running?.matchId ?? null;
  const gameName = running?.gameName ?? '';
  const teamsLabel = running?.teamsLabel ?? '';
  const scoreLabel = running?.scoreLabel ?? null;
  const roundEndsAt = running?.roundEndsAt ?? null;

  useEffect(() => {
    if (!matchId) {
      if (activeMatchId.current) {
        endMatchActivity();
        activeMatchId.current = null;
      }
      return;
    }

    const roundEndsAtMs = roundEndsAt ? new Date(roundEndsAt).getTime() : null;

    if (activeMatchId.current !== matchId) {
      startMatchActivity({
        gameName,
        matchId,
        deepLinkUrl: `sporttag:///match/${matchId}`,
        teamsLabel,
        scoreLabel,
        roundEndsAtMs,
      });
      activeMatchId.current = matchId;
      return;
    }

    updateMatchActivity({ teamsLabel, scoreLabel, roundEndsAtMs });
  }, [matchId, gameName, teamsLabel, scoreLabel, roundEndsAt]);

  useEffect(
    () => () => {
      if (activeMatchId.current) endMatchActivity();
    },
    [],
  );
}
