import { useState } from 'react';
import { Text, View } from 'react-native';
import { Badge, type BadgeTone } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Field } from '@/components/ui/Input';
import { FormSheet } from '@/components/ui/FormSheet';
import { Icon } from '@/components/ui/Icon';
import { useTokens } from '@/components/ui/theme';
import { friendlyErrorMessage } from '@/lib/api/errors';
import {
  useDismissSubmissions,
  useRecordResult,
  useWithdrawResult,
  type ResultRevisionRow,
  type ResultSubmissionRow,
} from '@/lib/api/results';
import {
  describeCurrentValues,
  diffSubmission,
  parsePayload,
  resultStatusLabel,
  type ResultRow,
} from '@/lib/results/derive';
import { ResultCorrectionSheet } from './ResultCorrectionSheet';
import { resultBadgeTone } from './resultStatusBadge';

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString('de-DE');
}

const submissionStatusLabel: Record<string, string> = {
  accepted: 'Angenommen',
  conflict: 'Konflikt',
  needs_review: 'Klärung nötig',
  resolved: 'Geklärt',
};

const submissionBadgeTone: Record<string, BadgeTone> = {
  accepted: 'success',
  conflict: 'danger',
  needs_review: 'warning',
  resolved: 'neutral',
};

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View className="gap-2">
      <Text className="text-[11px] font-black tracking-[0.8px] text-subtle">
        {title.toUpperCase()}
      </Text>
      {children}
    </View>
  );
}

type PendingAction = { type: 'accept' | 'dismiss'; submission: ResultSubmissionRow };

