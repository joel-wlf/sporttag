import { Platform, Pressable, StyleSheet, Text } from 'react-native';
import { PlatformSurface } from '@/components/platform/PlatformSurface';
import { Screen } from '@/components/ui/Screen';
import { palette } from '@/components/ui/theme';
import { useTheme } from '@/hooks/useTheme';
import { useSession } from '@/providers/SessionProvider';
import { supabase } from '@/lib/supabase';
export default function SettingsScreen() { const { session } = useSession(); const theme = useTheme(); const color = palette(theme); return <Screen><PlatformSurface><Text style={[styles.heading, { color: color.text }]}>Appearance</Text><Text style={{ color: color.muted }}>Platform: {Platform.OS}</Text><Text style={{ color: color.muted }}>Theme: {theme} (system)</Text></PlatformSurface><PlatformSurface><Text style={[styles.heading, { color: color.text }]}>Account</Text><Text style={{ color: color.muted }}>{session?.user.email}</Text><Pressable onPress={() => supabase.auth.signOut()} style={[styles.button, { borderColor: color.danger }]}><Text style={{ color: color.danger, fontWeight: '700' }}>Sign out</Text></Pressable></PlatformSurface></Screen>; }
const styles = StyleSheet.create({ heading: { fontSize: 18, fontWeight: '700' }, button: { borderWidth: 1, borderRadius: 10, alignItems: 'center', padding: 12, marginTop: 8 } });
