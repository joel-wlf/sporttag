import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Screen } from '@/components/layout/Screen';
import { ActionBar } from '@/components/station/ActionBar';
import { StatusBadge, type SyncStatus } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { useTokens } from '@/components/ui/theme';
import { friendlyErrorMessage } from '@/lib/api/errors';
import { confirmAsync } from '@/lib/confirm';
import { haptic } from '@/lib/haptics';
import { matchTeamsLabel } from '@/lib/station/package';
import { resetToJoin } from '@/lib/station/navigation';
import { useStationSession } from '@/providers/StationSessionProvider';

function Stat({ value, label }: { value: number; label: string }) {
  return (
    <View className="flex-1 items-center gap-0.5 rounded-card border border-line bg-surface py-4">
      <Text className="text-stat font-extrabold text-ink">{value}</Text>
      <Text className="text-2xs font-bold uppercase tracking-[0.5px] text-subtle">{label}</Text>
    </View>
  );
}

export default function SyncSheet() {
  const router = useRouter();
  const tokens = useTokens();
  const {
    pkg,
    syncCounts,
    matchSync,
    syncOutcome,
    lastSyncedAt,
    syncNow,
    submitManifest,
    leave,
    resetDevice,
  } = useStationSession();
  const [manifestState, setManifestState] = useState<'idle' | 'sending' | 'done' | 'error'>('idle');
  const [manifestMessage, setManifestMessage] = useState<string | null>(null);

  const rejoin = async () => {
    haptic('light');
    await leave();
    resetToJoin(router);
  };

  const reset = async () => {
    if (
      !(await confirmAsync(
        `${syncCounts.pending + syncCounts.sending > 0 ? `ACHTUNG: ${syncCounts.pending + syncCounts.sending} Ergebnis(se) sind noch nicht übertragen und gehen verloren. ` : ''}Alle lokalen Daten dieses Geräts werden gelöscht. Danach ist ein neuer Veranstaltungscode nötig.`,
        'Gerät zurücksetzen?',
        'Zurücksetzen',
      ))
    ) {
      return;
    }
    haptic('warning');
    await resetDevice();
    resetToJoin(router);
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
          : `Noch nicht vollständig: ${result.missing_sequences.length + result.mismatched.length} Abgabe(n) fehlen auf dem Server oder weichen ab. Mit Netz erneut synchronisieren und nochmals melden.`,
      );
    } catch (err) {
      setManifestState('error');
      setManifestMessage(friendlyErrorMessage(err));
    }
  };

  // Nur Abgaben dieses Geräts, mit ihrem echten Übertragungsstand aus dem
  // lokalen Postausgang. Offenes und Klärungsbedarf zuerst.
  const order: Record<SyncStatus, number> = { review: 0, pending: 1, saved: 1, synced: 2 };
  const submitted = pkg
    ? Object.entries(matchSync)
        .map(([matchId, entry]) => {
          const match = pkg.matches.find((m) => m.id === matchId);
          return match
            ? {
                match,
                round: pkg.rounds.find((r) => r.id === match.round_id),
                status: entry.status as SyncStatus,
                capturedAt: entry.capturedAt,
              }
            : null;
        })
        .filter((row): row is NonNullable<typeof row> => row !== null)
        .sort(
          (a, b) => order[a.status] - order[b.status] || b.capturedAt.localeCompare(a.capturedAt),
        )
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
      {/* Sheet-Kopf: Titel plus Schließen, zusätzlich zum Wischen nach unten. */}
      <View className="flex-row items-center justify-between gap-3">
        <Text accessibilityRole="header" className="text-lg font-extrabold text-ink">
          Übertragung
        </Text>
        <Pressable
          accessibilityLabel="Schließen"
          accessibilityRole="button"
          className="h-11 w-11 items-center justify-center rounded-full bg-surface-muted active:opacity-70"
          onPress={() => router.back()}
        >
          <Icon color={tokens.text} name="close" size={16} />
        </Pressable>
      </View>

      <View className="flex-row gap-2">
        <Stat label="Ausstehend" value={syncCounts.pending + syncCounts.sending} />
        <Stat label="Klärung" value={syncCounts.review} />
        <Stat label="Übertragen" value={syncCounts.synced} />
      </View>

      {syncOutcome === 'offline' ? (
        <Text className="text-sm font-semibold text-warning">
          Kein Netz — Ergebnisse bleiben gesichert.
        </Text>
      ) : syncOutcome === 'unauthorized' ? (
        <View className="gap-2 rounded-card border border-danger/40 bg-danger-soft p-3">
          <Text className="text-sm font-semibold text-danger">
            Gerätezugang ungültig. Bitte erneut über den Veranstaltungscode beitreten; nichts wurde
            gelöscht.
          </Text>
          <Button label="Neu beitreten" onPress={() => void rejoin()} size="sm" variant="outline" />
        </View>
      ) : null}

      {/* Vom Server abgelehnte Einträge: bleiben gesichert, blockieren die
          übrigen nicht und brauchen meist die Veranstaltungsleitung. */}
      {syncCounts.failed > 0 && syncOutcome !== 'unauthorized' ? (
        <View className="gap-1 rounded-card border border-danger/40 bg-danger-soft p-3">
          <Text className="text-sm font-semibold text-danger">
            {syncCounts.failed === 1
              ? '1 Eintrag wurde vom Server abgelehnt.'
              : `${syncCounts.failed} Einträge wurden vom Server abgelehnt.`}{' '}
            Er bleibt auf dem Gerät gesichert und wird erneut versucht. Bitte der
            Veranstaltungsleitung Bescheid geben.
          </Text>
          {syncCounts.lastError ? (
            <Text className="text-xs text-danger">
              {friendlyErrorMessage({ message: syncCounts.lastError, code: '' })}
            </Text>
          ) : null}
        </View>
      ) : null}

      {submitted.length > 0 ? (
        <View className="gap-1">
          <Text
            accessibilityRole="header"
            className="text-xs font-extrabold uppercase tracking-[0.5px] text-subtle"
          >
            Abgaben dieses Geräts
          </Text>
          {submitted.map(({ match, round, status }) => (
            <View
              className="flex-row items-center gap-3 rounded-control border border-line bg-surface px-3 py-3"
              key={match.id}
            >
              <View className="min-w-0 flex-1 gap-0.5">
                <Text className="text-sm font-bold text-ink">{matchTeamsLabel(pkg!, match)}</Text>
                <Text className="text-xs text-subtle">{round?.label}</Text>
              </View>
              <StatusBadge status={status} />
            </View>
          ))}
        </View>
      ) : (
        <Text className="text-sm text-subtle">
          Von diesem Gerät wurden noch keine Ergebnisse abgegeben.
        </Text>
      )}

      {lastSyncedAt ? (
        <Text className="text-xs text-subtle">
          Zuletzt synchronisiert um{' '}
          {new Date(lastSyncedAt).toLocaleTimeString('de-DE', {
            hour: '2-digit',
            minute: '2-digit',
          })}
          .
        </Text>
      ) : null}

      <View className="gap-2 rounded-card border border-line bg-surface p-4">
        <Text className="text-sm font-extrabold text-ink">Abschluss dieses Geräts</Text>
        <Text className="text-xs leading-5 text-subtle">
          Meldet dem Backoffice, dass alle bisherigen Ergebnisse dieses Geräts vollständig und
          unverändert angekommen sind — der garantierte Mindestweg, auch wenn zwischendurch kein
          Internet verfügbar war.
        </Text>
        <Button
          isLoading={manifestState === 'sending'}
          label="Abschluss melden"
          onPress={() => void runManifest()}
          variant="outline"
        />
        {manifestMessage ? (
          <Text
            className={manifestState === 'error' ? 'text-xs text-danger' : 'text-xs text-subtle'}
          >
            {manifestMessage}
          </Text>
        ) : null}
      </View>

      <View className="gap-2 rounded-card border border-line bg-surface p-4">
        <Text className="text-sm font-extrabold text-ink">Gerät zurücksetzen</Text>
        <Text className="text-xs leading-5 text-subtle">
          Löscht alle lokalen Daten dieses Geräts, auch noch nicht übertragene Ergebnisse, und führt
          zurück zum Veranstaltungscode. Nur benutzen, wenn das Gerät wirklich zurückgesetzt werden
          soll.
        </Text>
        <Button label="Zurücksetzen" onPress={() => void reset()} variant="outline" />
      </View>
    </Screen>
  );
}
