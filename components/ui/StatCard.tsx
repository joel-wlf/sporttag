import { Text, View, type ViewProps } from 'react-native';
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
  // Schmale Basis, damit auf dem iPhone zwei Kennzahlen nebeneinander passen;
  // vorher stand jede Zahl allein auf einer bildschirmbreiten Karte.
  return (
    // Eigenes Gehäuse statt <Card>: dessen p-5/gap-4 ließen sich per className
    // nicht zuverlässig überschreiben (kein Class-Merge in NativeWind).
    <View
      className={['min-w-0 flex-1 basis-[150px] gap-1 rounded-[22px] border border-line bg-surface p-4 shadow-sm', className ?? ''].join(' ')}
      {...props}
    >
      <View className="flex-row items-start justify-between gap-2">
        <Text className="min-w-0 flex-1 text-[11px] font-extrabold tracking-[0.6px] text-subtle" numberOfLines={2}>
          {label.toUpperCase()}
        </Text>
        {icon ? (
          <View className="h-7 w-7 items-center justify-center rounded-full bg-primary-soft">
            <Icon name={icon} size={14} color={tokens.primary} />
          </View>
        ) : null}
      </View>
      <Text className="text-[28px] font-extrabold leading-[36px] tracking-[-1px] text-ink">{value}</Text>
      {hint ? <Text className="text-[12px] leading-4 text-subtle">{hint}</Text> : null}
    </View>
  );
}
