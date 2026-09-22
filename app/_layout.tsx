import { Stack, useRouter, useSegments } from 'expo-router';
import { DarkTheme, DefaultTheme, ThemeProvider } from 'expo-router/react-navigation';
import { ActivityIndicator, View } from 'react-native';
import { useEffect } from 'react';
import { SessionProvider, useSession } from '@/providers/SessionProvider';
import { ActiveEventProvider } from '@/providers/ActiveEventProvider';
import { QueryProvider } from '@/providers/QueryProvider';
import { useTheme } from '@/hooks/useTheme';
import { palette } from '@/components/ui/theme';
import { GluestackUIProvider } from '@/components/ui/gluestack-ui-provider';
import { ensureProfile } from '@/lib/api/profile';
import '@/global.css';

function RouteGuard() {
  const { session, isLoading } = useSession();
  const segments = useSegments();
  const router = useRouter();
  const theme = useTheme();
  const color = palette(theme);
  const inAuth = segments[0] === '(auth)';
  const inStation = segments[0] === '(station)';
  const inBackoffice = segments[0] === '(backoffice)';
  const isOrganizer = Boolean(session) && !session?.user.is_anonymous;

  useEffect(() => {
    if (isLoading) return;
    if (!session && !inAuth && !inStation) router.replace('/join');
    // Nur eine echte Organisatorensitzung verlässt den Login-Screen
    // automatisch; eine anonyme Stationssitzung soll dort ohne Schleife
    // ein persönliches Konto anmelden können (siehe "Backoffice"-Link
    // auf /join).
    if (isOrganizer && inAuth) router.replace('/');
    // Das Backoffice ist ausschließlich für persönliche Organisatorenkonten;
    // eine anonyme Stationssitzung darf nicht hinein.
    if (inBackoffice && session && !isOrganizer) router.replace('/login');
  }, [inAuth, inBackoffice, inStation, isLoading, isOrganizer, router, session]);

  useEffect(() => {
    if (isOrganizer) void ensureProfile();
  }, [isOrganizer]);

  if (isLoading) return <View style={{ flex: 1, justifyContent: 'center', backgroundColor: color.background }}><ActivityIndicator color={color.primary} /></View>;
  return <Stack screenOptions={{ headerBackButtonDisplayMode: 'minimal' }}><Stack.Screen name="(auth)" options={{ headerShown: false }} /><Stack.Screen name="(backoffice)" options={{ headerShown: false }} /><Stack.Screen name="(station)" options={{ headerShown: false }} /></Stack>;
}

export default function RootLayout() {
  const theme = useTheme();
  return (
    <GluestackUIProvider>
      <ThemeProvider value={theme === 'dark' ? DarkTheme : DefaultTheme}>
        <QueryProvider>
          <SessionProvider>
            <ActiveEventProvider>
              <RouteGuard />
            </ActiveEventProvider>
          </SessionProvider>
        </QueryProvider>
      </ThemeProvider>
    </GluestackUIProvider>
  );
}
