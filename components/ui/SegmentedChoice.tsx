import { Text, View } from 'react-native';
import { Choice } from './Choice';

export function SegmentedChoice<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label?: string;
  value: T;
  options: { value: T; label: string; description?: string }[];
  onChange: (value: T) => void;
}) {
  return (
    <View className="gap-2">
      {label ? <Text className="text-[13px] font-bold text-ink">{label}</Text> : null}
      <View accessibilityRole="radiogroup" className="gap-2">
        {options.map((option) => (
          <Choice
            description={option.description}
            key={option.value}
            label={option.label}
            onPress={() => onChange(option.value)}
            selected={value === option.value}
          />
        ))}
      </View>
    </View>
  );
}
