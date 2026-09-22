import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { RequireEvent } from '@/components/backoffice/RequireEvent';
import { Header } from '@/components/layout/Header';
import { Screen } from '@/components/layout/Screen';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Icon } from '@/components/ui/Icon';
import { useTokens } from '@/components/ui/theme';
import { friendlyErrorMessage } from '@/lib/api/errors';
import { useEventReadiness, usePublishEvent } from '@/lib/api/events';
import { useActiveEvent } from '@/providers/ActiveEventProvider';

function PublishContent() {
  const { eventId, event } = useActiveEvent();
  const tokens = useTokens();
  const router = useRouter();
  const { data: readiness, isLoading } = useEventReadiness(eventId);
  const publish = usePublishEvent(eventId as string);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [publishedCode, setPublishedCode] = useState<string | null>(null);

  const errors = readiness?.filter((issue) => issue.severity === 'error') ?? [];
  const warnings = readiness?.filter((issue) => issue.severity === 'warning') ?? [];
  const alreadyPublished = event?.status !== 'draft';

  const handlePublish = async () => {
    setError(null);
    try {
      const result = await publish.mutateAsync();
      setPublishedCode(result.accessCode);
      setConfirmOpen(false);
    } catch (err) {
      setError(friendlyErrorMessage(err));
    }
  };

  return (
    <Screen>
      <Header
        description="Eigenständiges Freigabe-Gate. Die Veröffentlichung fixiert ergebnisrelevante Regeln, erhöht die Planversion."
        eyebrow="VERANSTALTUNG"
        title="Freigabe & Veröffentlichung"
      />

      {publishedCode ? (
        <Card className="gap-4">
          <CardHeader>
            <CardTitle>Veröffentlicht</CardTitle>
            <CardDescription>
              Stationsgeräte treten mit diesem Code bei. Er wird nur jetzt angezeigt.
            </CardDescription>
          </CardHeader>
          <View className="gap-2 rounded-2xl border border-primary bg-primary-soft px-4 py-4">
            <Text className="text-[11px] font-extrabold tracking-[0.7px] text-primary">
              VERANSTALTUNGSCODE – JETZT NOTIEREN, WIRD NICHT ERNEUT ANGEZEIGT
            </Text>
            <Text className="text-[32px] font-black tracking-[4px] text-ink">{publishedCode}</Text>
          </View>
          <Button className="self-start" label="Weiter zur Übersicht" onPress={() => router.push('/more/overview')} />
        </Card>
      ) : alreadyPublished ? (
        <Card>
          <CardHeader>
            <CardTitle>Bereits veröffentlicht</CardTitle>
            <CardDescription>Diese Veranstaltung ist nicht mehr im Entwurfsstatus.</CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <Card className="gap-4">
          <CardHeader>
            <CardTitle>Bereitschaftsprüfung</CardTitle>
            <CardDescription>Alle Blocker müssen behoben sein, bevor veröffentlicht werden kann.</CardDescription>
          </CardHeader>

          {isLoading ? (
            <ActivityIndicator color={tokens.primary} />
          ) : errors.length === 0 && warnings.length === 0 ? (
            <View className="flex-row items-center gap-2">
              <Icon color={tokens.success} name="check-circle" size={18} />
              <Badge tone="success">Alle Prüfungen bestanden</Badge>
            </View>
          ) : (
            <View className="gap-3">
              {errors.map((issue) => (
                <View className="flex-row items-center gap-3" key={issue.code}>
                  <Icon color={tokens.danger} name="alert" size={16} />
                  <Badge tone="danger">{issue.message}</Badge>
                </View>
              ))}
              {warnings.map((issue) => (
                <View className="flex-row items-center gap-3" key={issue.code}>
                  <Icon color={tokens.warning} name="alert" size={16} />
                  <Badge tone="warning">{issue.message}</Badge>
                </View>
              ))}
            </View>
          )}

          <Button isDisabled={errors.length > 0} label="Jetzt veröffentlichen" onPress={() => setConfirmOpen(true)} />
          {error ? <Badge tone="danger">{error}</Badge> : null}
        </Card>
      )}

      <ConfirmDialog
        confirmLabel="Veröffentlichen"
        description="Ergebnisrelevante Regeln werden fixiert und die Planversion erhöht. Danach sind zentrale Einstellungen gesperrt."
        isLoading={publish.isPending}
        onCancel={() => setConfirmOpen(false)}
        onConfirm={handlePublish}
        title="Veranstaltung jetzt veröffentlichen?"
        visible={confirmOpen}
      />
    </Screen>
  );
}

export default function PublishScreen() {
  return (
    <RequireEvent>
      <PublishContent />
    </RequireEvent>
  );
}
