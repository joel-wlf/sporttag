import { useState } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { Screen } from '@/components/ui/Screen';
import { Button, ButtonSpinner, ButtonText } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input, InputField } from '@/components/ui/input';
import { useTheme } from '@/hooks/useTheme';
import { palette } from '@/components/ui/theme';
import { supabase } from '@/lib/supabase';

export default function LoginScreen() {
  const [email, setEmail] = useState(''); const [password, setPassword] = useState(''); const [error, setError] = useState<string | null>(null); const [loading, setLoading] = useState(false);
  const theme = useTheme(); const color = palette(theme);
  const signIn = async () => { setError(null); setLoading(true); const { error: authError } = await supabase.auth.signInWithPassword({ email: email.trim(), password }); setLoading(false); if (authError) setError(authError.message); };
  return <Screen><View style={styles.hero}><Image source={require('@/assets/branding/app-icon/app-icon.png')} style={styles.mark} /><Text className="text-[11px] font-black tracking-[1.2px] text-primary">BACKOFFICE</Text><Text className="text-center text-[32px] font-extrabold tracking-[-0.7px] text-ink">Sporttag</Text></View><Card className="w-full gap-4 rounded-[28px] border border-line bg-surface p-6 shadow-sm"><Text className="mb-1 text-lg font-extrabold text-ink">Anmelden</Text><View className="gap-2"><Text className="text-[13px] font-bold text-ink">E-Mail-Adresse</Text><Input className="h-[50px] rounded-[14px] border border-line bg-canvas px-1"><InputField autoCapitalize="none" autoComplete="email" keyboardType="email-address" onChangeText={setEmail} placeholder="name@beispiel.de" placeholderTextColor={color.muted} className="h-full px-3 text-base text-ink outline-none" value={email} /></Input></View><View className="gap-2"><Text className="text-[13px] font-bold text-ink">Passwort</Text><Input className="h-[50px] rounded-[14px] border border-line bg-canvas px-1"><InputField autoComplete="current-password" onChangeText={setPassword} onSubmitEditing={signIn} placeholder="Passwort" placeholderTextColor={color.muted} secureTextEntry className="h-full px-3 text-base text-ink outline-none" value={password} /></Input></View>{error ? <Text accessibilityRole="alert" className="text-sm text-danger">{error}</Text> : null}<Button accessibilityRole="button" className="mt-1 h-[50px] items-center justify-center rounded-full bg-primary active:opacity-75 disabled:opacity-60" disabled={loading} onPress={signIn}>{loading ? <ButtonSpinner color="#fff" /> : <ButtonText className="text-base font-extrabold text-white">Anmelden</ButtonText>}</Button></Card></Screen>;
}
const styles = StyleSheet.create({ hero: { gap: 7, marginTop: 54, marginBottom: 14, alignItems: 'center' }, mark: { width: 56, height: 56, borderRadius: 18, marginBottom: 8 } });
