import { Text, View } from 'react-native';
import { Icon } from '@/components/ui/Icon';
import { useTokens } from '@/components/ui/theme';

export function PinMarker({ label, selected }: { label?: string; selected?: boolean }) {
  const tokens = useTokens();
  return (
    <View className="items-center">
      {label ? (
        <View className="mb-1 rounded-full bg-surface px-2 py-0.5 shadow-sm">
          <Text className="text-[11px] font-bold text-ink" numberOfLines={1}>
            {label}
          </Text>
        </View>
      ) : null}
      <View
        className="h-8 w-8 items-center justify-center rounded-full shadow-sm"
        style={{ backgroundColor: selected ? tokens.accent : tokens.primary }}
      >
        <Icon color={tokens.onPrimary} name="map-pin" size={17} />
      </View>
    </View>
  );
}
