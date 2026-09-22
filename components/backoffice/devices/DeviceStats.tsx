import { View } from 'react-native';
import { StatCard } from '@/components/ui/StatCard';
import type { DeviceSyncRow } from '@/lib/api/devices';

export function DeviceStats({ rows }: { rows: DeviceSyncRow[] }) {
  const active = rows.filter((r) => !r.revoked_at);
  const expected = active.filter((r) => r.expected);
  const reconciled = expected.filter((r) => r.reconciled_at);
  const gaps = active.reduce((sum, r) => sum + r.missing_sequences.length, 0);
  const conflicts = active.reduce((sum, r) => sum + r.conflict_count + r.needs_review_count, 0);
  const outdated = active.filter((r) => r.downloaded_plan_version != null && r.downloaded_plan_version < r.current_plan_version).length;

  return (
    <View className="flex-row flex-wrap gap-3">
      <StatCard icon="devices" label="Erwartete Geräte" value={String(expected.length)} />
      <StatCard
        hint={expected.length > 0 ? `${reconciled.length} von ${expected.length}` : undefined}
        icon="check-circle"
        label="Abschluss bestätigt"
        value={String(reconciled.length)}
      />
      <StatCard hint={gaps > 0 ? 'Sequenzlücken' : undefined} icon="alert" label="Lücken" value={String(gaps)} />
      <StatCard hint={outdated > 0 ? 'Veralteter Plan' : undefined} icon="refresh" label="Konflikte" value={String(conflicts)} />
    </View>
  );
}
