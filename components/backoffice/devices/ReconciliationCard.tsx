import { useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { Icon } from '@/components/ui/Icon';
import { useTokens } from '@/components/ui/theme';
import { friendlyErrorMessage } from '@/lib/api/errors';
import { useConfirmReconciliation, useEventReconciliation } from '@/lib/api/devices';
import type { EventRow } from '@/lib/api/events';

export function ReconciliationCard({ event }: { event: EventRow }) {
  const tokens = useTokens();
  const { data: issues, isLoading } = useEventReconciliation(event.id);
  const confirm = useConfirmReconciliation(event.id);
  const [error, setError] = useState<string | null>(null);

  const handleConfirm = async () => {
    setError(null);
    try {
      await confirm.mutateAsync();
    } catch (err) {
      setError(friendlyErrorMessage(err));
    }
  };

  return (
    <Card className="gap-4">
      <CardHeader>
        <CardTitle>Abschlussabgleich</CardTitle>
        <CardDescription>
          Die Veranstaltung gilt erst als vollständig abgeglichen, wenn alle erwarteten Geräte ihr
          Abschlussmanifest bestätigt haben und keine Konflikte offen sind.
        </CardDescription>
      </CardHeader>

      {isLoading ? (
        <ActivityIndicator color={tokens.primary} />
      ) : event.reconciled_at ? (
        <View className="flex-row items-center gap-2">
          <Icon color={tokens.success} name="check-circle" size={18} />
          <Badge tone="success">Abgeglichen seit {new Date(event.reconciled_at).toLocaleString('de-DE')}</Badge>
        </View>
      ) : issues && issues.length === 0 ? (
        <View className="flex-row items-center gap-2">
          <Icon color={tokens.success} name="check-circle" size={18} />
          <Badge tone="success">Alle Prüfungen bestanden</Badge>
        </View>
      ) : (
        <View className="gap-3">
          {issues?.map((issue) => (
            <View className="flex-row items-center gap-3" key={issue.code}>
              <Icon color={tokens.danger} name="alert" size={16} />
              <Badge tone="danger">{issue.message}</Badge>
            </View>
          ))}
        </View>
      )}

      {!event.reconciled_at ? (
        <Button
          isDisabled={Boolean(issues && issues.length > 0)}
          isLoading={confirm.isPending}
          label="Abgleich abschließen"
          onPress={() => void handleConfirm()}
        />
      ) : null}
      {error ? <Badge tone="danger">{error}</Badge> : null}
    </Card>
  );
}
