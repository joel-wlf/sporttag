import { createButton } from '@gluestack-ui/core/button/creator';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { haptic as triggerHaptic, type HapticStyle } from '@/lib/haptics';
import { Icon, type IconName } from './Icon';
import { useTokens } from './theme';

const ButtonRoot = createButton({
  Root: Pressable,
  Text,
  Group: View,
  Spinner: ActivityIndicator,
  Icon: View,
});

export const ButtonText = ButtonRoot.Text;
export const ButtonSpinner = ButtonRoot.Spinner;
export const ButtonGroup = ButtonRoot.Group;

export type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
export type ButtonSize = 'sm' | 'md' | 'lg' | 'xl';

const container: Record<ButtonVariant, string> = {
  primary: 'bg-primary active:opacity-85',
  secondary: 'bg-primary-soft active:opacity-85',
  outline: 'border border-line bg-surface active:opacity-70',
  ghost: 'bg-transparent active:bg-primary-soft',
  danger: 'bg-danger active:opacity-85',
};

const label: Record<ButtonVariant, string> = {
  primary: 'text-on-primary',
  secondary: 'text-primary',
  outline: 'text-ink',
  ghost: 'text-ink',
  danger: 'text-on-primary',
};

const iconColor: Record<ButtonVariant, 'onPrimary' | 'primary' | 'text'> = {
  primary: 'onPrimary',
  secondary: 'primary',
  outline: 'text',
  ghost: 'text',
  danger: 'onPrimary',
};

const sizing: Record<ButtonSize, { box: string; text: string; icon: number }> = {
  sm: { box: 'min-h-[38px] px-4 gap-2', text: 'text-[13px]', icon: 16 },
  md: { box: 'min-h-[46px] px-5 gap-2', text: 'text-[15px]', icon: 18 },
  lg: { box: 'min-h-[52px] px-6 gap-2.5', text: 'text-base', icon: 20 },
  xl: { box: 'min-h-[64px] px-7 gap-3', text: 'text-lg', icon: 22 },
};

export type ButtonProps = {
  variant?: ButtonVariant;
  size?: ButtonSize;
  label?: string;
  leftIcon?: IconName;
  rightIcon?: IconName;
  isLoading?: boolean;
  isDisabled?: boolean;
  fullWidth?: boolean;
  haptic?: HapticStyle;
  className?: string;
  children?: React.ReactNode;
  onPress?: React.ComponentProps<typeof ButtonRoot>['onPress'];
  onPressIn?: React.ComponentProps<typeof ButtonRoot>['onPressIn'];
  onPressOut?: React.ComponentProps<typeof ButtonRoot>['onPressOut'];
} & Omit<
  React.ComponentProps<typeof ButtonRoot>,
  'children' | 'isDisabled' | 'onPress' | 'onPressIn' | 'onPressOut'
>;

export function Button({
  variant = 'primary',
  size = 'md',
  label: labelText,
  leftIcon,
  rightIcon,
  isLoading = false,
  isDisabled = false,
  fullWidth = false,
  haptic: activationHaptic = 'heavy',
  className,
  children,
  onPress,
  onPressIn,
  onPressOut,
  ...props
}: ButtonProps) {
  const tokens = useTokens();
  const disabled = isDisabled || isLoading;
  const resolvedIconColor = tokens[iconColor[variant]];

  const handlePressIn: NonNullable<React.ComponentProps<typeof ButtonRoot>['onPressIn']> = (
    event,
  ) => {
    triggerHaptic(activationHaptic);
    onPressIn?.(event);
  };
  const handlePressOut: NonNullable<React.ComponentProps<typeof ButtonRoot>['onPressOut']> = (
    event,
  ) => {
    onPressOut?.(event);
  };
  const handlePress: NonNullable<React.ComponentProps<typeof ButtonRoot>['onPress']> = (event) => {
    onPress?.(event);
  };

  return (
    <ButtonRoot
      accessibilityRole="button"
      accessibilityState={{ disabled, busy: isLoading }}
      className={[
        'flex-row items-center justify-center rounded-full',
        sizing[size].box,
        container[variant],
        fullWidth ? 'w-full' : 'self-start',
        disabled ? 'opacity-50' : '',
        className ?? '',
      ].join(' ')}
      disabled={disabled}
      isDisabled={disabled}
      onPress={disabled ? undefined : handlePress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      {...props}
    >
      {isLoading ? (
        <ButtonSpinner color={resolvedIconColor} size="small" />
      ) : leftIcon ? (
        <Icon name={leftIcon} size={sizing[size].icon} color={resolvedIconColor} />
      ) : null}
      {children ?? (
        <ButtonText className={`font-bold ${sizing[size].text} ${label[variant]}`}>
          {labelText}
        </ButtonText>
      )}
      {!isLoading && rightIcon ? (
        <Icon name={rightIcon} size={sizing[size].icon} color={resolvedIconColor} />
      ) : null}
    </ButtonRoot>
  );
}
