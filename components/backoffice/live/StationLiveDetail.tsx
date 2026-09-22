import { useState } from 'react';
import { Text, View } from 'react-native';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Field } from '@/components/ui/Input';
import { Icon, type IconName } from '@/components/ui/Icon';
import { useTokens } from '@/components/ui/theme';
import { friendlyErrorMessage } from '@/lib/api/errors';
import { useSetMatchStatus, type MatchStatus } from '@/lib/api/live';
import { liveStatusLabel, matchStatusLabel, statusReason, type StationLive } from '@/lib/live/derive';
import { statusColor } from './liveStatusColor';

function formatTime(iso: string | null) {
  if (!iso) return null;
  return new Date(iso).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
}

type ActionKey = 'cancel' | 'reschedule' | 'start' | 'finish';

const actions: Record<ActionKey, { status: MatchStatus; label: string; title: string; description: string; icon: IconName }> = {
  start: {
    status: 'in_progress',
    label: 'Als gestartet markieren',
    title: 'Match als gestartet markieren?',
    description: 'Nutze das, wenn das Match läuft, das Gerät an der Station den Start aber nicht meldet.',
    icon: 'play',
  },
  finish: {
    status: 'completed',
    label: 'Als beendet markieren',
    title: 'Match als beendet markieren?',
    description: 'Setzt nur den Status. Das Ergebnis selbst wird über das Modul Ergebnisse erfasst oder korrigiert.',
    icon: 'check-circle',
  },
  cancel: {
    status: 'cancelled',
    label: 'Match absagen',
    title: 'Match absagen?',
    description: 'Das Match fällt aus und zählt nicht zur Wertung. Das lässt sich später mit „Wieder einplanen“ rückgängig machen.',
    icon: 'close',
  },
  reschedule: {
    status: 'scheduled',
    label: 'Wieder einplanen',
    title: 'Match wieder einplanen?',
    description: 'Das Match kommt zurück in den Zeitplan und kann an der Station wieder gestartet werden.',
    icon: 'undo',
  },
};

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View className="gap-2">
      <Text className="text-[11px] font-black tracking-[0.8px] text-subtle">{title.toUpperCase()}</Text>
      {children}
    </View>
  );
}

function InfoLine({ icon, children }: { icon: IconName; children: React.ReactNode }) {
  const tokens = useTokens();
  return (
    <View className="flex-row items-start gap-2">
      <View className="pt-0.5">
        <Icon color={tokens.subtle} name={icon} size={15} />
      </View>
      <Text className="flex-1 text-[13px] leading-5 text-ink">{children}</Text>
    </View>
  );
}

