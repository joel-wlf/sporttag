import { Pressable, Text, View } from 'react-native';
import { haptic } from '@/lib/haptics';
import { Icon } from './Icon';
import { useTokens } from './theme';

export function Choice({
  label,
  description,
  selected,
  onPress,
}: {
  label: string;
  description?: string;
  selected: boolean;
  onPress: () => void;
}) {
  const tokens = useTokens();
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      className={[
        'flex-row items-center gap-3 rounded-2xl border px-4 py-3 active:opacity-80',
        selected ? 'border-primary bg-primary-soft' : 'border-line bg-surface',
      ].join(' ')}
      onPress={onPress}
      onPressIn={() => haptic('heavy')}
    >
      <View className="flex-1 gap-0.5">
        <Text className={['text-[14px] font-bold', selected ? 'text-primary' : 'text-ink'].join(' ')}>
          {label}
        </Text>
        {description ? (
          <Text className="text-[12px] leading-4 text-subtle">{description}</Text>
        ) : null}
      </View>
      {selected ? <Icon name="check-circle" size={18} color={tokens.primary} /> : null}
    </Pressable>
  );
}
