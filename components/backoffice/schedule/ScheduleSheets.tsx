import { useState } from 'react';
import { Text, View } from 'react-native';
import { Button } from '@/components/ui/Button';
import { Choice } from '@/components/ui/Choice';
import { FormSheet } from '@/components/ui/FormSheet';
import { Field } from '@/components/ui/Input';
import type { MatrixGame } from '@/lib/schedule/matrix';

export function GamePickerSheet({
  visible,
  title,
  games,
  currentGameId,
  usedElsewhere,
  error,
  onSelect,
  onClose,
}: {
  visible: boolean;
  title: string;
  games: MatrixGame[];
  currentGameId: string | null;
  /** Spiele, die diese Station in anderen Blöcken schon hat. */
  usedElsewhere: Set<string>;
  error: string | null;
  onSelect: (gameId: string | null) => void;
  onClose: () => void;
}) {
  return (
    <FormSheet error={error} onClose={onClose} title={title} visible={visible}>
      {games.length === 0 ? (
        <Text className="text-[14px] text-subtle">Lege zuerst unter „Spiele & Wertung“ Spiele an.</Text>
      ) : (
        <View className="gap-2">
          {games.map((game) => (
            <Choice
              description={[
                `${game.min_teams}–${game.max_teams} Teams`,
                usedElsewhere.has(game.id) ? 'An dieser Station schon in einem anderen Block' : null,
              ]
                .filter(Boolean)
                .join(' · ')}
              key={game.id}
              label={game.name}
              onPress={() => onSelect(game.id)}
              selected={game.id === currentGameId}
            />
          ))}
          {currentGameId ? <Button label="Spiel entfernen" onPress={() => onSelect(null)} variant="outline" /> : null}
        </View>
      )}
    </FormSheet>
  );
}

export function RowSheet({
  visible,
  title,
  kind,
  durationMinutes,
  defaultMinutes,
  hasMatches,
  error,
  isBusy,
  onSaveDuration,
  onInsert,
  onDelete,
  onClose,
}: {
  visible: boolean;
  title: string;
  kind: 'play' | 'break';
  durationMinutes: number | null;
  defaultMinutes: number;
  hasMatches: boolean;
  error: string | null;
  isBusy: boolean;
  onSaveDuration: (minutes: number | null) => void;
  onInsert: (where: 'above' | 'below', kind: 'play' | 'break') => void;
  onDelete: () => void;
  onClose: () => void;
}) {
  const [minutes, setMinutes] = useState(durationMinutes ? String(durationMinutes) : '');
  const [confirmDelete, setConfirmDelete] = useState(false);

  const save = () => {
    const trimmed = minutes.trim();
    if (!trimmed) return onSaveDuration(null);
    const value = Number(trimmed);
    if (Number.isInteger(value) && value > 0 && value <= 600) onSaveDuration(value);
  };

  return (
    <FormSheet error={error} isSubmitting={isBusy} onClose={onClose} onSubmit={save} submitLabel="Dauer speichern" title={title} visible={visible}>
      <Field
        hint={`Leer lassen für den Standard (${defaultMinutes} min). Alle folgenden Zeiten verschieben sich.`}
        keyboardType="number-pad"
        label="Dauer in Minuten"
        onChangeText={setMinutes}
        placeholder={String(defaultMinutes)}
        value={minutes}
      />
      <View className="gap-2">
        <Text className="text-[13px] font-bold text-ink">Zeilen einfügen</Text>
        <View className="flex-row flex-wrap gap-2">
          <Button label="Runde darüber" leftIcon="plus" onPress={() => onInsert('above', 'play')} size="sm" variant="outline" />
          <Button label="Runde darunter" leftIcon="plus" onPress={() => onInsert('below', 'play')} size="sm" variant="outline" />
          <Button label="Pause darunter" leftIcon="pause" onPress={() => onInsert('below', 'break')} size="sm" variant="outline" />
        </View>
      </View>
      <View className="gap-2">
        {confirmDelete ? (
          <>
            <Text className="text-[13px] text-danger">
              {hasMatches ? 'Diese Runde hat eingetragene Teams. Sie werden mit gelöscht.' : 'Zeile wirklich löschen?'}
            </Text>
            <View className="flex-row gap-2">
              <Button isLoading={isBusy} label="Ja, löschen" onPress={onDelete} size="sm" variant="danger" />
              <Button label="Abbrechen" onPress={() => setConfirmDelete(false)} size="sm" variant="ghost" />
            </View>
          </>
        ) : (
          <Button label={kind === 'break' ? 'Pause löschen' : 'Runde löschen'} onPress={() => setConfirmDelete(true)} size="sm" variant="ghost" />
        )}
      </View>
    </FormSheet>
  );
}