export function StationLiveDetail({
  eventId,
  row,
  now,
  staffNames,
  onBack,
  onClose,
  onOpenResults,
}: {
  eventId: string;
  row: StationLive;
  now: Date;
  staffNames: Record<string, string>;
  onBack?: () => void;
  onClose?: () => void;
  onOpenResults?: () => void;
}) {
  const tokens = useTokens();
  const setStatus = useSetMatchStatus(eventId);
  const [pending, setPending] = useState<ActionKey | null>(null);
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);

  const match = row.match;
  const color = statusColor(tokens, row.status);
  const statusText = statusReason(row, now);

  const open = (key: ActionKey) => {
    setPending(key);
    setReason('');
    setError(null);
  };

  const confirm = async () => {
    if (!pending || !match) return;
    if (!reason.trim()) {
      setError('Bitte kurz begründen – das wird am Match protokolliert.');
      return;
    }
    try {
      await setStatus.mutateAsync({ matchId: match.id, status: actions[pending].status, reason: reason.trim(), notes: match.notes });
      setPending(null);
    } catch (err) {
      setError(friendlyErrorMessage(err));
    }
  };

  const available: ActionKey[] = !match
    ? []
    : match.status === 'cancelled' || match.status === 'completed'
      ? ['reschedule']
      : match.status === 'in_progress'
        ? ['finish', 'cancel']
        : ['start', 'cancel'];

  const checkedInNames = row.checkins.flatMap((c) => c.checkin_staff.map((s) => staffNames[s.staff_id] ?? 'Unbekannt'));
  const firstCheckin = row.checkins[0]?.checked_in_at ?? null;

  return (
    <View className="gap-4">
      {onBack ? (
        <View className="flex-row">
          <Button label="Alle Stationen" leftIcon="arrow-left" onPress={onBack} size="sm" variant="ghost" />
        </View>
      ) : null}

      {/* Kopf: Station + Status in Klartext */}
      <View className="gap-3 rounded-[22px] p-4" style={{ backgroundColor: color + '1F' }}>
        <View className="flex-row items-start justify-between gap-3">
          <View className="flex-1 gap-1">
            <Text className="text-[22px] font-extrabold tracking-[-0.4px] text-ink">{row.station.name}</Text>
            {row.station.location ? <Text className="text-[13px] text-subtle">{row.station.location}</Text> : null}
          </View>
          {onClose ? <Button accessibilityLabel="Schließen" leftIcon="close" onPress={onClose} size="sm" variant="ghost" /> : null}
        </View>
        <View className="flex-row items-center gap-2">
          <View className="h-3 w-3 rounded-full" style={{ backgroundColor: color }} />
          <Text className="text-[14px] font-extrabold" style={{ color }}>
            {liveStatusLabel[row.status]}
          </Text>
        </View>
        {statusText ? <Text className="text-[13px] leading-5 text-ink">{statusText}</Text> : null}
        {row.openSubmissions.length > 0 && onOpenResults ? (
          <Button label="Zu klärende Abgabe ansehen" onPress={onOpenResults} rightIcon="chevron-right" size="sm" variant="danger" />
        ) : null}
      </View>

      {/* Aktuelles Match */}
      <Card className="gap-4">
        <Section title={row.game?.name ? `Spiel · ${row.game.name}` : 'Spiel'}>
          {!row.setup ? (
            <Text className="text-[13px] text-subtle">In diesem Block ist hier kein Spiel eingeplant.</Text>
          ) : !match ? (
            <Text className="text-[13px] text-subtle">In dieser Runde ist hier kein Match.</Text>
          ) : (
            <View className="gap-3">
              <View className="flex-row items-center gap-3">
                <View className="flex-1 gap-1.5">
                  {row.teams.length === 0 ? (
                    <Text className="text-[13px] text-subtle">Keine Teams eingetragen</Text>
                  ) : (
                    row.teams.map((team) => (
                      <View className="flex-row items-center gap-2" key={team.id}>
                        <View className="h-3 w-3 rounded-full border border-line" style={{ backgroundColor: team.color ?? tokens.surfaceMuted }} />
                        <Text className="flex-1 text-[15px] font-bold text-ink" numberOfLines={1}>
                          {team.name}
                        </Text>
                      </View>
                    ))
                  )}
                </View>
                <View className="items-center rounded-2xl px-4 py-2" style={{ backgroundColor: row.scoreLabel ? tokens.accent : tokens.surfaceMuted }}>
                  <Text className="text-[24px] font-black text-ink">{row.scoreLabel ?? '–'}</Text>
                  <Text className="text-[10px] font-bold text-ink">{row.scoreLabel ? 'Stand' : 'kein Ergebnis'}</Text>
                </View>
              </View>
              <InfoLine icon="flag">
                Status: {matchStatusLabel[match.status] ?? match.status}
                {match.actual_started_at ? ` · gestartet ${formatTime(match.actual_started_at)}` : ''}
                {match.actual_ended_at ? ` · beendet ${formatTime(match.actual_ended_at)}` : ''}
              </InfoLine>
            </View>
          )}
        </Section>

        <Section title="Betreuung vor Ort">
          {checkedInNames.length > 0 ? (
            <InfoLine icon="users">
              {checkedInNames.join(', ')}
              {firstCheckin ? ` · eingecheckt ${formatTime(firstCheckin)}` : ''}
            </InfoLine>
          ) : row.checkins.length > 0 ? (
            <InfoLine icon="users">Gerät eingecheckt, keine Namen angegeben</InfoLine>
          ) : (
            <InfoLine icon="alert">Niemand eingecheckt</InfoLine>
          )}
          <InfoLine icon={row.device ? 'devices' : 'wifi-off'}>
            {row.device
              ? `${row.device.label} · zuletzt gemeldet ${formatTime(row.device.last_seen_at) ?? 'nie'}`
              : 'Kein Gerät an dieser Station'}
          </InfoLine>
          {row.station.arrival_notes ? <InfoLine icon="map-pin">{row.station.arrival_notes}</InfoLine> : null}
        </Section>
      </Card>

      {/* Eingreifen */}
      {available.length > 0 ? (
        <Card className="gap-3">
          <Section title="Eingreifen">
            <Text className="text-[13px] leading-5 text-subtle">
              Wenn an der Station etwas nicht klappt, kannst du den Match-Status hier von Hand setzen. Jeder Eingriff wird mit Begründung protokolliert.
            </Text>
          </Section>
          <View className="gap-2">
            {available.map((key, index) => (
              <Button
                fullWidth
                key={key}
                label={actions[key].label}
                leftIcon={actions[key].icon}
                onPress={() => open(key)}
                variant={key === 'cancel' ? 'outline' : index === 0 ? 'primary' : 'outline'}
              />
            ))}
          </View>
        </Card>
      ) : null}

      <ConfirmDialog
        confirmLabel={pending ? actions[pending].label : 'Bestätigen'}
        confirmVariant={pending === 'cancel' ? 'danger' : 'primary'}
        description={pending ? actions[pending].description : undefined}
        isLoading={setStatus.isPending}
        onCancel={() => setPending(null)}
        onConfirm={confirm}
        title={pending ? actions[pending].title : ''}
        visible={pending !== null}
      >
        <Field
          autoFocus
          label="Begründung"
          onChangeText={setReason}
          onSubmitEditing={confirm}
          placeholder="z. B. Gewitter, Gerät ausgefallen, Team fehlt …"
          value={reason}
        />
        {error ? <Text className="text-[13px] font-semibold text-danger">{error}</Text> : null}
      </ConfirmDialog>
    </View>
  );
}
