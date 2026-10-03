import { Stack } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTokens } from '@/components/ui/theme';
import { StationSessionProvider } from '@/providers/StationSessionProvider';

export default function StationLayout() {
  const tokens = useTokens();
  return (
    <StationSessionProvider>
      <SafeAreaView
        edges={['top', 'left', 'right']}
        style={{ flex: 1, backgroundColor: tokens.background }}
      >
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: tokens.background },
          }}
        >
          {/* Der Beitritt ist der Einstieg; kein Zurück-Wischen in einen
              vorherigen Stationsstapel. */}
          <Stack.Screen name="join" options={{ gestureEnabled: false }} />
          {/* Regeln als Sheet über dem Match, per Wischen schließbar. */}
          <Stack.Screen name="rules/[gameId]" options={{ presentation: 'modal' }} />
          {/* Sync als Sheet über jedem Screen, per Wischen schließbar. Kein
              formSheet mit Detents: dort bekam der Inhalt (flex: 1) keine
              Höhe und das Sheet blieb leer. */}
          <Stack.Screen name="sync" options={{ presentation: 'modal' }} />
        </Stack>
      </SafeAreaView>
    </StationSessionProvider>
  );
}
