import { Pressable, Text, View } from 'react-native';
import { haptic } from '@/lib/haptics';

/**
 * Kompakte, waagerechte Segmentauswahl (helle Spur, hervorgehobenes Segment).
 * Für kurze Optionen wie Geschlecht oder Gewichtungen; längere Optionen mit
 * Beschreibung nutzen SegmentedChoice.
 */
export function PillChoice<T extends string>({
  label,
  value,
  options,
  onChange,
  accessibilityLabel,
}: {
  label?: string;
  value: T;
  options: { value: T; label: string; accessibilityLabel?: string }[];
  onChange: (value: T) => void;
  accessibilityLabel?: string;
}) {
  return (
    <View className="gap-2">
      {label ? <Text className="text-[13px] font-bold text-ink">{label}</Text> : null}
      <View
        accessibilityLabel={accessibilityLabel ?? label}
        accessibilityRole="radiogroup"
        className="flex-row rounded-full border border-line bg-surface-muted p-1"
      >
        {options.map((option) => {
          const selected = option.value === value;
          return (
            <Pressable
              accessibilityLabel={option.accessibilityLabel ?? option.label}
              accessibilityRole="radio"
              accessibilityState={{ selected }}
              className={[
                'min-h-[38px] flex-1 items-center justify-center rounded-full px-2',
                selected ? 'bg-primary' : 'active:opacity-70',
              ].join(' ')}
              key={option.value}
              onPress={() => onChange(option.value)}
              onPressIn={() => haptic('selection')}
            >
              <Text
                className={['text-[13px] font-bold', selected ? 'text-on-primary' : 'text-ink'].join(' ')}
                numberOfLines={1}
              >
                {option.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
