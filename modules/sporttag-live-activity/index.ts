import { NativeModule, requireNativeModule } from 'expo';
import { Platform } from 'react-native';

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
  startEventHealthActivity(
    eventName: string,
    deepLinkUrl: string,
    summary: string,
    attentionCount: number,
    roundEndsAtMs: number | null,
  ): boolean;
  updateEventHealthActivity(summary: string, attentionCount: number, roundEndsAtMs: number | null): void;
  endEventHealthActivity(): void;
}

const nativeModule = Platform.OS === 'ios' ? requireNativeModule<SporttagLiveActivityModule>('SporttagLiveActivity') : null;

export default nativeModule;
