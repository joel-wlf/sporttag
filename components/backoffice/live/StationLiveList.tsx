import { Pressable, Text, View } from 'react-native';
import { Icon } from '@/components/ui/Icon';
import { useTokens } from '@/components/ui/theme';
import {
  liveGroupLabel,
  liveGroupOf,
  liveGroupOrder,
  liveStatusLabel,
  liveStatusOrder,
  statusReason,
  type StationLive,
} from '@/lib/live/derive';
import { statusColor } from './liveStatusColor';

function StationRow({
  row,
  selected,
  now,
  onPress,
}: {
  row: StationLive;
  selected: boolean;
  now: Date;
  onPress: () => void;
}) {
  const tokens = useTokens();
  const color = statusColor(tokens, row.status);
  const reason = statusReason(row, now);
  return (
    <Pressable
      accessibilityRole="button"
      className={[
        'flex-row overflow-hidden rounded-2xl border',
        selected ? 'border-primary bg-primary-soft' : 'border-line bg-surface active:bg-surface-muted',
      ].join(' ')}
      onPress={onPress}
    >
      <View style={{ width: 5, backgroundColor: color }} />
      <View className="flex-1 gap-1 px-3.5 py-3">
        <View className="flex-row items-center gap-2">
          <Text className="flex-1 text-[15px] font-extrabold text-ink" numberOfLines={1}>
            {row.station.name}
          </Text>
          <Text className="text-[11px] font-extrabold" numberOfLines={1} style={{ color }}>
            {liveStatusLabel[row.status].toUpperCase()}
          </Text>
        </View>
        {row.game || row.teams.length > 0 ? (
          <View className="flex-row items-center gap-3">
            <View className="flex-1 gap-0.5">
              {row.game ? (
                <Text className="text-[12px] font-semibold text-subtle" numberOfLines={1}>
                  {row.game.name}
                </Text>
              ) : null}
              {row.teams.length > 0 ? (
                <Text className="text-[13px] font-bold text-ink" numberOfLines={1}>
                  {row.teams.map((t) => t.name).join(' vs. ')}
                </Text>
              ) : null}
            </View>
            {row.scoreLabel ? (
              <View className="rounded-xl px-2.5 py-1" style={{ backgroundColor: tokens.accent }}>
                <Text className="text-[16px] font-black text-ink">{row.scoreLabel}</Text>
              </View>
            ) : null}
          </View>
        ) : null}
        {reason ? (
          <Text className="text-[12px] leading-4 text-subtle" numberOfLines={2}>
            {reason}
          </Text>
        ) : null}
      </View>
      <View className="justify-center pr-3">
        <Icon color={tokens.subtle} name="chevron-right" size={16} />
      </View>
    </Pressable>
  );
}

export function StationLiveList({
  rows,
  selectedId,
  onSelect,
  now,
  grouped,
}: {
  rows: StationLive[];
  selectedId: string | null;
  onSelect: (stationId: string) => void;
  now: Date;
  /** Mit Abschnittsüberschriften nach Gruppe (für den ungefilterten Blick). */
  grouped: boolean;
}) {
  const sorted = [...rows].sort(
    (a, b) => liveStatusOrder.indexOf(a.status) - liveStatusOrder.indexOf(b.status) || a.station.name.localeCompare(b.station.name),
  );

  if (!grouped) {
    return (
      <View className="gap-2">
        {sorted.map((row) => (
          <StationRow key={row.station.id} now={now} onPress={() => onSelect(row.station.id)} row={row} selected={row.station.id === selectedId} />
        ))}
      </View>
    );
  }

  return (
    <View className="gap-5">
      {liveGroupOrder.map((group) => {
        const items = sorted.filter((r) => liveGroupOf[r.status] === group);
        if (items.length === 0) return null;
        return (
          <View className="gap-2" key={group}>
            <Text className="px-1 text-[11px] font-black tracking-[0.8px] text-subtle">
              {liveGroupLabel[group].toUpperCase()} · {items.length}
            </Text>
            {items.map((row) => (
              <StationRow key={row.station.id} now={now} onPress={() => onSelect(row.station.id)} row={row} selected={row.station.id === selectedId} />
            ))}
          </View>
        );
      })}
    </View>
  );
}
