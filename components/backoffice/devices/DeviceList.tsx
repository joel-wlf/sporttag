import { Pressable, Text, View } from 'react-native';
import { Badge } from '@/components/ui/Badge';
import { Icon } from '@/components/ui/Icon';
import { useTokens } from '@/components/ui/theme';
import { haptic } from '@/lib/haptics';
import type { DeviceSyncRow } from '@/lib/api/devices';

function timeAgo(iso: string | null) {
  if (!iso) return 'nie gemeldet';
  const minutes = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (minutes < 1) return 'gerade eben';
  if (minutes < 60) return `vor ${minutes} Min.`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `vor ${hours} Std.`;
  return new Date(iso).toLocaleDateString('de-DE');
}

export function DeviceList({ rows, onSelect }: { rows: DeviceSyncRow[]; onSelect: (row: DeviceSyncRow) => void }) {
  const tokens = useTokens();

  return (
    <View className="gap-2">
      {rows.map((row) => {
        const outdated = row.downloaded_plan_version != null && row.downloaded_plan_version < row.current_plan_version;
        const conflicts = row.conflict_count + row.needs_review_count;
        return (
          <Pressable
            accessibilityRole="button"
            className="gap-2 rounded-card border border-line bg-surface p-4 active:bg-primary-soft"
            key={row.device_id}
            onPress={() => onSelect(row)}
            onPressIn={() => haptic('heavy')}
          >
            <View className="flex-row items-center justify-between gap-3">
              <View className="min-w-0 flex-1 flex-row items-center gap-2">
                <Text className="flex-1 text-[15px] font-bold text-ink" numberOfLines={1}>
                  {row.label}
                </Text>
                {row.revoked_at ? <Badge tone="neutral">Widerrufen</Badge> : null}
                {!row.expected && !row.revoked_at ? <Badge tone="neutral">Nicht erwartet</Badge> : null}
              </View>
              <Icon color={tokens.subtle} name="chevron-right" size={16} />
            </View>
            <View className="flex-row flex-wrap gap-1.5">
              <Badge tone="neutral">{timeAgo(row.last_seen_at)}</Badge>
              {outdated ? <Badge tone="warning">Plan veraltet</Badge> : null}
              {row.missing_sequences.length > 0 ? (
                <Badge tone="danger">Lücke: {row.missing_sequences.join(', ')}</Badge>
              ) : null}
              {conflicts > 0 ? <Badge tone="warning">{conflicts} zu klären</Badge> : null}
              {row.reconciled_at ? (
                <Badge tone="success">Abschluss bestätigt</Badge>
              ) : row.expected && !row.revoked_at ? (
                <Badge tone="neutral">Kein Abschluss</Badge>
              ) : null}
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}
