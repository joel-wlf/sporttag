import { useState } from 'react';
import { Text, View } from 'react-native';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { EmptyState } from '@/components/ui/EmptyState';
import { friendlyErrorMessage } from '@/lib/api/errors';
import { useEventDevices, useRevokeDeviceAccess } from '@/lib/api/settings';

export function DevicesCard({ eventId }: { eventId: string }) {
  const { data: accesses } = useEventDevices(eventId);
  const revoke = useRevokeDeviceAccess(eventId);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const active = accesses?.filter((a) => !a.revoked_at) ?? [];

  const handleRevoke = async () => {
    if (!pendingId) return;
    setError(null);
    try {
      await revoke.mutateAsync(pendingId);
      setPendingId(null);
    } catch (err) {
      setError(friendlyErrorMessage(err));
    }
  };

  return (
    <Card className="gap-4">
      <CardHeader>
        <CardTitle>Gerätezugang</CardTitle>
        <CardDescription>Geräte mit gültigem Zugang zu dieser Veranstaltung, unabhängig vom Code.</CardDescription>
      </CardHeader>

      {active.length === 0 ? (
        <EmptyState description="Noch kein Gerät ist mit dem Veranstaltungscode beigetreten." icon="devices" title="Keine Geräte" />
      ) : (
        <View className="gap-3">
          {active.map((access) => (
            <View className="flex-row items-center justify-between gap-3" key={access.id}>
              <View className="min-w-0 flex-1 gap-0.5">
                <Text className="text-[14px] font-bold text-ink">{access.devices?.label ?? 'Unbenanntes Gerät'}</Text>
                <Text className="text-[12px] text-subtle">
                  Beigetreten {new Date(access.granted_at).toLocaleString('de-DE')}
                </Text>
              </View>
              <Button label="Widerrufen" onPress={() => setPendingId(access.id)} size="sm" variant="outline" />
            </View>
          ))}
        </View>
      )}
      {error ? <Badge tone="danger">{error}</Badge> : null}

      <ConfirmDialog
        description="Das Gerät verliert sofort den Zugang zu dieser Veranstaltung."
        isLoading={revoke.isPending}
        onCancel={() => setPendingId(null)}
        onConfirm={handleRevoke}
        title="Gerätezugang widerrufen?"
        visible={pendingId !== null}
      />
    </Card>
  );
}
