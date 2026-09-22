import { Platform } from 'react-native';
import SporttagLiveActivity from '@/modules/sporttag-live-activity';

/**
 * Dünne Hülle um das native ActivityKit-Modul (modules/sporttag-live-activity):
 * no-op außerhalb iOS, und wirft nie – Live Activities können vom Nutzer in
 * den Systemeinstellungen deaktiviert sein, das darf kein Absturzgrund sein.
 */

function safe<T>(fn: () => T, fallback: T): T {
  if (Platform.OS !== 'ios' || !SporttagLiveActivity) return fallback;
  try {
    return fn();
  } catch (error) {
    console.warn('[liveActivity]', error);
    return fallback;
  }
}

export type MatchActivityInput = {
  gameName: string;
  matchId: string;
  deepLinkUrl: string;
  teamsLabel: string;
  scoreLabel: string | null;
  roundEndsAtMs: number | null;
};

export function startMatchActivity(input: MatchActivityInput): boolean {
  return safe(
    () =>
      SporttagLiveActivity!.startMatchActivity(
        input.gameName,
        input.matchId,
        input.deepLinkUrl,
        input.teamsLabel,
        input.scoreLabel,
        input.roundEndsAtMs,
      ),
    false,
  );
}

export function updateMatchActivity(input: Omit<MatchActivityInput, 'gameName' | 'matchId' | 'deepLinkUrl'>): void {
  safe(() => SporttagLiveActivity!.updateMatchActivity(input.teamsLabel, input.scoreLabel, input.roundEndsAtMs), undefined);
}

export function endMatchActivity(): void {
  safe(() => SporttagLiveActivity!.endMatchActivity(), undefined);
}

export type EventHealthActivityInput = {
  eventName: string;
  deepLinkUrl: string;
  summary: string;
  attentionCount: number;
  roundEndsAtMs: number | null;
};

export function startEventHealthActivity(input: EventHealthActivityInput): boolean {
  return safe(
    () =>
      SporttagLiveActivity!.startEventHealthActivity(
        input.eventName,
        input.deepLinkUrl,
        input.summary,
        input.attentionCount,
        input.roundEndsAtMs,
      ),
    false,
  );
}

export function updateEventHealthActivity(input: Omit<EventHealthActivityInput, 'eventName' | 'deepLinkUrl'>): void {
  safe(() => SporttagLiveActivity!.updateEventHealthActivity(input.summary, input.attentionCount, input.roundEndsAtMs), undefined);
}

export function endEventHealthActivity(): void {
  safe(() => SporttagLiveActivity!.endEventHealthActivity(), undefined);
}
