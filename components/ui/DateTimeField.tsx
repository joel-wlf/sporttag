import DateTimePicker, { type DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { useState } from 'react';
import { Platform, Pressable, Text, View } from 'react-native';
import { Button } from './Button';
import { Icon } from './Icon';
import { useTokens } from './theme';

function formatDisplay(date: Date, mode: 'date' | 'time' | 'datetime'): string {
  if (mode === 'time') return date.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
  return date.toLocaleString(
    'de-DE',
    mode === 'date'
      ? { day: '2-digit', month: '2-digit', year: 'numeric' }
      : { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' },
  );
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
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<Date>(value ?? defaultValue ?? new Date());
  const [androidStep, setAndroidStep] = useState<'date' | 'time'>('date');

  const openPicker = () => {
    setDraft(value ?? defaultValue ?? new Date());
    setAndroidStep('date');
    setOpen(true);
  };

  const handleAndroidChange = (event: DateTimePickerEvent, selected?: Date) => {
    if (event.type === 'dismissed') {
      setOpen(false);
      return;
    }
    if (!selected) return;
    if (mode !== 'datetime') {
      onChange(selected);
      setOpen(false);
      return;
    }
    if (androidStep === 'date') {
      setDraft(selected);
      setAndroidStep('time');
      return;
    }
    const combined = new Date(draft);
    combined.setHours(selected.getHours(), selected.getMinutes(), 0, 0);
    onChange(combined);
    setOpen(false);
  };

  const handleIosChange = (_event: DateTimePickerEvent, selected?: Date) => {
    if (selected) setDraft(selected);
  };

  const confirmIos = () => {
    onChange(draft);
    setOpen(false);
  };

  return (
    <View className="gap-2">
      <Text className="text-[13px] font-bold text-ink">{label}</Text>
      <Pressable
        className={[
          'h-[50px] flex-row items-center justify-between rounded-[14px] border bg-canvas px-3',
          invalid ? 'border-danger' : 'border-line',
        ].join(' ')}
        onPress={openPicker}
      >
        <Text className="text-base text-ink" style={!value ? { color: tokens.subtle } : undefined}>
          {value ? formatDisplay(value, mode) : 'Auswählen'}
        </Text>
        <Icon name="clock" size={18} />
      </Pressable>
      {error ? (
        <Text accessibilityRole="alert" className="text-[12px] font-semibold text-danger">
          {error}
        </Text>
      ) : hint ? (
        <Text className="text-[12px] text-subtle">{hint}</Text>
      ) : null}
      {open && Platform.OS === 'android' ? (
        <DateTimePicker mode={mode === 'datetime' ? androidStep : mode} onChange={handleAndroidChange} value={draft} />
      ) : null}
      {open && Platform.OS === 'ios' ? (
        <View className="gap-2 rounded-[14px] border border-line bg-canvas p-2">
          <DateTimePicker display="spinner" mode={mode} onChange={handleIosChange} value={draft} />
          <Button label="Fertig" onPress={confirmIos} size="sm" />
        </View>
      ) : null}
    </View>
  );
}
