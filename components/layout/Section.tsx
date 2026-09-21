import { Text, View, type ViewProps } from 'react-native';

export function Section({
  title,
  description,
  action,
  children,
  className,
  ...props
}: ViewProps & {
  title?: string;
  description?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <View className={['gap-4', className ?? ''].join(' ')} {...props}>
      {title || action ? (
        <View className="flex-row flex-wrap items-end justify-between gap-3">
          <View className="gap-1">
            {title ? <Text className="text-[15px] font-extrabold text-ink">{title}</Text> : null}
            {description ? (
              <Text className="text-[13px] leading-5 text-subtle">{description}</Text>
            ) : null}
          </View>
          {action}
        </View>
      ) : null}
      {children}
    </View>
  );
}
