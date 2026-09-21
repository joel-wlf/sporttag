import { useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Button } from '@/components/ui/Button';
import { FormSheet } from '@/components/ui/FormSheet';
import type { TeamOption, TeamStatus } from '@/lib/schedule/matrix';

const groups: { status: TeamStatus[]; title: string }[] = [
  { status: ['selected'], title: 'Ausgewählt' },
  { status: ['ok'], title: 'Passend' },
  { status: ['repeatOpponent'], title: 'Schon gegeneinander gespielt' },
  { status: ['repeatGame'], title: 'Spiel schon gespielt' },
  { status: ['blocked'], title: 'Spielt in dieser Runde schon' },
];

const chipTone: Record<TeamStatus, string> = {
  selected: 'border-primary bg-primary-soft',
  ok: 'border-line bg-surface',
  repeatOpponent: 'border-line bg-surface',
  repeatGame: 'border-warning bg-warning-soft',
  blocked: 'border-line bg-surface-muted opacity-50',
};

export function CellTeamPicker({
  visible,
  title,
  maxTeams,
  initialSelection,
  optionsFor,
  isSaving,
  error,
  onSave,
  onClose,
}: {
  visible: boolean;
  title: string;
  maxTeams: number;
  initialSelection: string[];
  optionsFor: (selection: string[]) => TeamOption[];
  isSaving: boolean;
  error: string | null;
  onSave: (teamIds: string[]) => void;
  onClose: () => void;
}) {
  const [selection, setSelection] = useState<string[]>(initialSelection);
  const options = useMemo(() => optionsFor(selection), [optionsFor, selection]);
  const full = selection.length >= maxTeams;

  const toggle = (option: TeamOption) => {
    if (option.status === 'selected') {
      setSelection(selection.filter((id) => id !== option.team.id));
      return;
    }
    if (option.status === 'blocked' || full) return;
    setSelection([...selection, option.team.id]);
  };

  return (
    <FormSheet
      error={error}
      isSubmitting={isSaving}
      onClose={onClose}
      onSubmit={() => onSave(selection)}
      secondaryAction={
        initialSelection.length > 0 ? (
          <Button label="Zelle leeren" onPress={() => onSave([])} variant="outline" />
        ) : undefined
      }
      title={title}
      visible={visible}
    >
      <Text className="text-[13px] text-subtle">
        {selection.length} von {maxTeams} Teams gewählt
      </Text>
      {groups.map((group) => {
        const items = options.filter((o) => group.status.includes(o.status));
        if (items.length === 0) return null;
        return (
          <View className="gap-2" key={group.title}>
            <Text className="text-[12px] font-bold uppercase tracking-[0.4px] text-subtle">{group.title}</Text>
            <View className="flex-row flex-wrap gap-2">
              {items.map((option) => {
                const disabled = option.status === 'blocked' || (full && option.status !== 'selected');
                return (
                  <Pressable
                    accessibilityHint={option.reason}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: option.status === 'selected', disabled }}
                    className={['min-w-[140px] gap-0.5 rounded-xl border px-3 py-2', chipTone[option.status], disabled && option.status !== 'blocked' ? 'opacity-50' : ''].join(' ')}
                    key={option.team.id}
                    onPress={() => toggle(option)}
                  >
                    <View className="flex-row items-center gap-2">
                      <View className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: option.team.color ?? '#A9B58A' }} />
                      <Text className="text-[14px] font-semibold text-ink">{option.team.name}</Text>
                    </View>
                    {option.reason ? <Text className="text-[11px] text-subtle">{option.reason}</Text> : null}
                  </Pressable>
                );
              })}
            </View>
          </View>
        );
      })}
    </FormSheet>
  );
}