export function ResultDetailSheet({
  eventId,
  row,
  submissions,
  revisions,
  planVersion,
  onClose,
}: {
  eventId: string;
  row: ResultRow | null;
  submissions: ResultSubmissionRow[];
  revisions: ResultRevisionRow[];
  /** Aktuelle Planversion der Veranstaltung, um veraltete Abgaben zu erklären. */
  planVersion?: number;
  onClose: () => void;
}) {
  const tokens = useTokens();
  const record = useRecordResult(eventId);
  const dismiss = useDismissSubmissions(eventId);
  const withdraw = useWithdrawResult(eventId);
  const [pending, setPending] = useState<PendingAction | null>(null);
  // Bleibt beim Schließen stehen: sonst sprang der ausblendende Dialog nach
  // einem Übernehmen kurz auf "Abgabe verwerfen?".
  const [dialogType, setDialogType] = useState<PendingAction['type']>('accept');
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [withdrawOpen, setWithdrawOpen] = useState(false);
  const [withdrawReason, setWithdrawReason] = useState('');
  const [withdrawError, setWithdrawError] = useState<string | null>(null);
  const [correcting, setCorrecting] = useState(false);

  if (!row) return null;
  const { match } = row;
  // Ob ein Ergebnis zählt, entscheidet der aktuelle Stand, nicht die
  // Versionsnummer: Nach dem Zurückziehen ist die Version > 0, aber leer.
  const hasResult = row.currentValues.length > 0;
  const withdrawn = !hasResult && match.current_result_version > 0;
  const matchSubmissions = submissions.filter((s) => s.match_id === match.id);
  const matchRevisions = revisions.filter((r) => r.match_id === match.id);
  const openSubmissions = matchSubmissions.filter(
    (s) => s.status === 'conflict' || s.status === 'needs_review',
  );

  const confirmWithdraw = async () => {
    if (!withdrawReason.trim()) {
      setWithdrawError('Bitte eine Begründung angeben.');
      return;
    }
    try {
      await withdraw.mutateAsync({ matchId: match.id, reason: withdrawReason.trim() });
      setWithdrawOpen(false);
      setWithdrawReason('');
    } catch (err) {
      setWithdrawError(friendlyErrorMessage(err));
    }
  };

  const open = (type: PendingAction['type'], submission: ResultSubmissionRow) => {
    setPending({ type, submission });
    setDialogType(type);
    setReason('');
    setError(null);
  };

  const confirm = async () => {
    if (!pending) return;
    if (!reason.trim()) {
      setError('Bitte eine Begründung angeben.');
      return;
    }
    try {
      if (pending.type === 'accept') {
        await record.mutateAsync({
          matchId: match.id,
          baseResultVersion: match.current_result_version,
          payload: parsePayload(pending.submission.payload),
          reason: reason.trim(),
          resolves: [pending.submission.request_id],
        });
      } else {
        await dismiss.mutateAsync({
          requestIds: [pending.submission.request_id],
          reason: reason.trim(),
        });
      }
      setError(null);
      setPending(null);
    } catch (err) {
      setError(friendlyErrorMessage(err));
    }
  };

  return (
    <>
      <FormSheet
        cancelLabel={null}
        onClose={onClose}
        onSubmit={() => setCorrecting(true)}
        secondaryAction={
          hasResult ? (
            <Button
              label="Zurückziehen"
              leftIcon="undo"
              onPress={() => {
                setWithdrawReason('');
                setWithdrawError(null);
                setWithdrawOpen(true);
              }}
              variant="outline"
            />
          ) : undefined
        }
        submitLabel={hasResult ? 'Korrigieren' : withdrawn ? 'Neu eintragen' : 'Eintragen'}
        title={row.participants.map((p) => p.team?.name ?? '–').join(' – ') || 'Match'}
        visible={Boolean(row)}
      >
        <View className="gap-5">
          <View className="flex-row flex-wrap items-center gap-2">
            <Badge tone={resultBadgeTone[row.status]}>{resultStatusLabel[row.status]}</Badge>
            <Text className="text-[13px] text-subtle">
              {[row.station?.name, row.game?.name].filter(Boolean).join(' · ')}
            </Text>
          </View>

          <Section title="Aktuelles Ergebnis">
            <Card className="gap-1" variant="muted">
              <Text className="text-[15px] font-bold text-ink">
                {hasResult
                  ? describeCurrentValues(row)
                  : withdrawn
                    ? 'Zurückgezogen – zählt nicht in der Tabelle'
                    : 'Noch kein Ergebnis'}
              </Text>
              {match.current_result_version > 0 ? (
                <Text className="text-[12px] text-subtle">
                  Version {match.current_result_version}
                  {row.currentValues[0]?.recorded_at
                    ? ` · ${formatDateTime(row.currentValues[0].recorded_at)}`
                    : ''}
                </Text>
              ) : null}
            </Card>
          </Section>

          {openSubmissions.length > 0 ? (
            <Section title="Offene Abgaben">
              <View className="gap-3">
                {openSubmissions.map((submission) => {
                  const diff = diffSubmission(
                    row.currentValues,
                    parsePayload(submission.payload).values,
                    row.participants,
                    row.game,
                  );
                  return (
                    <Card className="gap-3" key={submission.request_id}>
                      <View className="flex-row items-center justify-between">
                        <Badge tone={submissionBadgeTone[submission.status] ?? 'neutral'}>
                          {submissionStatusLabel[submission.status] ?? submission.status}
                        </Badge>
                        <Text className="text-[12px] text-subtle">
                          {submission.devices?.label ?? 'Organisator'} ·{' '}
                          {formatDateTime(submission.received_at)}
                        </Text>
                      </View>
                      {/* Ein Konflikt mit älterem Planstand heißt: Station oder Teams
                          dieses Matches wurden danach geändert (docs/datenkonzept.md 8.11)
                          – das hier sagen statt nur „Konflikt“. */}
                      {submission.status === 'conflict' &&
                      planVersion !== undefined &&
                      submission.plan_version < planVersion ? (
                        <Text className="text-[12px] leading-4 text-subtle">
                          Erfasst mit Planversion {submission.plan_version}, inzwischen {planVersion}: Station oder
                          Teams dieses Matches wurden danach geändert, deshalb wird die Abgabe nicht automatisch
                          gewertet.
                        </Text>
                      ) : null}
                      <View className="gap-1.5">
                        {diff.map((d) => (
                          <View className="flex-row items-center gap-2" key={d.participantId}>
                            <Text className="flex-1 text-[13px] text-ink" numberOfLines={1}>
                              {d.teamName}
                            </Text>
                            <Text className="text-[13px] text-subtle">{d.currentText}</Text>
                            <Icon color={tokens.subtle} name="chevron-right" size={14} />
                            <Text
                              className={[
                                'text-[13px] font-bold',
                                d.changed ? 'text-danger' : 'text-ink',
                              ].join(' ')}
                            >
                              {d.submittedText}
                            </Text>
                          </View>
                        ))}
                      </View>
                      <View className="flex-row gap-2">
                        <Button
                          label="Übernehmen"
                          onPress={() => open('accept', submission)}
                          size="sm"
                        />
                        <Button
                          label="Verwerfen"
                          onPress={() => open('dismiss', submission)}
                          size="sm"
                          variant="outline"
                        />
                      </View>
                    </Card>
                  );
                })}
              </View>
            </Section>
          ) : null}

          <Section title="Revisionshistorie">
            {matchRevisions.length === 0 ? (
              <Text className="text-[13px] text-subtle">Noch keine Revision.</Text>
            ) : (
              <View className="gap-2">
                {matchRevisions.map((revision) => (
                  <View className="gap-0.5 border-b border-line pb-2" key={revision.id}>
                    <Text className="text-[13px] font-bold text-ink">
                      Version {revision.version} ·{' '}
                      {revision.recorded_by ? 'Organisator' : 'Station'}
                      {revision.result_values.length === 0 ? ' · zurückgezogen' : ''} ·{' '}
                      {formatDateTime(revision.recorded_at)}
                    </Text>
                    {revision.reason ? (
                      <Text className="text-[12px] text-subtle">{revision.reason}</Text>
                    ) : null}
                  </View>
                ))}
              </View>
            )}
          </Section>

          <Section title="Abgabejournal">
            {matchSubmissions.length === 0 ? (
              <Text className="text-[13px] text-subtle">Noch keine Abgabe.</Text>
            ) : (
              <View className="gap-2">
                {matchSubmissions.map((submission) => (
                  <View
                    className="flex-row items-center justify-between border-b border-line pb-2"
                    key={submission.request_id}
                  >
                    <View className="flex-1 gap-0.5">
                      <Text className="text-[13px] text-ink">
                        {submission.devices?.label ?? 'Organisator'}
                      </Text>
                      <Text className="text-[12px] text-subtle">
                        {formatDateTime(submission.received_at)}
                      </Text>
                    </View>
                    {/* Ein Rückzug ist technisch eine angenommene, leere Abgabe –
                        angezeigt wird, was er bewirkt hat. */}
                    {parsePayload(submission.payload).values.length === 0 ? (
                      <Badge tone="neutral">Zurückgezogen</Badge>
                    ) : (
                      <Badge tone={submissionBadgeTone[submission.status] ?? 'neutral'}>
                        {submissionStatusLabel[submission.status] ?? submission.status}
                      </Badge>
                    )}
                  </View>
                ))}
              </View>
            )}
          </Section>
        </View>

        {/* Bestätigungen und Korrektur liegen im Sheet: ein zweites Modal
            neben einem offenen pageSheet erscheint auf iOS nicht. */}
        <ConfirmDialog
          confirmLabel={dialogType === 'accept' ? 'Übernehmen' : 'Verwerfen'}
          confirmVariant={dialogType === 'accept' ? 'primary' : 'danger'}
          description={
            dialogType === 'accept'
              ? 'Die Abgabe wird als neue Version übernommen und in die Tabelle aufgenommen.'
              : 'Die Abgabe wird als geklärt markiert, ohne das Ergebnis zu ändern.'
          }
          isLoading={record.isPending || dismiss.isPending}
          onCancel={() => setPending(null)}
          onConfirm={() => void confirm()}
          title={dialogType === 'accept' ? 'Abgabe übernehmen?' : 'Abgabe verwerfen?'}
          visible={pending !== null}
        >
          <Field
            autoFocus
            label="Begründung"
            onChangeText={setReason}
            onSubmitEditing={() => void confirm()}
            placeholder="z. B. mit Video abgeglichen, identisch mit Stand"
            value={reason}
          />
          {error ? <Text className="text-[13px] font-semibold text-danger">{error}</Text> : null}
        </ConfirmDialog>

        <ConfirmDialog
          confirmLabel="Zurückziehen"
          confirmVariant="danger"
          description="Das Match ist danach wieder offen und zählt nicht mehr in der Tabelle. Alle bisherigen Versionen und Abgaben bleiben in der Historie. Stationsgeräte sehen das Match nach dem nächsten Sync wieder als offen."
          isLoading={withdraw.isPending}
          onCancel={() => setWithdrawOpen(false)}
          onConfirm={() => void confirmWithdraw()}
          title="Ergebnis zurückziehen?"
          visible={withdrawOpen}
        >
          <Field
            autoFocus
            label="Begründung"
            onChangeText={setWithdrawReason}
            onSubmitEditing={() => void confirmWithdraw()}
            placeholder="z. B. falsches Match, Ergebnis doppelt erfasst"
            value={withdrawReason}
          />
          {withdrawError ? (
            <Text className="text-[13px] font-semibold text-danger">{withdrawError}</Text>
          ) : null}
        </ConfirmDialog>

        <ResultCorrectionSheet
          eventId={eventId}
          onClose={() => setCorrecting(false)}
          row={correcting ? row : null}
        />
      </FormSheet>
    </>
  );
}
