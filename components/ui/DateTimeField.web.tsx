import { Text, View } from 'react-native';
import { useTokens } from './theme';

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

function toInputValue(date: Date | null, mode: 'date' | 'time' | 'datetime'): string {
  if (!date) return '';
  if (mode === 'time') return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
  const datePart = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  if (mode === 'date') return datePart;
  return `${datePart}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function timeOnDate(raw: string, base: Date): Date {
  const [hours, minutes] = raw.split(':').map(Number);
  const date = new Date(base);
  date.setHours(hours ?? 0, minutes ?? 0, 0, 0);
  return date;
}

export function DateTimeField({
  label,
  value,
  onChange,
  hint,
  error,
  mode = 'datetime',
  defaultValue,
}: {
  label: string;
  value: Date | null;
  onChange: (date: Date) => void;
  hint?: string;
  error?: string;
  mode?: 'date' | 'time' | 'datetime';
  defaultValue?: Date;
}) {
  const tokens = useTokens();
  const invalid = Boolean(error);

  return (
    <View className="gap-2">
      <Text className="text-[13px] font-bold text-ink">{label}</Text>
      <input
        onChange={(event) => {
          const raw = event.target.value;
          if (!raw) return;
          const parsed = mode === 'time' ? timeOnDate(raw, value ?? defaultValue ?? new Date()) : new Date(raw);
          if (!isNaN(parsed.getTime())) onChange(parsed);
        }}
        style={{
          height: 50,
          borderRadius: 14,
          border: `1px solid ${invalid ? tokens.danger : tokens.border}`,
          paddingLeft: 12,
          paddingRight: 12,
          fontSize: 16,
          fontFamily: 'inherit',
          background: tokens.surface,
          color: tokens.text,
        }}
        type={mode === 'datetime' ? 'datetime-local' : mode}
        value={toInputValue(value ?? defaultValue ?? null, mode)}
      />
      {error ? (
        <Text accessibilityRole="alert" className="text-[12px] font-semibold text-danger">
          {error}
        </Text>
      ) : hint ? (
        <Text className="text-[12px] text-subtle">{hint}</Text>
      ) : null}
    </View>
  );
}
