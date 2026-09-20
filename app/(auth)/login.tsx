import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Screen } from '@/components/ui/Screen';
import { PlatformSurface } from '@/components/platform/PlatformSurface';
import { useTheme } from '@/hooks/useTheme';
import { palette } from '@/components/ui/theme';
import { supabase } from '@/lib/supabase';

export default function LoginScreen() {
  const [email, setEmail] = useState(''); const [password, setPassword] = useState(''); const [error, setError] = useState<string | null>(null); const [loading, setLoading] = useState(false);
  const theme = useTheme(); const color = palette(theme);
  const signIn = async () => { setError(null); setLoading(true); const { error: authError } = await supabase.auth.signInWithPassword({ email: email.trim(), password }); setLoading(false); if (authError) setError(authError.message); };
  return <Screen><View style={styles.hero}><Text style={[styles.title, { color: color.text }]}>Sporttag</Text><Text style={{ color: color.muted }}>Sign in to continue.</Text></View><PlatformSurface><Text style={[styles.label, { color: color.text }]}>Email</Text><TextInput autoCapitalize="none" autoComplete="email" keyboardType="email-address" onChangeText={setEmail} placeholder="you@example.com" placeholderTextColor={color.muted} style={[styles.input, { color: color.text, borderColor: color.border }]} value={email} /><Text style={[styles.label, { color: color.text }]}>Password</Text><TextInput autoComplete="current-password" onChangeText={setPassword} placeholder="Your password" placeholderTextColor={color.muted} secureTextEntry style={[styles.input, { color: color.text, borderColor: color.border }]} value={password} />{error ? <Text accessibilityRole="alert" style={{ color: color.danger }}>{error}</Text> : null}<Pressable accessibilityRole="button" disabled={loading} onPress={signIn} style={[styles.button, { backgroundColor: color.accent, opacity: loading ? 0.7 : 1 }]}>{loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Sign in</Text>}</Pressable></PlatformSurface></Screen>;
}
const styles = StyleSheet.create({ hero: { gap: 6, marginTop: 64, marginBottom: 12 }, title: { fontSize: 34, fontWeight: '700' }, label: { fontWeight: '600' }, input: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, fontSize: 16 }, button: { alignItems: 'center', borderRadius: 10, minHeight: 48, justifyContent: 'center', marginTop: 4 }, buttonText: { color: '#fff', fontSize: 16, fontWeight: '700' } });
