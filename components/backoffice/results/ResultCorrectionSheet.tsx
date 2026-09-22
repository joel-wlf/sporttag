import { useState } from 'react';
import { View } from 'react-native';
import { Choice } from '@/components/ui/Choice';
import { Field } from '@/components/ui/Input';
import { FormSheet } from '@/components/ui/FormSheet';
import { friendlyErrorMessage } from '@/lib/api/errors';
import { useRecordResult } from '@/lib/api/results';
import type { ResultRow } from '@/lib/results/derive';
import { buildNumberPayload, buildOutcomePayload } from '@/lib/station/scoring';
import type { PackageGame, PackageMatch, ResultPayload } from '@/lib/station/types';

/**
 * Organisatorkorrektur mit Pflichtbegründung (docs/datenkonzept.md
 * Abschnitt 5, 8.2). Nutzt dieselbe Ableitungslogik wie die Stationsapp
 * (lib/station/scoring.ts), damit Zahlwerte konsistent zu Plätzen werden.
 * Bei mehr als zwei Teams trägt der Organisator die Platzierung direkt ein,
 * statt über die Stations-Kurzwahl "Nur Gewinner"/"Top 3" zu gehen.
 */
export function ResultCorrectionSheet({
  eventId,
  row,
  onClose,
}: {
  eventId: string;
  row: ResultRow | null;
  onClose: () => void;
}) {
  const record = useRecordResult(eventId);
  const [values, setValues] = useState<Record<string, string>>({});
  const [placements, setPlacements] = useState<Record<string, string>>({});
  const [outcome, setOutcome] = useState<'home' | 'draw' | 'away' | null>(null);
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);

  // Neu befüllen, wenn ein anderes (oder gar kein) Match ausgewählt wird —
  // während des Renderns statt in einem Effekt angepasst (React-Muster für
  // "State an eine geänderte Prop anpassen"), kein zusätzlicher Renderdurchlauf.
  const [seenMatchId, setSeenMatchId] = useState<string | null>(row?.match.id ?? null);
  if ((row?.match.id ?? null) !== seenMatchId) {
    setSeenMatchId(row?.match.id ?? null);
    const seedValues: Record<string, string> = {};
    const seedPlacements: Record<string, string> = {};
    row?.participants.forEach((p) => {
      const current = row.currentValues.find((v) => v.participant_id === p.participantId);
      if (current?.measured_value !== null && current?.measured_value !== undefined) {
        seedValues[p.participantId] = String(current.measured_value);
      }
      if (current?.placement !== null && current?.placement !== undefined) {
        seedPlacements[p.participantId] = String(current.placement);
      }
    });
    setValues(seedValues);
    setPlacements(seedPlacements);
    setOutcome(null);
    setReason('');
    setError(null);
  }

  if (!row) return null;
  const { match, game, participants } = row;
  const isMultiTeam = participants.length > 2;
  const isNumber = game?.measurement_type === 'number';
  const isCorrection = match.current_result_version > 0;
  const packageMatch = {
    participants: participants.map((p) => ({ id: p.participantId, team_id: p.team?.id ?? '', slot: p.slot })),
  } as unknown as PackageMatch;

  const canSubmit = isNumber ? true : isMultiTeam ? participants.every((p) => placements[p.participantId]?.trim()) : outcome !== null;

  const submit = async () => {
    // Eine Korrektur eines bestehenden Ergebnisses braucht eine Begründung;
    // eine erstmalige manuelle Eingabe nicht.
    if (isCorrection && !reason.trim()) {
      setError('Bitte eine Begründung angeben.');
      return;
    }
    if (!canSubmit) return;
    setError(null);
    try {
      const payload: ResultPayload = isNumber
        ? buildNumberPayload(
            packageMatch,
            game as unknown as PackageGame,
            Object.fromEntries(participants.map((p) => [p.participantId, Number(values[p.participantId] ?? 0)])),
          )
        : isMultiTeam
          ? { values: participants.map((p) => ({ participant_id: p.participantId, placement: Number(placements[p.participantId] ?? 0) })) }
          : buildOutcomePayload(packageMatch, outcome ?? 'home');
      await record.mutateAsync({
        matchId: match.id,
        baseResultVersion: match.current_result_version,
        payload,
        reason: reason.trim(),
        resolves: row.openSubmissions.map((s) => s.request_id),
      });
      onClose();
    } catch (err) {
      setError(friendlyErrorMessage(err));
    }
  };

  const outcomeOptions: { key: 'home' | 'draw' | 'away'; label: string }[] = [
    { key: 'home', label: participants[0]?.team?.name ?? 'Team 1' },
    ...(game?.allow_ties ? ([{ key: 'draw', label: 'Unentschieden' }] as const) : []),
    { key: 'away', label: participants[1]?.team?.name ?? 'Team 2' },
  ];

  return (
    <FormSheet
      error={error}
      isSubmitting={record.isPending}
      onClose={onClose}
      onSubmit={() => void submit()}
      submitLabel={isCorrection ? 'Korrektur speichern' : 'Ergebnis speichern'}
      title={isCorrection ? 'Ergebnis korrigieren' : 'Ergebnis manuell eintragen'}
      visible={Boolean(row)}
    >
      <View className="gap-3">
        {isNumber ? (
          participants.map((p) => (
            <Field
              key={p.participantId}
              keyboardType="decimal-pad"
              label={`${p.team?.name ?? 'Unbekannt'}${game?.unit ? ` (${game.unit})` : ''}`}
              onChangeText={(v) => setValues((prev) => ({ ...prev, [p.participantId]: v }))}
              value={values[p.participantId] ?? ''}
            />
          ))
        ) : isMultiTeam ? (
          participants.map((p) => (
            <Field
              key={p.participantId}
              keyboardType="number-pad"
              label={p.team?.name ?? 'Unbekannt'}
              onChangeText={(v) => setPlacements((prev) => ({ ...prev, [p.participantId]: v }))}
              placeholder="Platzierung"
              value={placements[p.participantId] ?? ''}
            />
          ))
        ) : (
          <View className="gap-2">
            {outcomeOptions.map((option) => (
              <Choice key={option.key} label={option.label} onPress={() => setOutcome(option.key)} selected={outcome === option.key} />
            ))}
          </View>
        )}
      </View>
      <Field
        label={isCorrection ? 'Begründung' : 'Begründung (optional)'}
        onChangeText={setReason}
        placeholder={isCorrection ? 'Warum wird das Ergebnis korrigiert?' : 'z. B. manuell nachgetragen'}
        value={reason}
      />
    </FormSheet>
  );
}
