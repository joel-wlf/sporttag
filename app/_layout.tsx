import { Stack, useRouter, useSegments } from 'expo-router';
import { DarkTheme, DefaultTheme, ThemeProvider } from 'expo-router/react-navigation';
import { ActivityIndicator, View } from 'react-native';
import { useEffect, useRef } from 'react';
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
  // Datenschutz und Support sind öffentlich (Store-Pflicht) und brauchen weder Login noch Code.
  const inPublic = segments[0] === '(public)';
  const isOrganizer = Boolean(session) && !session?.user.is_anonymous;
  // Wer sich gerade als Organisator abgemeldet hat, will zurück zum Login,
  // nicht zum Stationsbeitritt. Die Umleitung von account.tsx kam sonst zu
  // spät: diese Wache hatte schon nach /join ersetzt.
  const wasOrganizer = useRef(false);

  useEffect(() => {
    if (isLoading) return;
    const justSignedOut = wasOrganizer.current && !isOrganizer;
    wasOrganizer.current = isOrganizer;
    if (justSignedOut && !inAuth && !inStation && !inPublic) {
      router.replace('/login');
      return;
    }
    // Das Backoffice ist ausschließlich für persönliche Organisatorenkonten.
    // Ohne Sitzung und mit einer anonymen Stationssitzung ist der
    // Stationseinstieg der Standard — auch beim Kaltstart, der auf `/`
    // (Backoffice-Index) öffnet. Der Login ist von /join aus erreichbar.
    if (!isOrganizer && !inAuth && !inStation && !inPublic) {
      router.replace('/join');
      return;
    }
    // Nur eine echte Organisatorensitzung verlässt den Login-Screen
    // automatisch; eine anonyme Stationssitzung soll dort ohne Schleife
    // ein persönliches Konto anmelden können (siehe "Backoffice"-Link
    // auf /join).
    if (isOrganizer && inAuth) router.replace('/');
  }, [inAuth, inPublic, inStation, isLoading, isOrganizer, router]);

  useEffect(() => {
    if (isOrganizer) void ensureProfile();
  }, [isOrganizer]);

  if (isLoading) return <View style={{ flex: 1, justifyContent: 'center', backgroundColor: color.background }}><ActivityIndicator color={color.primary} /></View>;
  // Wechsel zwischen Station, Login und Backoffice sind Kontextwechsel, keine
  // Vertiefung: überblenden statt einschieben — auch bei den Umleitungen der
  // Routenwache oben.
  const groupOptions = { headerShown: false, animation: 'fade' } as const;
  return (
    <Stack screenOptions={{ headerBackButtonDisplayMode: 'minimal' }}>
      <Stack.Screen name="(auth)" options={groupOptions} />
      <Stack.Screen name="(backoffice)" options={groupOptions} />
      <Stack.Screen name="(station)" options={groupOptions} />
      <Stack.Screen name="(public)" options={groupOptions} />
    </Stack>
  );
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
