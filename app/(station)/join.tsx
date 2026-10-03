import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Screen } from '@/components/layout/Screen';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { useTokens } from '@/components/ui/theme';
import { friendlyErrorMessage } from '@/lib/api/errors';
import { confirmAsync } from '@/lib/confirm';
import { haptic } from '@/lib/haptics';
import { useStationSession } from '@/providers/StationSessionProvider';

const CODE_LENGTH = 6;

export default function StationJoinScreen() {
  const router = useRouter();
  const tokens = useTokens();
  const {
    isReady,
    eventId,
    pkg,
    staffId,
    joinWithCode,
    retryDownload,
    resetDevice,
    resumableEvent,
    resumeEvent,
  } = useStationSession();
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [downloadFailed, setDownloadFailed] = useState(false);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<TextInput>(null);

  // Einziger Weg aus dem Beitritt: sobald ein Paket vorliegt — nach einem
  // erfolgreichen Code oder weil das Gerät schon vorbereitet ist (siehe
  // docs/datenkonzept.md Abschnitt 11.1). `replace`, damit Zurück nicht
  // wieder im Codefeld landet.
  useEffect(() => {
    if (!isReady || !eventId || !pkg) return;
    router.replace(staffId ? '/assignment' : '/who');
  }, [isReady, eventId, pkg, staffId, router]);

  const handleChange = async (value: string) => {
    // Während der Prüfung keine Eingabe annehmen. Das Feld bleibt aber
    // bearbeitbar, sonst verliert es den Fokus und die Tastatur verschwindet.
    if (loading) return;
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
        if (result.redeemed) {
          // Code eingelöst, nur der Paket-Download schlug fehl: "Erneut
          // versuchen" geht ohne neue Code-Eingabe.
          setDownloadFailed(true);
        } else {
          // Falscher Code: Feld leeren und wieder fokussieren, damit sofort
          // neu getippt werden kann.
          setCode('');
          inputRef.current?.focus();
        }
        return;
      }
      haptic('success');
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
  };

  const handleReset = async () => {
    if (
      !(await confirmAsync(
        'Alle lokalen Daten dieses Geräts werden gelöscht, auch noch nicht übertragene Ergebnisse.',
        'Gerät zurücksetzen?',
        'Zurücksetzen',
      ))
    ) {
      return;
    }
    haptic('warning');
    setCode('');
    setError(null);
    setDownloadFailed(false);
    await resetDevice();
  };

  const digits = Array.from({ length: CODE_LENGTH }, (_, index) => code[index] ?? '');

  // Ein vorbereitetes Gerät springt gleich weiter (Effekt oben): kein
  // aufblitzendes Codefeld, keine aufspringende Tastatur.
  if (!isReady || (eventId && pkg)) {
    return (
      <View className="flex-1 items-center justify-center bg-canvas">
        <ActivityIndicator color={tokens.primary} />
      </View>
    );
  }

  // Der Ziffernblock hat keine Schließen-Taste: ohne Ausweichen lägen die
  // Links darunter (Anmelden, Zurücksetzen) unerreichbar hinter der Tastatur.
  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      className="flex-1 bg-canvas"
      // Die schwebende iOS-Tastatur ragt über ihren gemeldeten Rahmen hinaus.
      keyboardVerticalOffset={48}
    >
      <Screen density="compact" size="narrow">
        <View className="flex-1 items-center justify-center gap-8">
          <View className="items-center gap-1">
            <Icon name="flag" color={tokens.primary} size={28} />
            <Text accessibilityRole="header" className="mt-2 text-xl font-extrabold text-ink">
              Veranstaltungscode
            </Text>
            <Text className="max-w-[300px] text-center text-sm leading-5 text-subtle">
              Den sechsstelligen Code gibt die Veranstaltungsleitung aus.
            </Text>
          </View>

          <Pressable
            accessibilityLabel="Sechsstelligen Veranstaltungscode eingeben"
            accessibilityRole="button"
            accessibilityValue={{ text: `${code.length} von ${CODE_LENGTH} Ziffern` }}
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
          {loading ? (
            <View className="flex-row items-center gap-2">
              <ActivityIndicator color={tokens.subtle} size="small" />
              <Text className="text-sm font-semibold text-subtle">Code wird geprüft …</Text>
            </View>
          ) : null}
          {error ? (
            <View className="items-center gap-3">
              <Text
                accessibilityRole="alert"
                className="text-center text-sm font-semibold text-danger"
              >
                {error}
              </Text>
              {downloadFailed ? (
                <Button
                  isLoading={loading}
                  label="Erneut laden"
                  onPress={() => void handleRetry()}
                  variant="outline"
                />
              ) : null}
            </View>
          ) : null}

          <TextInput
            autoFocus
            className="absolute h-px w-px opacity-0"
            keyboardType="number-pad"
            maxLength={CODE_LENGTH}
            onChangeText={handleChange}
            ref={inputRef}
            value={code}
          />
        </View>

        {resumableEvent ? (
          // Rückweg nach "Veranstaltung verlassen": das Paket liegt noch auf
          // dem Gerät, dafür braucht es weder Internet noch den Code.
          <Button
            fullWidth
            label={`Zurück zu „${resumableEvent.name}“`}
            leftIcon="arrow-left"
            onPress={() => {
              haptic('light');
              void resumeEvent();
            }}
            variant="outline"
          />
        ) : null}

        <View className="flex-row flex-wrap items-center justify-center">
          <Pressable
            accessibilityRole="link"
            className="min-h-[44px] items-center justify-center px-4 active:opacity-60"
            onPress={() => router.replace('/login')}
          >
            <Text className="text-sm font-semibold text-subtle">Als Organisator anmelden</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            className="min-h-[44px] items-center justify-center px-4 active:opacity-60"
            onPress={() => void handleReset()}
          >
            <Text className="text-sm font-semibold text-danger">Gerät zurücksetzen</Text>
          </Pressable>
          <Pressable
            accessibilityRole="link"
            className="min-h-[44px] items-center justify-center px-4 active:opacity-60"
            onPress={() => router.push('/privacy')}
          >
            <Text className="text-sm font-semibold text-subtle">Datenschutz</Text>
          </Pressable>
          <Pressable
            accessibilityRole="link"
            className="min-h-[44px] items-center justify-center px-4 active:opacity-60"
            onPress={() => router.push('/support')}
          >
            <Text className="text-sm font-semibold text-subtle">Support</Text>
          </Pressable>
        </View>
      </Screen>
    </KeyboardAvoidingView>
  );
}
