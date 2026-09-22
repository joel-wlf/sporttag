import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Text, View } from 'react-native';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { friendlyErrorMessage } from '@/lib/api/errors';
import { useStationSession } from '@/providers/StationSessionProvider';

export function MissingPackage({ title = 'Keine Daten' }: { title?: string }) {
  const router = useRouter();
  const { eventId, retryDownload } = useStationSession();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const retry = async () => {
    setError(null);
    setLoading(true);
    const result = await retryDownload();
    setLoading(false);
    if (!result.ok) setError(friendlyErrorMessage(new Error(result.error)));
  };

  return (
    <EmptyState
      action={
        <View className="items-center gap-3">
          {eventId ? <Button isLoading={loading} label="Paket erneut laden" onPress={() => void retry()} /> : null}
          <Button label="Neu beitreten" onPress={() => router.replace('/join')} variant="outline" />
          {error ? <Text className="text-center text-sm font-semibold text-danger">{error}</Text> : null}
        </View>
      }
      description={
        eventId
          ? 'Das Offline-Paket wurde noch nicht geladen. Bei Internetverbindung erneut laden.'
          : 'Dieses Gerät ist keiner Veranstaltung beigetreten.'
      }
      icon="package"
      title={title}
    />
  );
}
