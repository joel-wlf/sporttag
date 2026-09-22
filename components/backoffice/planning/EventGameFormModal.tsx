import { useState } from 'react';
import { View } from 'react-native';
import { Button } from '@/components/ui/Button';
import { Choice } from '@/components/ui/Choice';
import { Field } from '@/components/ui/Input';
import { FormSheet } from '@/components/ui/FormSheet';
import { SegmentedChoice } from '@/components/ui/SegmentedChoice';
import { friendlyErrorMessage } from '@/lib/api/errors';
import { type EventGameRow, type ScoringRuleRow, useDeleteEventGame, useUpsertEventGame } from '@/lib/api/games';

export function EventGameFormModal({
  eventId,
  game,
  scoringRules,
  onClose,
}: {
  eventId: string;
  game: EventGameRow | 'new' | null;
  scoringRules: ScoringRuleRow[];
  onClose: () => void;
}) {
  const upsert = useUpsertEventGame(eventId);
  const remove = useDeleteEventGame(eventId);
  const existing = game && game !== 'new' ? game : null;
  const [name, setName] = useState(existing?.name ?? '');
  const [measurementType, setMeasurementType] = useState<'outcome' | 'number'>(
    (existing?.measurement_type as 'outcome' | 'number') ?? 'outcome',
  );
  const [comparisonDirection, setComparisonDirection] = useState<'higher' | 'lower'>(
    (existing?.comparison_direction as 'higher' | 'lower') ?? 'higher',
  );
  const [minTeams, setMinTeams] = useState(existing ? String(existing.min_teams) : '2');
  const [maxTeams, setMaxTeams] = useState(existing ? String(existing.max_teams) : '2');
  const [allowTies, setAllowTies] = useState(existing?.allow_ties ?? true);
  const [scoringRuleId, setScoringRuleId] = useState<string | null>(existing?.scoring_rule_id ?? null);
  const [rules, setRules] = useState(existing?.rules ?? '');
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    setError(null);
    if (!name.trim()) {
      setError('Bitte einen Namen eingeben.');
      return;
    }
    const min = Number(minTeams);
    const max = Number(maxTeams);
    if (!Number.isInteger(min) || min < 1 || !Number.isInteger(max) || max < min) {
      setError('Teamzahl ist ungültig: 1 ≤ min ≤ max.');
      return;
    }
    try {
      await upsert.mutateAsync({
        id: game && game !== 'new' ? game.id : undefined,
        name: name.trim(),
        measurement_type: measurementType,
        comparison_direction: comparisonDirection,
        min_teams: min,
        max_teams: max,
        allow_ties: allowTies,
        scoring_rule_id: scoringRuleId,
        rules: rules.trim(),
      });
      onClose();
    } catch (err) {
      setError(friendlyErrorMessage(err));
    }
  };

  const handleDelete = async () => {
    if (!game || game === 'new') return;
    setError(null);
    try {
      await remove.mutateAsync(game.id);
      onClose();
    } catch (err) {
      setError(friendlyErrorMessage(err));
    }
  };

  return (
    <FormSheet
      error={error}
      isSubmitting={upsert.isPending}
      onClose={onClose}
      onSubmit={handleSubmit}
      secondaryAction={
        game && game !== 'new' ? (
          <Button isLoading={remove.isPending} label="Löschen" onPress={handleDelete} variant="danger" />
        ) : undefined
      }
      title={game === 'new' ? 'Neues Spiel' : 'Spiel bearbeiten'}
      visible={game !== null}
    >
      <Field label="Name" onChangeText={setName} placeholder="Fähnchen klauen" value={name} />
      <Field label="Regeln" multiline numberOfLines={3} onChangeText={setRules} value={rules} />

      <SegmentedChoice
        label="Messung"
        onChange={setMeasurementType}
        options={[
          { value: 'outcome', label: 'Ausgang (Sieg/Niederlage/Platz)' },
          { value: 'number', label: 'Zahlwert (z. B. Meter, Treffer)' },
        ]}
        value={measurementType}
      />
      <SegmentedChoice
        label="Vergleichsrichtung"
        onChange={setComparisonDirection}
        options={[
          { value: 'higher', label: 'Höher ist besser' },
          { value: 'lower', label: 'Niedriger ist besser' },
        ]}
        value={comparisonDirection}
      />
      <View className="flex-row gap-3">
        <View className="flex-1">
          <Field keyboardType="number-pad" label="Min. Teams" onChangeText={setMinTeams} value={minTeams} />
        </View>
        <View className="flex-1">
          <Field keyboardType="number-pad" label="Max. Teams" onChangeText={setMaxTeams} value={maxTeams} />
        </View>
      </View>
      <Choice
        description="Gleichstand ist bei diesem Spiel erlaubt."
        label="Unentschieden zulassen"
        onPress={() => setAllowTies((v) => !v)}
        selected={allowTies}
      />
      <View className="gap-2">
        <Choice
          description="Verwendet die Standard-Wertungsregel der Veranstaltung."
          label="Standardregel verwenden"
          onPress={() => setScoringRuleId(null)}
          selected={scoringRuleId === null}
        />
        {scoringRules.map((rule) => (
          <Choice
            key={rule.id}
            label={rule.name}
            onPress={() => setScoringRuleId(rule.id)}
            selected={scoringRuleId === rule.id}
          />
        ))}
      </View>
    </FormSheet>
  );
}
