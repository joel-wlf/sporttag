import { NativeModule, requireNativeModule } from 'expo';
import { Platform } from 'react-native';

/** Muss zu EventHealthStateRecord in ios/SporttagLiveActivityModule.swift passen. */
export type EventHealthState = {
  attention: number;
  running: number;
  ready: number;
  done: number;
  other: number;
  topIssue: string | null;
  topIssueReason: string | null;
  roundLabel: string | null;
  roundEndsAtMs: number | null;
};

declare class SporttagLiveActivityModule extends NativeModule {
  areActivitiesEnabled(): boolean;
  startMatchActivity(
    gameName: string,
    matchId: string,
    deepLinkUrl: string,
    teamsLabel: string,
    scoreLabel: string | null,
    roundEndsAtMs: number | null,
  ): boolean;
  updateMatchActivity(teamsLabel: string, scoreLabel: string | null, roundEndsAtMs: number | null): void;
  endMatchActivity(): void;
  startEventHealthActivity(eventName: string, deepLinkUrl: string, state: EventHealthState): boolean;
  updateEventHealthActivity(state: EventHealthState): void;
  endEventHealthActivity(): void;
  isEventHealthActivityRunning(): boolean;
}

const nativeModule = Platform.OS === 'ios' ? requireNativeModule<SporttagLiveActivityModule>('SporttagLiveActivity') : null;

export default nativeModule;
