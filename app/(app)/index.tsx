import { Link } from 'expo-router';
import { StyleSheet, Text } from 'react-native';
import { PlatformSurface } from '@/components/platform/PlatformSurface';
import { Screen } from '@/components/ui/Screen';
import { palette } from '@/components/ui/theme';
import { useTheme } from '@/hooks/useTheme';
import { useSession } from '@/providers/SessionProvider';
export default function HomeScreen() { const { session } = useSession(); const color = palette(useTheme()); return <Screen><Text style={[styles.title, { color: color.text }]}>Welcome to Sporttag</Text><Text style={{ color: color.muted }}>{session?.user.email ?? 'Signed in'}</Text><PlatformSurface><Text style={[styles.heading, { color: color.text }]}>Platform-aware surface</Text><Text style={{ color: color.muted }}>This uses native Liquid Glass where iOS supports it, and an appropriate standard surface elsewhere.</Text></PlatformSurface><Link href="/settings" style={[styles.link, { color: color.accent }]}>Open settings</Link></Screen>; }
const styles = StyleSheet.create({ title: { fontSize: 28, fontWeight: '700' }, heading: { fontSize: 18, fontWeight: '700' }, link: { fontWeight: '700', fontSize: 16 } });
