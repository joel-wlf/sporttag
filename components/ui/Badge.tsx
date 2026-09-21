import { Text, View, type TextProps } from 'react-native';
import { Icon, type IconName } from './Icon';
import { useTokens } from './theme';

export type BadgeTone = 'neutral' | 'primary' | 'secondary' | 'accent' | 'success' | 'warning' | 'danger';
export type BadgeVariant = 'soft' | 'solid' | 'outline';

const soft: Record<BadgeTone, string> = {
  neutral: 'bg-surface-muted text-subtle',
  primary: 'bg-primary-soft text-primary',
  secondary: 'bg-primary-soft text-primary',
  accent: 'bg-warning-soft text-warning',
  success: 'bg-success-soft text-success',
  warning: 'bg-warning-soft text-warning',
  danger: 'bg-danger-soft text-danger',
};

const solid: Record<BadgeTone, string> = {
  neutral: 'bg-ink text-on-primary',
  primary: 'bg-primary text-on-primary',
  secondary: 'bg-secondary text-ink',
  accent: 'bg-accent text-ink',
  success: 'bg-success text-on-primary',
  warning: 'bg-warning text-on-primary',
  danger: 'bg-danger text-on-primary',
};

const outline: Record<BadgeTone, string> = {
  neutral: 'border border-line text-subtle',
  primary: 'border border-primary text-primary',
  secondary: 'border border-secondary text-primary',
  accent: 'border border-accent text-warning',
  success: 'border border-success text-success',
  warning: 'border border-warning text-warning',
  danger: 'border border-danger text-danger',
};

const variantStyles: Record<BadgeVariant, Record<BadgeTone, string>> = { soft, solid, outline };

export function Badge({
  tone = 'neutral',
  variant = 'soft',
  className,
  ...props
}: TextProps & { tone?: BadgeTone; variant?: BadgeVariant; className?: string }) {
  return (
    <Text
      className={[
        'self-start overflow-hidden rounded-full px-3 py-1 text-[11px] font-bold tracking-[0.2px]',
        variantStyles[variant][tone],
        className ?? '',
      ].join(' ')}
      {...props}
    />
  );
}

export type SyncStatus = 'saved' | 'pending' | 'synced' | 'review';

const statusConfig: Record<
  SyncStatus,
  { tone: BadgeTone; icon: IconName; label: string; box: string; text: string; color: keyof ReturnType<typeof useTokens> }
> = {
  saved: {
    tone: 'success',
    icon: 'check-circle',
    label: 'Auf Gerät gespeichert',
    box: 'bg-success-soft',
    text: 'text-success',
    color: 'success',
  },
  pending: {
    tone: 'warning',
    icon: 'clock',
    label: 'Synchronisierung ausstehend',
    box: 'bg-warning-soft',
    text: 'text-warning',
    color: 'warning',
  },
  synced: {
    tone: 'primary',
    icon: 'upload',
    label: 'Übertragen',
    box: 'bg-primary-soft',
    text: 'text-primary',
    color: 'primary',
  },
  review: {
    tone: 'danger',
    icon: 'alert',
    label: 'Klärung nötig',
    box: 'bg-danger-soft',
    text: 'text-danger',
    color: 'danger',
  },
};

export function StatusBadge({ status, className }: { status: SyncStatus; className?: string }) {
  const tokens = useTokens();
  const config = statusConfig[status];
  return (
    <View
      className={[
        'flex-row items-center gap-1.5 self-start rounded-full px-3 py-1',
        config.box,
        className ?? '',
      ].join(' ')}
    >
      <Icon name={config.icon} size={13} color={tokens[config.color]} />
      <Text className={['text-[11px] font-bold', config.text].join(' ')}>{config.label}</Text>
    </View>
  );
}
