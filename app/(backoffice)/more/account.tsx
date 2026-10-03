import { useRouter } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { Header } from '@/components/layout/Header';
import { Screen } from '@/components/layout/Screen';
import { Button } from '@/components/ui/Button';
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { ListRow } from '@/components/ui/ListRow';
import { supabase } from '@/lib/supabase';
import { useSession } from '@/providers/SessionProvider';

export default function AccountScreen() {
  const router = useRouter();
  const { session } = useSession();
  const email = session?.user.email ?? 'Unbekannt';
  const [signingOut, setSigningOut] = useState(false);

  // Nach dem Abmelden führt die Routenwache (app/_layout.tsx) zum Login.
  // Nur dieses Gerät abmelden: Supabase meldet sonst standardmäßig alle
  // Sitzungen des Kontos ab, also auch das Backoffice am Laptop.
  const signOut = async () => {
    setSigningOut(true);
    await supabase.auth.signOut({ scope: 'local' });
  };

  return (
    <Screen>
      <Header
        description="Persönliches Organisatorenkonto. Stationsgeräte brauchen kein Konto, sie treten mit dem Veranstaltungscode bei."
        eyebrow="KONTO"
        title="Konto"
      />
      <Card>
        <CardHeader>
          <CardTitle>Angemeldet</CardTitle>
          <CardDescription>Das Backoffice ist nur mit diesem Konto erreichbar.</CardDescription>
        </CardHeader>
        <View className="gap-1">
          <ListRow icon="user" subtitle={email} title="Organisator" />
        </View>
        <Button
          className="mt-1 self-start"
          isLoading={signingOut}
          label="Abmelden"
          onPress={() => void signOut()}
          variant="outline"
        />
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Rechtliches & Hilfe</CardTitle>
        </CardHeader>
        <View className="gap-1">
          <ListRow icon="shield" onPress={() => router.push('/privacy')} showChevron title="Datenschutzerklärung" />
          <ListRow icon="headset" onPress={() => router.push('/support')} showChevron title="Support & Feedback" />
        </View>
      </Card>
    </Screen>
  );
}
