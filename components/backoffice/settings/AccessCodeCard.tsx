import { useState } from 'react';
import { Text, View } from 'react-native';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { friendlyErrorMessage } from '@/lib/api/errors';
import { useActiveAccessCode, useRevokeAccessCode, useRotateAccessCode } from '@/lib/api/settings';

export function AccessCodeCard({ eventId }: { eventId: string }) {
  const { data: activeCode, isLoading } = useActiveAccessCode(eventId);
  const rotate = useRotateAccessCode(eventId);
  const revoke = useRevokeAccessCode(eventId);
  const [revealedCode, setRevealedCode] = useState<string | null>(null);
  const [confirmRotate, setConfirmRotate] = useState(false);
  const [confirmRevoke, setConfirmRevoke] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleRotate = async () => {
    setError(null);
    try {
      const code = await rotate.mutateAsync(undefined);
      setRevealedCode(code);
      setConfirmRotate(false);
    } catch (err) {
      setError(friendlyErrorMessage(err));
    }
  };

  const handleRevoke = async () => {
    setError(null);
    try {
      await revoke.mutateAsync();
      setRevealedCode(null);
      setConfirmRevoke(false);
    } catch (err) {
      setError(friendlyErrorMessage(err));
    }
  };

  return (
    <Card className="gap-4">
      <CardHeader>
        <CardTitle>Veranstaltungscode</CardTitle>
        <CardDescription>
          Stationsgeräte treten mit diesem sechsstelligen Code bei. Ein neuer Code widerruft den bisherigen.
        </CardDescription>
      </CardHeader>

      {revealedCode ? (
        <View className="gap-2 rounded-2xl border border-primary bg-primary-soft px-4 py-4">
          <Text className="text-[11px] font-extrabold tracking-[0.7px] text-primary">
            NEUER CODE – JETZT NOTIEREN, WIRD NICHT ERNEUT ANGEZEIGT
          </Text>
          <Text className="text-[32px] font-black tracking-[4px] text-ink">{revealedCode}</Text>
        </View>
      ) : isLoading ? null : activeCode ? (
        <View className="flex-row items-center gap-3">
          <Badge tone="primary">Aktiver Code hinterlegt</Badge>
          <Text className="text-[12px] text-subtle">
            Gültig bis {new Date(activeCode.valid_until).toLocaleString('de-DE')}
          </Text>
        </View>
      ) : (
        <Badge tone="neutral">Kein aktiver Code</Badge>
      )}

      <View className="flex-row flex-wrap gap-3">
        <Button label={activeCode ? 'Code rotieren' : 'Code erzeugen'} onPress={() => setConfirmRotate(true)} />
        {activeCode ? (
          <Button label="Code widerrufen" onPress={() => setConfirmRevoke(true)} variant="outline" />
        ) : null}
      </View>
      {error ? <Badge tone="danger">{error}</Badge> : null}

      <ConfirmDialog
        confirmLabel="Neuen Code erzeugen"
        description="Ein bestehender aktiver Code wird sofort ungültig. Neue Beitritte benötigen den neuen Code."
        isLoading={rotate.isPending}
        onCancel={() => setConfirmRotate(false)}
        onConfirm={handleRotate}
        title="Veranstaltungscode rotieren?"
        visible={confirmRotate}
      />
      <ConfirmDialog
        description="Neue Stationsgeräte können sich damit nicht mehr anmelden. Bestehender Gerätezugang bleibt bestehen."
        isLoading={revoke.isPending}
        onCancel={() => setConfirmRevoke(false)}
        onConfirm={handleRevoke}
        title="Code widerrufen?"
        visible={confirmRevoke}
      />
    </Card>
  );
}
