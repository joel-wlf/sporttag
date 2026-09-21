import { useLocalSearchParams, useRouter } from 'expo-router';
import { Text, View } from 'react-native';
import { Screen } from '@/components/layout/Screen';
import { ActionBar } from '@/components/station/ActionBar';
import { ContextBar } from '@/components/station/ContextBar';
import { findDayEntry, pendingSyncCount } from '@/components/station/demoData';
import { Icon } from '@/components/ui/Icon';
import { useTokens } from '@/components/ui/theme';
import { haptic } from '@/lib/haptics';
import { useStationSession } from '@/providers/StationSessionProvider';

export default function StationMapScreen() {
  const router = useRouter();
  const tokens = useTokens();
  const { station, block, game, entryId } = useLocalSearchParams<{
    station?: string;
    block?: string;
    game?: string;
    entryId?: string;
  }>();
  const { checkedInId, checkIn, checkOut } = useStationSession();

  const checkedInHere = Boolean(entryId) && checkedInId === entryId;
  const leaving = checkedInId && checkedInId !== entryId ? findDayEntry(checkedInId) : undefined;

  return (
    <Screen
      density="compact"
      footer={
        <ActionBar
          primary={
            checkedInHere
              ? {
                  label: 'Zum Cockpit',
                  rightIcon: 'chevron-right',
                  onPress: () =>
                    router.push({ pathname: '/cockpit', params: { station, block, game } }),
                }
              : {
                  label: 'Station übernehmen',
                  onPress: () => {
                    if (!entryId) return;
                    haptic('success');
                    checkIn(entryId);
                  },
                }
          }
          secondary={
            checkedInHere ? { label: 'Auschecken', haptic: 'warning', onPress: checkOut } : undefined
          }
        />
      }
      size="narrow"
    >
      <ContextBar
        onBack={() => router.back()}
        pendingSync={pendingSyncCount}
        subtitle={game}
        title={[block, station].filter(Boolean).join(' · ') || 'Station'}
      />

      <View className="min-h-[380px] flex-1 items-center justify-center overflow-hidden rounded-sheet border border-line bg-surface-muted">
        <View className="items-center gap-3">
          <View className="h-16 w-16 items-center justify-center rounded-full bg-primary shadow-sm">
            <Icon color={tokens.onPrimary} name="map-pin" size={28} />
          </View>
          <View className="rounded-control bg-surface px-4 py-2 shadow-sm">
            <Text className="text-sm font-extrabold text-ink">{station ?? 'Station'}</Text>
          </View>
        </View>
      </View>

      {checkedInHere ? (
        <View className="flex-row items-center gap-2 self-center rounded-full bg-success-soft px-3 py-1.5">
          <Icon color={tokens.success} name="check-circle" size={15} />
          <Text className="text-xs font-bold text-success">Station übernommen</Text>
        </View>
      ) : leaving ? (
        <View className="flex-row items-center gap-2 self-center rounded-full bg-warning-soft px-3 py-1.5">
          <Icon color={tokens.warning} name="refresh" size={15} />
          <Text className="text-xs font-bold text-warning">Wechsel aus {leaving.block}</Text>
        </View>
      ) : null}
    </Screen>
  );
}
