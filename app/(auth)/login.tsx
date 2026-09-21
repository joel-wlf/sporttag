import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { Screen } from '@/components/layout/Screen';
import { Button } from '@/components/ui/Button';
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { Field } from '@/components/ui/Input';
import { supabase } from '@/lib/supabase';

export default function LoginScreen() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const signIn = async () => {
    setError(null);
    setLoading(true);
    const { error: authError } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    setLoading(false);
    if (authError) setError(authError.message);
  };

  return (
    <Screen className="justify-center gap-8" size="narrow">
      <View className="items-center gap-2">
        <Image
          source={require('@/assets/branding/app-icon/app-icon.png')}
          style={styles.mark}
        />
        <Text className="text-[11px] font-black tracking-[1.2px] text-primary">BACKOFFICE</Text>
        <Text className="text-center text-[32px] font-extrabold tracking-[-0.7px] text-ink">
          Sporttag
        </Text>
        <Text className="max-w-[420px] text-center text-[14px] leading-5 text-subtle">
          Geschützter Zugang für Organisatoren.
        </Text>
      </View>
      <Card className="w-full gap-5 p-6">
        <CardHeader>
          <CardTitle>Anmelden</CardTitle>
          <CardDescription>Mit dem persönlichen Organisatorenkonto fortfahren.</CardDescription>
        </CardHeader>
        <Field
          autoCapitalize="none"
          autoComplete="email"
          keyboardType="email-address"
          label="E-Mail-Adresse"
          onChangeText={setEmail}
          placeholder="name@beispiel.de"
          value={email}
        />
        <Field
          autoComplete="current-password"
          label="Passwort"
          onChangeText={setPassword}
          onSubmitEditing={signIn}
          placeholder="Passwort"
          secureTextEntry
          value={password}
        />
        {error ? (
          <View className="rounded-2xl bg-danger-soft px-4 py-3">
            <Text accessibilityRole="alert" className="text-[13px] font-semibold text-danger">
              {error}
            </Text>
          </View>
        ) : null}
        <Button fullWidth isLoading={loading} label="Anmelden" onPress={signIn} size="lg" />
      </Card>
      <Button
        fullWidth
        label="Zur Station"
        onPress={() => router.replace('/join')}
        variant="outline"
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  mark: { width: 56, height: 56, borderRadius: 18, marginBottom: 8 },
});
