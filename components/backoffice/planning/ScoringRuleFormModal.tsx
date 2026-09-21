import { useState } from 'react';
import { Text, View } from 'react-native';
import { Button } from '@/components/ui/Button';
import { Field } from '@/components/ui/Input';
import { FormSheet } from '@/components/ui/FormSheet';
import { SegmentedChoice } from '@/components/ui/SegmentedChoice';
import { friendlyErrorMessage } from '@/lib/api/errors';
import type { Json } from '@/lib/database.types';
import {
  type ScoringMode,
  type ScoringRuleRow,
  useDeleteScoringRule,
  useUpsertScoringRule,
} from '@/lib/api/games';

const modeOptions: { value: ScoringMode; label: string; description: string }[] = [
  { value: 'win_draw_loss', label: 'Sieg / Unentschieden / Niederlage', description: 'Für Zweiermatches.' },
  { value: 'placement', label: 'Platzierung', description: 'Punkte je Platz, z. B. für Mehrteamspiele.' },
];

type PlacePoint = { place: string; points: string };

/**
 * Leitet den Startzustand aus der zu bearbeitenden Regel ab. Der
 * Elternscreen rendert diese Komponente mit einem `key` je Regel, damit
 * React beim Wechsel neu mountet statt den Zustand per Effekt zu syncen.
 */
function initialStateFor(rule: ScoringRuleRow | 'new' | null) {
  if (!rule || rule === 'new') {
    return {
      name: '',
      mode: 'win_draw_loss' as ScoringMode,
      win: '3',
      draw: '1',
      loss: '0',
      places: [{ place: '1', points: '3' }] as PlacePoint[],
      unlistedPoints: '0',
    };
  }
  const config = rule.config as Record<string, unknown>;
  const byPlace = (config.points_by_place as Record<string, number>) ?? { '1': 3 };
  return {
    name: rule.name,
    mode: rule.mode as ScoringMode,
    win: String(config.win ?? 3),
    draw: String(config.draw ?? 1),
    loss: String(config.loss ?? 0),
    places: Object.entries(byPlace).map(([place, points]) => ({ place, points: String(points) })),
    unlistedPoints: String(config.unlisted_points ?? 0),
  };
}

export function ScoringRuleFormModal({
  eventId,
  rule,
  onClose,
}: {
  eventId: string;
  rule: ScoringRuleRow | 'new' | null;
  onClose: () => void;
}) {
  const upsert = useUpsertScoringRule(eventId);
  const remove = useDeleteScoringRule(eventId);
  const initial = initialStateFor(rule);
  const [name, setName] = useState(initial.name);
  const [mode, setMode] = useState<ScoringMode>(initial.mode);
  const [win, setWin] = useState(initial.win);
  const [draw, setDraw] = useState(initial.draw);
  const [loss, setLoss] = useState(initial.loss);
  const [places, setPlaces] = useState<PlacePoint[]>(initial.places);
  const [unlistedPoints, setUnlistedPoints] = useState(initial.unlistedPoints);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    setError(null);
    if (!name.trim()) {
      setError('Bitte einen Namen eingeben.');
      return;
    }
    let config: Record<string, unknown>;
    if (mode === 'win_draw_loss') {
      config = { win: Number(win) || 0, draw: Number(draw) || 0, loss: Number(loss) || 0 };
    } else {
      const pointsByPlace: Record<string, number> = {};
      for (const p of places) {
        if (p.place.trim()) pointsByPlace[p.place.trim()] = Number(p.points) || 0;
      }
      config = { points_by_place: pointsByPlace, unlisted_points: Number(unlistedPoints) || 0, tie_policy: 'same_place' };
    }
    try {
      await upsert.mutateAsync({
        id: rule && rule !== 'new' ? rule.id : undefined,
        name: name.trim(),
        mode,
        config: config as Json,
      });
      onClose();
    } catch (err) {
      setError(friendlyErrorMessage(err));
    }
  };

  const handleDelete = async () => {
    if (!rule || rule === 'new') return;
    setError(null);
    try {
      await remove.mutateAsync(rule.id);
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
        rule && rule !== 'new' ? <Button isLoading={remove.isPending} label="Löschen" onPress={handleDelete} variant="danger" /> : undefined
      }
      title={rule === 'new' ? 'Neue Wertungsregel' : 'Wertungsregel bearbeiten'}
      visible={rule !== null}
    >
      <Field label="Name" onChangeText={setName} placeholder="Standard" value={name} />
      <SegmentedChoice label="Modus" onChange={setMode} options={modeOptions} value={mode} />

      {mode === 'win_draw_loss' ? (
        <View className="flex-row gap-3">
          <View className="flex-1">
            <Field keyboardType="number-pad" label="Sieg" onChangeText={setWin} value={win} />
          </View>
          <View className="flex-1">
            <Field keyboardType="number-pad" label="Unentschieden" onChangeText={setDraw} value={draw} />
          </View>
          <View className="flex-1">
            <Field keyboardType="number-pad" label="Niederlage" onChangeText={setLoss} value={loss} />
          </View>
        </View>
      ) : (
        <View className="gap-3">
          <Text className="text-[13px] font-bold text-ink">Punkte je Platz</Text>
          {places.map((p, index) => (
            <View className="flex-row items-end gap-3" key={index}>
              <View className="flex-1">
                <Field
                  keyboardType="number-pad"
                  label="Platz"
                  onChangeText={(v) => setPlaces((prev) => prev.map((row, i) => (i === index ? { ...row, place: v } : row)))}
                  value={p.place}
                />
              </View>
              <View className="flex-1">
                <Field
                  keyboardType="number-pad"
                  label="Punkte"
                  onChangeText={(v) => setPlaces((prev) => prev.map((row, i) => (i === index ? { ...row, points: v } : row)))}
                  value={p.points}
                />
              </View>
              <Button
                label="Entfernen"
                onPress={() => setPlaces((prev) => prev.filter((_, i) => i !== index))}
                size="sm"
                variant="outline"
              />
            </View>
          ))}
          <Button
            label="Platz hinzufügen"
            onPress={() => setPlaces((prev) => [...prev, { place: String(prev.length + 1), points: '0' }])}
            size="sm"
            variant="outline"
          />
          <Field keyboardType="number-pad" label="Punkte für übrige Plätze" onChangeText={setUnlistedPoints} value={unlistedPoints} />
        </View>
      )}
    </FormSheet>
  );
}
