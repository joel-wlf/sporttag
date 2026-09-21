import { useState } from 'react';
import { Text, View } from 'react-native';
import { Screen } from '@/components/layout/Screen';
import { ActionBar } from '@/components/station/ActionBar';
import { pendingMatches, syncSummary } from '@/components/station/demoData';
import { StatusBadge, type SyncStatus } from '@/components/ui/Badge';
import { haptic } from '@/lib/haptics';

function Stat({ value, label }: { value: number; label: string }) {
  return (
    <View className="flex-1 items-center gap-0.5 rounded-card border border-line bg-surface py-4">
      <Text className="text-stat font-extrabold text-ink">{value}</Text>
      <Text className="text-2xs font-bold uppercase tracking-[0.5px] text-subtle">{label}</Text>
    </View>
  );
}

export default function CockpitSyncScreen() {
  const [syncedAt, setSyncedAt] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);

  return (
    <Screen
      density="compact"
      footer={
        <ActionBar
          primary={{
            label: syncing ? 'Synchronisiert …' : 'Jetzt synchronisieren',
            isLoading: syncing,
            onPress: () => {
              haptic('medium');
              setSyncing(true);
              setTimeout(() => {
                setSyncing(false);
                setSyncedAt(new Date().toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }));
              }, 900);
            },
          }}
        />
      }
    >
      <View className="flex-row gap-2">
        <Stat label="Gesichert" value={syncSummary.saved} />
        <Stat label="Ausstehend" value={syncSummary.pending} />
        <Stat label="Übertragen" value={syncSummary.synced} />
      </View>

      {pendingMatches.length > 0 ? (
        <View className="gap-1">
          {pendingMatches.map((match) => (
            <View
              className="flex-row items-center gap-3 rounded-control border border-line bg-surface px-3 py-3"
              key={match.id}
            >
              <View className="flex-1 gap-0.5">
                <Text className="text-sm font-bold text-ink">
                  {match.teams.map((t) => t.name).join(' – ')}
                </Text>
                <Text className="text-xs text-subtle">
                  {match.time} · {match.game}
                </Text>
              </View>
              <StatusBadge status={match.syncStatus as SyncStatus} />
            </View>
          ))}
        </View>
      ) : (
        <Text className="text-sm text-subtle">Alles übertragen.</Text>
      )}

      {syncedAt ? (
        <Text className="text-xs text-subtle">Zuletzt synchronisiert um {syncedAt}.</Text>
      ) : null}
    </Screen>
  );
}
