import { Alert, Platform } from 'react-native';

/** Alert.alert is a no-op on web (react-native-web), so branch to window.confirm there. */
export function confirmAsync(message: string, title = 'Wirklich löschen?'): Promise<boolean> {
  if (Platform.OS === 'web') {
    return Promise.resolve(typeof window !== 'undefined' ? window.confirm(message) : true);
  }
  return new Promise((resolve) => {
    Alert.alert(title, message, [
      { text: 'Abbrechen', style: 'cancel', onPress: () => resolve(false) },
      { text: 'Löschen', style: 'destructive', onPress: () => resolve(true) },
    ]);
  });
}
