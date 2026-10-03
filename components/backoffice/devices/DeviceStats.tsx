import { View } from 'react-native';
import { StatCard } from '@/components/ui/StatCard';
import type { DeviceSyncRow } from '@/lib/api/devices';

export function DeviceStats({ rows }: { rows: DeviceSyncRow[] }) {
  // Je Gerät eine Zeile (die Übersicht liefert je Zugang eine; aktive zuerst).
  // Widerrufene Geräte zählen weiter als erwartet, bis sie ausdrücklich als
  // nicht erwartet markiert sind: sie können noch nicht übertragene
  // Ergebnisse haben (datenkonzept.md 11.5).
  const devices = rows.filter((r, i) => rows.findIndex((o) => o.device_id === r.device_id) === i);
  const active = devices.filter((r) => !r.revoked_at);
  const expected = devices.filter((r) => r.expected);
  const reconciled = expected.filter((r) => r.reconciled_at);
  const gaps = devices.reduce((sum, r) => sum + r.missing_sequences.length, 0);
  const conflicts = devices.reduce((sum, r) => sum + r.conflict_count + r.needs_review_count, 0);
  const outdated = active.filter(
    (r) => r.downloaded_plan_version != null && r.downloaded_plan_version < r.current_plan_version,
  ).length;

  return (
    <View className="flex-row flex-wrap gap-3">
      <StatCard icon="devices" label="Erwartete Geräte" value={String(expected.length)} />
      <StatCard
        hint={expected.length > 0 ? `${reconciled.length} von ${expected.length}` : undefined}
        icon="check-circle"
        label="Abschluss bestätigt"
        value={String(reconciled.length)}
      />
      <StatCard
        hint={gaps > 0 ? 'Sequenzlücken' : undefined}
        icon="alert"
        label="Lücken"
        value={String(gaps)}
      />
      <StatCard
        hint={conflicts > 0 ? 'unter Ergebnisse klären' : undefined}
        icon="alert"
        label="Klärung nötig"
        value={String(conflicts)}
      />
      {/* Eigene Kennzahl statt als Hinweis unter „Konflikte“ versteckt. */}
      <StatCard
        hint={outdated > 0 ? 'lädt beim nächsten Sync' : 'alle aktuell'}
        icon="refresh"
        label="Alter Plan"
        value={String(outdated)}
      />
    </View>
  );
}
