import { Pressable, ScrollView, Text, View } from 'react-native';
import { useTokens } from '@/components/ui/theme';
import { resultStatusLabel, resultStatusOrder, type ResultRow, type ResultStatus } from '@/lib/results/derive';

export type ResultFilterState = {
  status: ResultStatus | 'all';
  stationId: string | 'all';
  teamId: string | 'all';
  roundId: string | 'all';
};

const statusChips: { key: ResultStatus | 'all'; label: string }[] = [
  { key: 'all', label: 'Alle' },
  ...resultStatusOrder.map((s) => ({ key: s, label: resultStatusLabel[s] })),
];

function StatusChips({ rows, value, onChange }: { rows: ResultRow[]; value: ResultStatus | 'all'; onChange: (next: ResultStatus | 'all') => void }) {
  const tokens = useTokens();
  const count = (key: ResultStatus | 'all') => (key === 'all' ? rows.length : rows.filter((r) => r.status === key).length);

  return (
    <View className="flex-row flex-wrap gap-2">
      {statusChips.map((chip) => {
        const n = count(chip.key);
        if (chip.key !== 'all' && n === 0) return null;
        const active = value === chip.key;
        const alarm = (chip.key === 'conflict' || chip.key === 'needs_review') && n > 0;
        return (
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            className={[
              'flex-row items-center gap-2 rounded-full border px-3.5 py-2',
              active ? 'border-primary bg-primary' : alarm ? 'border-danger bg-danger-soft' : 'border-line bg-surface',
            ].join(' ')}
            key={chip.key}
            onPress={() => onChange(chip.key)}
          >
            <Text className={['text-[13px] font-bold', active ? 'text-on-primary' : alarm ? 'text-danger' : 'text-ink'].join(' ')}>{chip.label}</Text>
            <View className="min-w-[22px] items-center rounded-full px-1.5 py-0.5" style={{ backgroundColor: active ? tokens.onPrimary : alarm ? tokens.danger : tokens.surfaceMuted }}>
              <Text className="text-[12px] font-black" style={{ color: active ? tokens.primary : alarm ? tokens.onPrimary : tokens.text }}>
                {n}
              </Text>
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

function PickerChips({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: { id: string; name: string }[];
  value: string | 'all';
  onChange: (next: string | 'all') => void;
}) {
  if (options.length === 0) return null;
  return (
    <View className="gap-1.5">
      <Text className="text-[11px] font-bold uppercase tracking-[0.4px] text-subtle">{label}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View className="flex-row gap-2 pr-2">
          {[{ id: 'all', name: 'Alle' }, ...options].map((option) => {
            const active = value === option.id;
            return (
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                className={['rounded-full border px-3 py-1.5', active ? 'border-primary bg-primary-soft' : 'border-line bg-surface'].join(' ')}
                key={option.id}
                onPress={() => onChange(option.id as string | 'all')}
              >
                <Text className={['text-[12px] font-bold', active ? 'text-primary' : 'text-ink'].join(' ')} numberOfLines={1}>
                  {option.name}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </ScrollView>
    </View>
  );
}

export function ResultFilters({
  rows,
  value,
  onChange,
  stations,
  teams,
  rounds,
}: {
  rows: ResultRow[];
  value: ResultFilterState;
  onChange: (next: ResultFilterState) => void;
  stations: { id: string; name: string }[];
  teams: { id: string; name: string }[];
  rounds: { id: string; name: string }[];
}) {
  return (
    <View className="gap-3">
      <StatusChips onChange={(status) => onChange({ ...value, status })} rows={rows} value={value.status} />
      <PickerChips label="Station" onChange={(stationId) => onChange({ ...value, stationId })} options={stations} value={value.stationId} />
      <PickerChips label="Runde" onChange={(roundId) => onChange({ ...value, roundId })} options={rounds} value={value.roundId} />
      <PickerChips label="Team" onChange={(teamId) => onChange({ ...value, teamId })} options={teams} value={value.teamId} />
    </View>
  );
}
