import { Stack, useRouter, useSegments } from 'expo-router';
import { DarkTheme, DefaultTheme, ThemeProvider } from 'expo-router/react-navigation';
import { ActivityIndicator, View } from 'react-native';
import { useEffect } from 'react';
import { SessionProvider, useSession } from '@/providers/SessionProvider';
import { useTheme } from '@/hooks/useTheme';
import { palette } from '@/components/ui/theme';
import { GluestackUIProvider } from '@/components/ui/gluestack-ui-provider';
import '@/global.css';

function RouteGuard() {
  const { session, isLoading } = useSession();
  const segments = useSegments();
  const router = useRouter();
  const theme = useTheme();
  const color = palette(theme);
  const inAuth = segments[0] === '(auth)';

  useEffect(() => {
    if (isLoading) return;
    if (!session && !inAuth) router.replace('/login');
    if (session && inAuth) router.replace('/');
  }, [inAuth, isLoading, router, session]);

  if (isLoading) return <View style={{ flex: 1, justifyContent: 'center', backgroundColor: color.background }}><ActivityIndicator color={color.accent} /></View>;
  return <Stack screenOptions={{ headerBackButtonDisplayMode: 'minimal' }}><Stack.Screen name="(auth)" options={{ headerShown: false }} /><Stack.Screen name="(app)" options={{ headerShown: false }} /></Stack>;
}

export default function RootLayout() {
  const theme = useTheme();
  return <GluestackUIProvider><ThemeProvider value={theme === 'dark' ? DarkTheme : DefaultTheme}><SessionProvider><RouteGuard /></SessionProvider></ThemeProvider></GluestackUIProvider>;
}
