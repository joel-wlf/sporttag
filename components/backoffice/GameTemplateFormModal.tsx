import { useState } from 'react';
import { View } from 'react-native';
import { Button } from '@/components/ui/Button';
import { Choice } from '@/components/ui/Choice';
import { Field } from '@/components/ui/Input';
import { FormSheet } from '@/components/ui/FormSheet';
import { SegmentedChoice } from '@/components/ui/SegmentedChoice';
import { friendlyErrorMessage } from '@/lib/api/errors';
import { type GameTemplateRow, useDeleteGameTemplate, useUpsertGameTemplate } from '@/lib/api/templates';

export function GameTemplateFormModal({ template, onClose }: { template: GameTemplateRow | 'new' | null; onClose: () => void }) {
  const upsert = useUpsertGameTemplate();
  const remove = useDeleteGameTemplate();
  const existing = template && template !== 'new' ? template : null;
  const [name, setName] = useState(existing?.name ?? '');
  const [description, setDescription] = useState(existing?.description ?? '');
  const [rules, setRules] = useState(existing?.rules ?? '');
  const [materials, setMaterials] = useState(existing?.materials ?? '');
  const [measurementType, setMeasurementType] = useState<'outcome' | 'number'>(
    (existing?.measurement_type as 'outcome' | 'number') ?? 'outcome',
  );
  const [comparisonDirection, setComparisonDirection] = useState<'higher' | 'lower'>(
    (existing?.comparison_direction as 'higher' | 'lower') ?? 'higher',
  );
  const [minTeams, setMinTeams] = useState(existing ? String(existing.min_teams) : '2');
  const [maxTeams, setMaxTeams] = useState(existing ? String(existing.max_teams) : '2');
  const [allowTies, setAllowTies] = useState(existing?.allow_ties ?? true);
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
        id: template && template !== 'new' ? template.id : undefined,
        name: name.trim(),
        description: description.trim(),
        rules: rules.trim(),
        materials: materials.trim(),
        measurement_type: measurementType,
        comparison_direction: comparisonDirection,
        min_teams: min,
        max_teams: max,
        allow_ties: allowTies,
      });
      onClose();
    } catch (err) {
      setError(friendlyErrorMessage(err));
    }
  };

  const handleDelete = async () => {
    if (!template || template === 'new') return;
    setError(null);
    try {
      await remove.mutateAsync(template.id);
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
        template && template !== 'new' ? <Button isLoading={remove.isPending} label="Löschen" onPress={handleDelete} variant="danger" /> : undefined
      }
      title={template === 'new' ? 'Neue Spielvorlage' : 'Spielvorlage bearbeiten'}
      visible={template !== null}
    >
      <Field label="Name" onChangeText={setName} placeholder="Fähnchen klauen" value={name} />
      <Field label="Beschreibung" multiline numberOfLines={2} onChangeText={setDescription} value={description} />
      <Field label="Regeln" multiline numberOfLines={3} onChangeText={setRules} value={rules} />
      <Field label="Material" multiline numberOfLines={2} onChangeText={setMaterials} value={materials} />
      <SegmentedChoice
        label="Messung"
        onChange={setMeasurementType}
        options={[
          { value: 'outcome', label: 'Ausgang (Sieg/Niederlage/Platz)' },
          { value: 'number', label: 'Zahlwert' },
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
      <Choice description="Gleichstand ist bei diesem Spiel erlaubt." label="Unentschieden zulassen" onPress={() => setAllowTies((v) => !v)} selected={allowTies} />
    </FormSheet>
  );
}
