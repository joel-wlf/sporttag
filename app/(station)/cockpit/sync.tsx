import { useState } from 'react';
import { Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Screen } from '@/components/layout/Screen';
import { ActionBar } from '@/components/station/ActionBar';
import { StatusBadge, type SyncStatus } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { friendlyErrorMessage } from '@/lib/api/errors';
import { confirmAsync } from '@/lib/confirm';
import { haptic } from '@/lib/haptics';
import { teamName } from '@/lib/station/package';
import { useStationSession } from '@/providers/StationSessionProvider';

function Stat({ value, label }: { value: number; label: string }) {
  return (
    <View className="flex-1 items-center gap-0.5 rounded-card border border-line bg-surface py-4">
      <Text className="text-stat font-extrabold text-ink">{value}</Text>
      <Text className="text-2xs font-bold uppercase tracking-[0.5px] text-subtle">{label}</Text>
    </View>
  );
}

const statusFor = (state: string, receiptStatus: string | null): SyncStatus => {
  if (state !== 'received') return 'pending';
  if (receiptStatus === 'accepted') return 'synced';
  return 'review';
};

export default function CockpitSyncScreen() {
  const router = useRouter();
  const { pkg, eventId, syncCounts, syncOutcome, lastSyncedAt, syncNow, submitManifest, leave, resetDevice } = useStationSession();
  const [manifestState, setManifestState] = useState<'idle' | 'sending' | 'done' | 'error'>('idle');
  const [manifestMessage, setManifestMessage] = useState<string | null>(null);

  const rejoin = async () => {
    haptic('light');
    await leave();
    router.replace('/join');
  };

  const reset = async () => {
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
    await resetDevice();
    router.replace('/join');
  };

  const runManifest = async () => {
    haptic('medium');
    setManifestState('sending');
    setManifestMessage(null);
    try {
      const result = await submitManifest();
      setManifestState('done');
      setManifestMessage(
        result.complete
          ? 'Abschluss vollständig gemeldet.'
          : `Es fehlen noch ${result.missing_sequences.length} Abgabe(n) oder Inhalte stimmen nicht überein.`,
      );
    } catch (err) {
      setManifestState('error');
      setManifestMessage(friendlyErrorMessage(err));
    }
  };

  // Pending/Review-Matches aus dem lokalen Paket-Kontext für die Liste.
  const pendingMatches = eventId && pkg
    ? pkg.matches
        .map((m) => ({ match: m, round: pkg.rounds.find((r) => r.id === m.round_id) }))
        .filter(({ match }) => match.status === 'completed')
    : [];

  return (
    <Screen
      density="compact"
      footer={
        <ActionBar
          primary={{
            label: syncOutcome === 'syncing' ? 'Synchronisiert …' : 'Jetzt synchronisieren',
            isLoading: syncOutcome === 'syncing',
            onPress: () => {
              haptic('medium');
              void syncNow();
            },
          }}
        />
      }
    >
      <View className="flex-row gap-2">
        <Stat label="Ausstehend" value={syncCounts.pending + syncCounts.sending} />
        <Stat label="Klärung" value={syncCounts.review} />
        <Stat label="Übertragen" value={syncCounts.synced} />
      </View>

      {syncOutcome === 'offline' ? (
        <Text className="text-sm font-semibold text-warning">Kein Netz — Ergebnisse bleiben gesichert.</Text>
      ) : syncOutcome === 'unauthorized' ? (
        <View className="gap-2 rounded-card border border-danger/40 bg-danger-soft p-3">
          <Text className="text-sm font-semibold text-danger">
            Gerätezugang ungültig. Bitte erneut über den Veranstaltungscode beitreten; nichts wurde gelöscht.
          </Text>
          <Button label="Neu beitreten" onPress={() => void rejoin()} size="sm" variant="outline" />
        </View>
      ) : null}

      {pendingMatches.length > 0 ? (
        <View className="gap-1">
          {pendingMatches.map(({ match, round }) => (
            <View className="flex-row items-center gap-3 rounded-control border border-line bg-surface px-3 py-3" key={match.id}>
              <View className="flex-1 gap-0.5">
                <Text className="text-sm font-bold text-ink">
                  {match.participants.map((p) => (pkg ? teamName(pkg, p.team_id) : '')).join(' – ')}
                </Text>
                <Text className="text-xs text-subtle">{round?.label}</Text>
              </View>
              <StatusBadge status={statusFor('received', 'accepted')} />
            </View>
          ))}
        </View>
      ) : (
        <Text className="text-sm text-subtle">Alles übertragen.</Text>
      )}

      {lastSyncedAt ? (
        <Text className="text-xs text-subtle">
          Zuletzt synchronisiert um {new Date(lastSyncedAt).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}.
        </Text>
      ) : null}

      <View className="gap-2 rounded-card border border-line bg-surface p-4">
        <Text className="text-sm font-extrabold text-ink">Abschluss dieses Geräts</Text>
        <Text className="text-xs leading-5 text-subtle">
          Meldet dem Backoffice, dass alle bisherigen Ergebnisse dieses Geräts vollständig und unverändert
          angekommen sind — der garantierte Mindestweg, auch wenn zwischendurch kein Internet verfügbar war.
        </Text>
        <Button
          isLoading={manifestState === 'sending'}
          label="Abschluss melden"
          onPress={() => void runManifest()}
          variant="outline"
        />
        {manifestMessage ? (
          <Text className={manifestState === 'error' ? 'text-xs text-danger' : 'text-xs text-subtle'}>{manifestMessage}</Text>
        ) : null}
      </View>

      <View className="gap-2 rounded-card border border-line bg-surface p-4">
        <Text className="text-sm font-extrabold text-ink">Gerät zurücksetzen</Text>
        <Text className="text-xs leading-5 text-subtle">
          Löscht alle lokalen Daten dieses Geräts, auch noch nicht übertragene Ergebnisse, und führt zurück zum
          Veranstaltungscode. Nur benutzen, wenn das Gerät wirklich zurückgesetzt werden soll.
        </Text>
        <Button label="Zurücksetzen" onPress={() => void reset()} variant="outline" />
      </View>
    </Screen>
  );
}
