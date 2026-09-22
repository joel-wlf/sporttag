import { Text, View } from 'react-native';
import { Icon } from '@/components/ui/Icon';
import { useTokens } from '@/components/ui/theme';

export function PinMarker({
  label,
  selected,
  color,
  badge,
  scoreLabel,
}: {
  label?: string;
  selected?: boolean;
  color?: string;
  badge?: string;
  scoreLabel?: string;
}) {
  const tokens = useTokens();
  const bubbleColor = color ?? (selected ? tokens.accent : tokens.primary);
  return (
    <View className="items-center">
      {scoreLabel ? (
        <View className="mb-0.5 rounded-full px-2 py-0.5 shadow-sm" style={{ backgroundColor: tokens.accent }}>
          <Text className="text-[11px] font-black text-ink" numberOfLines={1}>
            {scoreLabel}
          </Text>
        </View>
      ) : null}
      {label ? (
        <View className="mb-1 rounded-full bg-surface px-2 py-0.5 shadow-sm">
          <Text className="text-[11px] font-bold text-ink" numberOfLines={1}>
            {label}
          </Text>
        </View>
      ) : null}
      <View>
        <View
          className="items-center justify-center rounded-full shadow-sm"
          style={{
            height: selected ? 38 : 32,
            width: selected ? 38 : 32,
            backgroundColor: bubbleColor,
            borderWidth: selected ? 3 : 0,
            borderColor: tokens.surface,
          }}
        >
          <Icon color={tokens.onPrimary} name="map-pin" size={selected ? 19 : 17} />
        </View>
        {badge ? (
          <View
            className="absolute -right-1 -top-1 h-[18px] min-w-[18px] items-center justify-center rounded-full px-1"
            style={{ backgroundColor: tokens.danger }}
          >
            <Text className="text-[10px] font-black text-on-primary">{badge}</Text>
          </View>
        ) : null}
      </View>
    </View>
  );
}
