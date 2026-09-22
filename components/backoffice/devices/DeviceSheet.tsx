import { useState } from 'react';
import { Text, View } from 'react-native';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { FormSheet } from '@/components/ui/FormSheet';
import { friendlyErrorMessage } from '@/lib/api/errors';
import { useRevokeDeviceAccess } from '@/lib/api/settings';
import { useSetDeviceExpected, type DeviceSyncRow } from '@/lib/api/devices';

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View className="flex-row items-center justify-between gap-3 border-b border-line py-2.5">
      <Text className="text-[13px] text-subtle">{label}</Text>
      <Text className="text-[13px] font-bold text-ink">{value}</Text>
    </View>
  );
}

export function DeviceSheet({
  row,
  eventId,
  onClose,
}: {
  row: DeviceSyncRow | null;
  eventId: string;
  onClose: () => void;
}) {
  const revoke = useRevokeDeviceAccess(eventId);
  const setExpected = useSetDeviceExpected(eventId);
  const [confirmRevoke, setConfirmRevoke] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!row) return null;

  const handleRevoke = async () => {
    setError(null);
    try {
      await revoke.mutateAsync(row.access_id);
      setConfirmRevoke(false);
      onClose();
    } catch (err) {
      setError(friendlyErrorMessage(err));
    }
  };

  const toggleExpected = async () => {
    setError(null);
    try {
      await setExpected.mutateAsync({ deviceId: row.device_id, expected: !row.expected });
    } catch (err) {
      setError(friendlyErrorMessage(err));
    }
  };

  return (
    <>
      <FormSheet error={error} onClose={onClose} title={row.label} visible={Boolean(row)}>
        <View className="gap-0">
          <Row label="Planversion" value={`${row.downloaded_plan_version ?? '–'} von ${row.current_plan_version}`} />
          <Row label="Letzter Kontakt" value={row.last_seen_at ? new Date(row.last_seen_at).toLocaleString('de-DE') : 'nie'} />
          <Row label="Beigetreten" value={new Date(row.granted_at).toLocaleString('de-DE')} />
          <Row label="Gemeldete Sequenz" value={String(row.last_reported_sequence)} />
          <Row label="Empfangene Abgaben" value={String(row.received_count)} />
          <Row label="Fehlende Sequenzen" value={row.missing_sequences.length > 0 ? row.missing_sequences.join(', ') : 'keine'} />
          <Row label="Konflikte / Klärung" value={String(row.conflict_count + row.needs_review_count)} />
          <Row
            label="Abschlussmanifest"
            value={row.reconciled_at ? new Date(row.reconciled_at).toLocaleString('de-DE') : 'noch nicht bestätigt'}
          />
        </View>

        {row.conflict_count + row.needs_review_count > 0 ? (
          <Badge tone="warning">Konflikte und Korrekturvorschläge werden im Live-Modul geprüft.</Badge>
        ) : null}

        <View className="gap-2">
          <Button
            isLoading={setExpected.isPending}
            label={row.expected ? 'Als nicht erwartet markieren' : 'Als erwartet markieren'}
            onPress={() => void toggleExpected()}
            variant="outline"
          />
          {!row.revoked_at ? (
            <Button label="Gerätezugang widerrufen" onPress={() => setConfirmRevoke(true)} variant="outline" />
          ) : null}
        </View>
      </FormSheet>

      <ConfirmDialog
        description="Das Gerät verliert sofort den Zugang zu dieser Veranstaltung."
        isLoading={revoke.isPending}
        onCancel={() => setConfirmRevoke(false)}
        onConfirm={handleRevoke}
        title="Gerätezugang widerrufen?"
        visible={confirmRevoke}
      />
    </>
  );
}
