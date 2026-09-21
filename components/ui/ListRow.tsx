import { Pressable, Text, View, type ViewProps } from 'react-native';
import { haptic } from '@/lib/haptics';
import { Icon, type IconName } from './Icon';
import { useTokens } from './theme';

export function ListRow({
  icon,
  title,
  subtitle,
  value,
  onPress,
  showChevron = false,
  className,
  ...props
}: ViewProps & {
  icon?: IconName;
  title: string;
  subtitle?: string;
  value?: string;
  onPress?: () => void;
  showChevron?: boolean;
  className?: string;
}) {
  const tokens = useTokens();
  const content = (
    <>
      {icon ? (
        <View className="h-9 w-9 items-center justify-center rounded-xl bg-primary-soft">
          <Icon name={icon} size={18} color={tokens.primary} />
        </View>
      ) : null}
      <View className="flex-1 gap-0.5">
        <Text className="text-[14px] font-bold text-ink">{title}</Text>
        {subtitle ? <Text className="text-[12px] leading-4 text-subtle">{subtitle}</Text> : null}
      </View>
      {value ? <Text className="text-[13px] font-bold text-subtle">{value}</Text> : null}
      {showChevron ? <Icon name="chevron-right" size={16} color={tokens.subtle} /> : null}
    </>
  );

  const rowClassName = [
    'flex-row items-center gap-3 rounded-2xl px-2 py-2',
    onPress ? 'active:bg-primary-soft' : '',
    className ?? '',
  ].join(' ');

  if (!onPress) {
    return (
      <View className={rowClassName} {...props}>
        {content}
      </View>
    );
  }

  return (
    <Pressable
      accessibilityRole="button"
      className={rowClassName}
      onPress={onPress}
      onPressIn={() => haptic('heavy')}
      {...props}
    >
      {content}
    </Pressable>
  );
}
