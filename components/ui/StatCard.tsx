import { Text, View, type ViewProps } from 'react-native';
import { Card } from './Card';
import { Icon, type IconName } from './Icon';
import { useTokens } from './theme';

export function StatCard({
  label,
  value,
  hint,
  icon,
  className,
  ...props
}: ViewProps & {
  label: string;
  value: string;
  hint?: string;
  icon?: IconName;
  className?: string;
}) {
  const tokens = useTokens();
  return (
    <Card className={['min-w-0 flex-1 basis-[180px] gap-2', className ?? ''].join(' ')} {...props}>
      <View className="flex-row items-center justify-between gap-3">
        <Text className="text-[11px] font-extrabold tracking-[0.7px] text-subtle">
          {label.toUpperCase()}
        </Text>
        {icon ? (
          <View className="h-8 w-8 items-center justify-center rounded-full bg-primary-soft">
            <Icon name={icon} size={16} color={tokens.primary} />
          </View>
        ) : null}
      </View>
      <Text className="text-[30px] font-extrabold leading-9 tracking-[-1px] text-ink">{value}</Text>
      {hint ? <Text className="text-[12px] leading-4 text-subtle">{hint}</Text> : null}
    </Card>
  );
}
