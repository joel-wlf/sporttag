import { Text, View, type ViewProps } from 'react-native';

export function Avatar({
  initials,
  size = 40,
  className,
  ...props
}: ViewProps & { initials: string; size?: number; className?: string }) {
  return (
    <View
      className={['items-center justify-center rounded-full bg-secondary', className ?? ''].join(' ')}
      style={{ width: size, height: size }}
      {...props}
    >
      <Text className="font-extrabold text-ink" style={{ fontSize: Math.round(size * 0.38) }}>
        {initials}
      </Text>
    </View>
  );
}
