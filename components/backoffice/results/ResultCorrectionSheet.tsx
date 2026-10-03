import { useState } from 'react';
import { Text, View } from 'react-native';
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
  const hasResult = row.currentValues.length > 0;
  // Der Server verlangt eine Begründung, sobald es schon eine Revision gibt –
  // auch nach einem Zurückziehen (leere Revision) – und sobald offene
  // Abgaben mit aufgelöst werden. Nur die allererste Eingabe ohne offene
  // Konflikte kommt ohne aus (sonst lehnte der Server mit reason_required ab,
  // obwohl das Feld als optional angezeigt wurde).
  const hasRevision = match.current_result_version > 0;
  const needsReason = hasRevision || row.openSubmissions.length > 0;
  const mode: 'first' | 'correct' | 'reenter' = hasResult
    ? 'correct'
    : hasRevision
      ? 'reenter'
      : 'first';
  const packageMatch = {
    participants: participants.map((p) => ({
      id: p.participantId,
      team_id: p.team?.id ?? '',
      slot: p.slot,
    })),
  } as unknown as PackageMatch;

  // Deutsches Dezimalkomma zulassen; ein leeres Feld ist fehlend, nicht 0.
  const parseNumber = (text: string | undefined) => {
    const trimmed = (text ?? '').trim().replace(',', '.');
    if (!trimmed) return null;
    const value = Number(trimmed);
    return Number.isFinite(value) ? value : null;
  };

  const validate = (): string | null => {
    if (isNumber) {
      if (participants.some((p) => parseNumber(values[p.participantId]) === null)) {
        return 'Bitte für jedes Team eine Zahl eintragen.';
      }
    } else if (isMultiTeam) {
      const places = participants.map((p) => Number((placements[p.participantId] ?? '').trim()));
      if (
        places.some((place) => !Number.isInteger(place) || place < 1 || place > participants.length)
      ) {
        return `Bitte für jedes Team einen Platz von 1 bis ${participants.length} eintragen.`;
      }
    } else if (outcome === null) {
      return 'Bitte den Ausgang wählen.';
    }
    if (needsReason && !reason.trim()) return 'Bitte eine Begründung angeben.';
    return null;
  };

  const submit = async () => {
    const problem = validate();
    if (problem) {
      setError(problem);
      return;
    }
    setError(null);
    try {
      const payload: ResultPayload = isNumber
        ? buildNumberPayload(
            packageMatch,
            game as unknown as PackageGame,
            Object.fromEntries(
              participants.map((p) => [
                p.participantId,
                parseNumber(values[p.participantId]) as number,
              ]),
            ),
          )
        : isMultiTeam
          ? {
              values: participants.map((p) => ({
                participant_id: p.participantId,
                placement: Number(placements[p.participantId]),
              })),
            }
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
      submitLabel={mode === 'correct' ? 'Korrektur speichern' : 'Ergebnis speichern'}
      title={
        mode === 'correct'
          ? 'Ergebnis korrigieren'
          : mode === 'reenter'
            ? 'Ergebnis neu eintragen'
            : 'Ergebnis eintragen'
      }
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
          <View accessibilityRole="radiogroup" className="gap-2">
            <Text className="text-[13px] font-bold text-ink">Wer hat gewonnen?</Text>
            {outcomeOptions.map((option) => (
              <Choice
                key={option.key}
                label={option.label}
                onPress={() => setOutcome(option.key)}
                selected={outcome === option.key}
              />
            ))}
          </View>
        )}
      </View>
      <Field
        label={needsReason ? 'Begründung' : 'Begründung (optional)'}
        onChangeText={setReason}
        placeholder={
          mode === 'correct'
            ? 'Warum wird das Ergebnis korrigiert?'
            : mode === 'reenter'
              ? 'Warum wird neu eingetragen?'
              : 'z. B. Gerät an der Station ausgefallen'
        }
        value={reason}
      />
    </FormSheet>
  );
}
