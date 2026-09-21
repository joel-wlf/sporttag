import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

export type HapticStyle =
  | 'none'
  | 'light'
  | 'medium'
  | 'heavy'
  | 'selection'
  | 'success'
  | 'warning'
  | 'error';

const isNative = Platform.OS === 'ios' || Platform.OS === 'android';

/**
 * Zentrale, fehlertolerante Haptik. Auf Web und bei nicht verfügbarer
 * Haptik-API bleibt der Aufruf wirkungslos.
 */
export function haptic(style: HapticStyle = 'light') {
  if (!isNative || style === 'none') return;
  try {
    const promise =
      style === 'selection'
        ? Haptics.selectionAsync()
        : style === 'success' || style === 'warning' || style === 'error'
          ? Haptics.notificationAsync(
              style === 'success'
                ? Haptics.NotificationFeedbackType.Success
                : style === 'warning'
                  ? Haptics.NotificationFeedbackType.Warning
                  : Haptics.NotificationFeedbackType.Error,
            )
          : Haptics.impactAsync(
              style === 'heavy'
                ? Haptics.ImpactFeedbackStyle.Heavy
                : style === 'medium'
                  ? Haptics.ImpactFeedbackStyle.Medium
                  : Haptics.ImpactFeedbackStyle.Light,
            );
    void promise.catch(() => {});
  } catch {
    // Haptik ist optional und darf den Ablauf nie stören.
  }
}
