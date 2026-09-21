import { Text, View, type TextProps, type ViewProps } from 'react-native';

export type CardVariant = 'default' | 'muted' | 'outline';

const variants: Record<CardVariant, string> = {
  default: 'bg-surface border-line',
  muted: 'bg-surface-muted border-transparent',
  outline: 'bg-transparent border-line',
};

export function Card({
  variant = 'default',
  className,
  ...props
}: ViewProps & { variant?: CardVariant; className?: string }) {
  return (
    <View
      className={[
        'rounded-[22px] border p-5 gap-4 shadow-sm',
        variants[variant],
        className ?? '',
      ].join(' ')}
      {...props}
    />
  );
}

export function CardHeader({ className, ...props }: ViewProps & { className?: string }) {
  return <View className={['gap-1.5', className ?? ''].join(' ')} {...props} />;
}

export function CardTitle({ className, ...props }: TextProps & { className?: string }) {
  return (
    <Text
      className={['text-[17px] font-extrabold tracking-[-0.2px] text-ink', className ?? ''].join(' ')}
      {...props}
    />
  );
}

export function CardDescription({ className, ...props }: TextProps & { className?: string }) {
  return (
    <Text
      className={['text-[13px] leading-5 text-subtle', className ?? ''].join(' ')}
      {...props}
    />
  );
}

export function CardContent({ className, ...props }: ViewProps & { className?: string }) {
  return <View className={['gap-3', className ?? ''].join(' ')} {...props} />;
}

export function CardFooter({ className, ...props }: ViewProps & { className?: string }) {
  return (
    <View
      className={['flex-row flex-wrap items-center gap-3', className ?? ''].join(' ')}
      {...props}
    />
  );
}
