import { useRouter } from 'expo-router';
import { View } from 'react-native';
import { ModuleScreen } from '@/components/layout/ModuleScreen';
import { Button } from '@/components/ui/Button';
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { ListRow } from '@/components/ui/ListRow';
import { supabase } from '@/lib/supabase';
import { useSession } from '@/providers/SessionProvider';

export default function AccountScreen() {
  const router = useRouter();
  const { session } = useSession();
  const email = session?.user.email ?? 'Unbekannt';

  return (
    <ModuleScreen
      capabilities={[
        'Persönliches Organisatorenprofil',
        'Anmeldung und Abmeldung',
        'Darstellung und Sprache',
        'Keine Konten für Stationsmanager – diese nutzen den Veranstaltungscode',
      ]}
      description="Persönliches Organisatorkonto. Das Backoffice ist separat geschützt."
      eyebrow="KONTO"
      title="Konto"
    >
      <Card>
        <CardHeader>
          <CardTitle>Angemeldet als</CardTitle>
          <CardDescription>{email}</CardDescription>
        </CardHeader>
        <View className="gap-1">
          <ListRow icon="user" subtitle={email} title="Organisator" />
        </View>
        <Button
          className="mt-1 self-start"
          label="Abmelden"
          onPress={() => {
            void supabase.auth.signOut();
          }}
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
    </ModuleScreen>
  );
}
