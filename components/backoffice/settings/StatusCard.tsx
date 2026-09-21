import { useState } from 'react';
import { useRouter } from 'expo-router';
import { View } from 'react-native';
import { Badge, type BadgeTone } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { friendlyErrorMessage } from '@/lib/api/errors';
import { type EventRow, type EventStatus, useEventReadiness, usePublishEvent, useSetEventStatus } from '@/lib/api/events';
import { useActiveEvent } from '@/providers/ActiveEventProvider';

const statusLabels: Record<EventStatus, string> = {
  draft: 'Entwurf',
  published: 'Veröffentlicht',
  running: 'Laufend',
  finished: 'Beendet',
  archived: 'Archiviert',
};

const statusTones: Record<EventStatus, BadgeTone> = {
  draft: 'neutral',
  published: 'primary',
  running: 'success',
  finished: 'secondary',
  archived: 'neutral',
};

const nextStatuses: Record<EventStatus, EventStatus[]> = {
  draft: ['archived'],
  published: ['running', 'draft', 'archived'],
  running: ['finished', 'archived'],
  finished: ['archived'],
  archived: [],
};

const actionLabels: Record<EventStatus, string> = {
  draft: 'Zurück in Entwurf',
  published: 'Veröffentlichen',
  running: 'Als laufend markieren',
  finished: 'Als beendet markieren',
  archived: 'Archivieren',
};

export function StatusCard({ event }: { event: EventRow }) {
  const router = useRouter();
  const { setActiveEventId } = useActiveEvent();
  const { data: readiness } = useEventReadiness(event.id);
  const setStatus = useSetEventStatus(event.id);
  const publish = usePublishEvent(event.id);
  const [pendingStatus, setPendingStatus] = useState<EventStatus | null>(null);
  const [error, setError] = useState<string | null>(null);

  const errors = readiness?.filter((issue) => issue.severity === 'error') ?? [];
  const status = event.status as EventStatus;

  const confirmAction = async () => {
    if (!pendingStatus) return;
    setError(null);
    try {
      if (pendingStatus === 'published') {
        await publish.mutateAsync();
      } else {
        await setStatus.mutateAsync(pendingStatus);
      }
      if (pendingStatus === 'archived') {
        setActiveEventId(null);
        router.replace('/');
      }
      setPendingStatus(null);
    } catch (err) {
      setError(friendlyErrorMessage(err));
    }
  };

  return (
    <Card className="gap-4">
      <CardHeader>
        <View className="flex-row items-center gap-3">
          <CardTitle>Status</CardTitle>
          <Badge tone={statusTones[status]}>{statusLabels[status]}</Badge>
        </View>
        <CardDescription>Lebenszyklus der Veranstaltung.</CardDescription>
      </CardHeader>

      {status === 'draft' && errors.length > 0 ? (
        <View className="gap-2">
          {errors.map((issue) => (
            <Badge className="self-start" key={issue.code} tone="danger">
              {issue.message}
            </Badge>
          ))}
        </View>
      ) : null}

      <View className="flex-row flex-wrap gap-3">
        {status === 'draft' ? (
          <Button
            isDisabled={errors.length > 0}
            label="Veröffentlichen"
            onPress={() => setPendingStatus('published')}
          />
        ) : null}
        {nextStatuses[status].map((next) => (
          <Button
            key={next}
            label={actionLabels[next]}
            onPress={() => setPendingStatus(next)}
            variant={next === 'archived' ? 'danger' : 'outline'}
          />
        ))}
      </View>

      <ConfirmDialog
        confirmLabel={pendingStatus ? actionLabels[pendingStatus] : 'Bestätigen'}
        confirmVariant={pendingStatus === 'archived' ? 'danger' : 'primary'}
        description={
          pendingStatus === 'published'
            ? 'Die Veröffentlichung fixiert ergebnisrelevante Regeln und erhöht die Planversion.'
            : pendingStatus === 'archived'
              ? 'Eine archivierte Veranstaltung kann nicht mehr bearbeitet werden.'
              : undefined
        }
        isLoading={setStatus.isPending || publish.isPending}
        onCancel={() => {
          setPendingStatus(null);
          setError(null);
        }}
        onConfirm={confirmAction}
        title={pendingStatus ? `${actionLabels[pendingStatus]}?` : ''}
        visible={pendingStatus !== null}
      />
      {error ? <Badge tone="danger">{error}</Badge> : null}
    </Card>
  );
}
