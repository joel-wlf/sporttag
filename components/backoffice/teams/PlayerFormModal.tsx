import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Choice } from '@/components/ui/Choice';
import { FormSheet } from '@/components/ui/FormSheet';
import { Field } from '@/components/ui/Input';
import { PillChoice } from '@/components/ui/PillChoice';
import { StepSlider } from '@/components/ui/StepSlider';
import { confirmAsync } from '@/lib/confirm';
import { friendlyErrorMessage } from '@/lib/api/errors';
import { type Player, useDeletePlayer, useUpsertPlayer } from '@/lib/api/players';
import type { TeamRow } from '@/lib/api/teams';
import { SKILL_MAX, SKILL_MIN, type Gender } from '@/lib/teams/balance';
import { TeamPicker } from './TeamPicker';

type GenderValue = Gender | 'none';

/**
 * Spieler anlegen oder bearbeiten. Der Elternscreen vergibt einen `key` je
 * Ziel, damit der Formularzustand per Lazy-Initializer entsteht.
 */
export function PlayerFormModal({
  eventId,
  player,
  teams,
  defaultTeamId,
  onClose,
  onSavedAndNext,
}: {
  eventId: string;
  player: Player | 'new' | null;
  teams: TeamRow[];
  defaultTeamId?: string | null;
  onClose: () => void;
  onSavedAndNext: () => void;
}) {
  const existing = player && player !== 'new' ? player : null;
  const upsert = useUpsertPlayer(eventId);
  const remove = useDeletePlayer(eventId);
  const [name, setName] = useState(existing?.name ?? '');
  const [gender, setGender] = useState<GenderValue>(existing?.gender ?? 'none');
  const [skill, setSkill] = useState<number | null>(existing?.skill ?? null);
  const [age, setAge] = useState(existing?.age != null ? String(existing.age) : '');
  const [teamId, setTeamId] = useState<string | null>(existing ? existing.team_id : (defaultTeamId ?? null));
  const [locked, setLocked] = useState(existing?.locked ?? false);
  const [notes, setNotes] = useState(existing?.notes ?? '');
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    setError(null);
    if (!name.trim()) {
      setError('Bitte einen Namen eingeben.');
      return false;
    }
    const ageNumber = age.trim() ? Number(age) : null;
    if (ageNumber != null && (!Number.isInteger(ageNumber) || ageNumber < 1 || ageNumber > 120)) {
      setError('Bitte ein gültiges Alter eingeben.');
      return false;
    }
    try {
      await upsert.mutateAsync({
        id: existing?.id,
        name,
        team_id: teamId,
        locked,
        gender: gender === 'none' ? null : gender,
        skill,
        age: ageNumber,
        notes,
      });
      return true;
    } catch (err) {
      setError(friendlyErrorMessage(err));
      return false;
    }
  };

  const handleSubmit = async () => {
    if (await save()) onClose();
  };

  const handleSaveNext = async () => {
    if (await save()) onSavedAndNext();
  };

  const handleDelete = async () => {
    if (!existing) return;
    if (!(await confirmAsync(`„${existing.name}“ wirklich löschen?`))) return;
    try {
      await remove.mutateAsync(existing.id);
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
        existing ? (
          <Button isLoading={remove.isPending} label="Löschen" onPress={handleDelete} variant="danger" />
        ) : (
          <Button isDisabled={upsert.isPending} label="Speichern & nächster" onPress={handleSaveNext} variant="outline" />
        )
      }
      title={existing ? 'Spieler bearbeiten' : 'Neuer Spieler'}
      visible={player !== null}
    >
      <Field autoFocus={!existing} label="Name" onChangeText={setName} placeholder="Vor- und Nachname" value={name} />
      <PillChoice
        label="Geschlecht"
        onChange={setGender}
        options={[
          { value: 'none', label: '–', accessibilityLabel: 'Keine Angabe' },
          { value: 'f', label: 'w', accessibilityLabel: 'weiblich' },
          { value: 'm', label: 'm', accessibilityLabel: 'männlich' },
          { value: 'd', label: 'd', accessibilityLabel: 'divers' },
        ]}
        value={gender}
      />
      <StepSlider
        emptyLabel="Nicht bewertet"
        label="Stärke"
        max={SKILL_MAX}
        maxLabel="6 · sehr stark"
        min={SKILL_MIN}
        minLabel="1 · schwach"
        onChange={setSkill}
        onClear={() => setSkill(null)}
        value={skill}
      />
      <Field keyboardType="number-pad" label="Alter (optional)" onChangeText={setAge} value={age} />
      <TeamPicker label="Team" onChange={setTeamId} teams={teams} value={teamId} />
      <Choice
        description="Die automatische Verteilung verschiebt diesen Spieler nicht."
        label="Im Team fixieren"
        onPress={() => setLocked((v) => !v)}
        selected={locked}
      />
      <Field label="Notiz (optional)" multiline onChangeText={setNotes} value={notes} />
    </FormSheet>
  );
}
