import { Text, View, type ViewProps } from 'react-native';
import { Icon, type IconName } from './Icon';
import { useTokens } from './theme';

export function EmptyState({
  icon = 'package',
  title,
  description,
  action,
  className,
  ...props
}: ViewProps & {
  icon?: IconName;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}) {
  const tokens = useTokens();
  return (
    <View className={['items-center gap-3 px-4 py-6', className ?? ''].join(' ')} {...props}>
      <View className="h-12 w-12 items-center justify-center rounded-full bg-primary-soft">
        <Icon name={icon} size={22} color={tokens.primary} />
      </View>
      <Text className="text-center text-base font-extrabold text-ink">{title}</Text>
      {description ? (
        <Text className="max-w-[420px] text-center text-[13px] leading-5 text-subtle">
          {description}
        </Text>
      ) : null}
      {action ? <View className="mt-1">{action}</View> : null}
    </View>
  );
}
