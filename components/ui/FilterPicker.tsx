import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { haptic } from '@/lib/haptics';
import { Choice } from './Choice';
import { FormSheet } from './FormSheet';
import { Icon } from './Icon';
import { useTokens } from './theme';

/**
 * Kompakter Filterknopf „Station: Alle ▾“. Die Auswahl öffnet ein Blatt mit
 * allen Optionen, statt je Filter eine eigene, am Rand abgeschnittene
 * Chip-Reihe mit eigenem „Alle“ zu zeigen. Ein gesetzter Filter ist gefüllt
 * und lässt sich direkt über das X zurücksetzen.
 */
export function FilterPicker({
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
  const tokens = useTokens();
  const [open, setOpen] = useState(false);
  if (options.length === 0) return null;
  const selected = options.find((o) => o.id === value) ?? null;

  return (
    <>
      <View
        className={[
          'min-h-[36px] flex-row items-center rounded-full border',
          selected ? 'border-primary bg-primary-soft' : 'border-line bg-surface',
        ].join(' ')}
      >
        <Pressable
          accessibilityHint="Öffnet die Auswahl"
          accessibilityLabel={`${label}: ${selected?.name ?? 'Alle'}`}
          accessibilityRole="button"
          className="min-h-[36px] flex-row items-center gap-1.5 pl-3.5 pr-3 active:opacity-70"
          onPress={() => {
            haptic('light');
            setOpen(true);
          }}
        >
          {/* Gesetzt reicht der Wert („Station D – Pavillon“), sonst „Station Alle“. */}
          {selected ? null : <Text className="text-[13px] font-semibold text-subtle">{label}</Text>}
          <Text
            className={[
              'max-w-[200px] text-[13px] font-bold',
              selected ? 'text-primary' : 'text-ink',
            ].join(' ')}
            numberOfLines={1}
          >
            {selected?.name ?? 'Alle'}
          </Text>
          {selected ? null : <Icon color={tokens.subtle} name="chevron-down" size={14} />}
        </Pressable>
        {selected ? (
          <Pressable
            accessibilityLabel={`${label}-Filter entfernen`}
            accessibilityRole="button"
            className="h-9 w-9 items-center justify-center active:opacity-70"
            hitSlop={4}
            onPress={() => {
              haptic('light');
              onChange('all');
            }}
          >
            <Icon color={tokens.primary} name="close" size={14} />
          </Pressable>
        ) : null}
      </View>

      <FormSheet cancelLabel={null} onClose={() => setOpen(false)} title={label} visible={open}>
        <View accessibilityRole="radiogroup" className="gap-2">
          {[{ id: 'all', name: 'Alle' }, ...options].map((option) => (
            <Choice
              key={option.id}
              label={option.name}
              onPress={() => {
                onChange(option.id);
                setOpen(false);
              }}
              selected={value === option.id}
            />
          ))}
        </View>
      </FormSheet>
    </>
  );
}
