import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { Screen } from '@/components/layout/Screen';
import { Icon } from '@/components/ui/Icon';
import { useTokens } from '@/components/ui/theme';
import { friendlyErrorMessage } from '@/lib/api/errors';
import { haptic } from '@/lib/haptics';
import { getStoredPackage } from '@/lib/station/package';
import { useStationSession } from '@/providers/StationSessionProvider';

const CODE_LENGTH = 6;

export default function StationJoinScreen() {
  const router = useRouter();
  const tokens = useTokens();
  const { isReady, eventId, staffId, joinWithCode, retryDownload } = useStationSession();
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [downloadFailed, setDownloadFailed] = useState(false);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<TextInput>(null);

  // Ein bereits vorbereitetes Gerät springt direkt weiter, ohne den Code
  // erneut zu verlangen (siehe docs/datenkonzept.md Abschnitt 11.1).
  useEffect(() => {
    if (!isReady || !eventId) return;
    (async () => {
      const pkg = await getStoredPackage(eventId);
      if (!pkg) return;
      router.replace(staffId ? '/assignment' : '/who');
    })();
  }, [isReady, eventId, staffId, router]);

  const handleChange = async (value: string) => {
    const digits = value.replace(/\D/g, '').slice(0, CODE_LENGTH);
    setCode(digits);
    setError(null);
    setDownloadFailed(false);
    if (digits.length === CODE_LENGTH) {
      setLoading(true);
      const result = await joinWithCode(digits);
      setLoading(false);
      if (!result.ok) {
        haptic('error');
        setError(friendlyErrorMessage(new Error(result.error)));
        // Der Code wurde bereits eingelöst (Gerät ist beim Server registriert) —
        // nur der Paket-Download ist fehlgeschlagen. Kein Reset auf leeren
        // Code, damit "Erneut versuchen" ohne erneute Code-Eingabe geht.
        setDownloadFailed(true);
        return;
      }
      haptic('success');
      router.push('/who');
    }
  };

  const handleRetry = async () => {
    setError(null);
    setLoading(true);
    const result = await retryDownload();
    setLoading(false);
    if (!result.ok) {
      haptic('error');
      setError(friendlyErrorMessage(new Error(result.error)));
      return;
    }
    haptic('success');
    router.push('/who');
  };

  const digits = Array.from({ length: CODE_LENGTH }, (_, index) => code[index] ?? '');

  return (
    <Screen density="compact" size="narrow">
      <View className="flex-1 items-center justify-center gap-8">
        <View className="items-center gap-1">
          <Icon name="flag" color={tokens.primary} size={28} />
          <Text className="mt-2 text-xl font-extrabold text-ink">Veranstaltungscode</Text>
        </View>

        <Pressable
          accessibilityLabel="Sechsstelligen Veranstaltungscode eingeben"
          accessibilityRole="button"
          className="flex-row gap-2"
          onPress={() => inputRef.current?.focus()}
        >
          {digits.map((digit, index) => (
            <View
              className={[
                'h-14 w-11 items-center justify-center rounded-control border-2 bg-surface',
                digit
                  ? 'border-primary'
                  : index === code.length
                    ? 'border-primary/60 border-dashed'
                    : 'border-line',
              ].join(' ')}
              key={index}
            >
              <Text className="text-xl font-extrabold text-ink">{digit}</Text>
            </View>
          ))}
        </Pressable>
        {loading ? <Text className="text-sm font-semibold text-subtle">Wird geprüft …</Text> : null}
        {error ? (
          <View className="items-center gap-3">
            <Text className="text-center text-sm font-semibold text-danger">{error}</Text>
            {downloadFailed ? (
              <Pressable
                accessibilityRole="button"
                className="rounded-control border border-primary px-4 py-2 active:opacity-70"
                onPress={() => void handleRetry()}
              >
                <Text className="text-sm font-bold text-primary">Erneut versuchen</Text>
              </Pressable>
            ) : null}
          </View>
        ) : null}

        <TextInput
          autoFocus
          className="absolute h-px w-px opacity-0"
          editable={!loading}
          keyboardType="number-pad"
          maxLength={CODE_LENGTH}
          onChangeText={handleChange}
          ref={inputRef}
          value={code}
        />
      </View>

      <Pressable
        accessibilityRole="link"
        className="items-center py-3 active:opacity-60"
        onPress={() => router.replace('/login')}
      >
        <Text className="text-sm font-semibold text-subtle">Backoffice</Text>
      </Pressable>
    </Screen>
  );
}
