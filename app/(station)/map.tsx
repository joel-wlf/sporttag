import { useLocalSearchParams, useRouter } from 'expo-router';
import { Text, View } from 'react-native';
import { Screen } from '@/components/layout/Screen';
import { ActionBar } from '@/components/station/ActionBar';
import { ContextBar } from '@/components/station/ContextBar';
import { SatelliteMap } from '@/components/map/SatelliteMap';
import { Icon } from '@/components/ui/Icon';
import { useTokens } from '@/components/ui/theme';
import { haptic } from '@/lib/haptics';
import { useStationSession } from '@/providers/StationSessionProvider';

export default function StationMapScreen() {
  const router = useRouter();
  const tokens = useTokens();
  const { setupId, station, block, game } = useLocalSearchParams<{
    setupId?: string;
    station?: string;
    block?: string;
    game?: string;
  }>();
  const { pkg, activeCheckin, checkIn, checkOut, syncCounts } = useStationSession();

  const stationRow = pkg?.stations.find((s) =>
    pkg.station_setups.find((su) => su.id === setupId && su.station_id === s.id),
  );

  const checkedInHere = Boolean(setupId) && activeCheckin?.stationSetupId === setupId && !activeCheckin?.checkedOutAt;
  const leavingSetupId = activeCheckin && !activeCheckin.checkedOutAt && activeCheckin.stationSetupId !== setupId
    ? activeCheckin.stationSetupId
    : undefined;
  const leavingStation = leavingSetupId
    ? pkg?.stations.find((s) => pkg.station_setups.find((su) => su.id === leavingSetupId && su.station_id === s.id))
    : undefined;

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
                    router.push({ pathname: '/cockpit', params: { setupId, station, block, game } }),
                }
              : {
                  label: 'Station übernehmen',
                  onPress: () => {
                    if (!setupId) return;
                    haptic('success');
                    void checkIn(setupId);
                  },
                }
          }
          secondary={
            checkedInHere ? { label: 'Auschecken', haptic: 'warning', onPress: () => void checkOut() } : undefined
          }
        />
      }
      size="narrow"
    >
      <ContextBar
        onBack={() => router.back()}
        pendingSync={syncCounts.pending + syncCounts.sending}
        subtitle={game}
        title={[block, station].filter(Boolean).join(' · ') || 'Station'}
      />

      {stationRow ? (
        <View style={{ borderRadius: 22, overflow: 'hidden' }}>
          <SatelliteMap
            center={[stationRow.longitude, stationRow.latitude]}
            height={380}
            pins={[{ id: stationRow.id, coordinate: [stationRow.longitude, stationRow.latitude], label: stationRow.name, selected: true }]}
            zoom={17}
          />
        </View>
      ) : (
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
      )}

      {stationRow?.arrival_notes ? (
        <Text className="text-center text-sm text-subtle">{stationRow.arrival_notes}</Text>
      ) : null}

      {checkedInHere ? (
        <View className="flex-row items-center gap-2 self-center rounded-full bg-success-soft px-3 py-1.5">
          <Icon color={tokens.success} name="check-circle" size={15} />
          <Text className="text-xs font-bold text-success">Station übernommen</Text>
        </View>
      ) : leavingStation ? (
        <View className="flex-row items-center gap-2 self-center rounded-full bg-warning-soft px-3 py-1.5">
          <Icon color={tokens.warning} name="refresh" size={15} />
          <Text className="text-xs font-bold text-warning">Wechsel aus {leavingStation.name}</Text>
        </View>
      ) : null}
    </Screen>
  );
}
