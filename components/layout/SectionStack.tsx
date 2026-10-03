import { Stack } from 'expo-router';
import { useWindowDimensions } from 'react-native';
import { useTokens } from '@/components/ui/theme';

/**
 * Stapel für einen Backoffice-Bereich mit Hub (`index`) und Unterseiten.
 * Auf schmalen Bildschirmen bekommen Unterseiten eine native Navigationsleiste
 * mit Zurück-Knopf zum Hub; den Seitentitel trägt weiterhin der große
 * Header im Inhalt. Mit Seitenleiste (breit) ist sie überflüssig: dort
 * navigiert die Sidebar direkt zwischen den Seiten.
 */
export function SectionStack({ backTitle }: { backTitle: string }) {
  const tokens = useTokens();
  const { width } = useWindowDimensions();
  const wide = width >= 960;

  return (
    <Stack
      screenOptions={{
        headerShown: !wide,
        title: '',
        headerBackTitle: backTitle,
        headerShadowVisible: false,
        headerTintColor: tokens.primary,
        headerStyle: { backgroundColor: tokens.background },
        contentStyle: { backgroundColor: tokens.background },
      }}
    >
      <Stack.Screen name="index" options={{ headerShown: false, title: backTitle }} />
    </Stack>
  );
}
