import { Pressable, Text, View, type ViewProps } from 'react-native';
import { haptic } from '@/lib/haptics';
import { Icon } from '@/components/ui/Icon';
import { useTokens } from '@/components/ui/theme';

export function Header({
  eyebrow,
  title,
  description,
  actions,
  onBack,
  className,
  ...props
}: ViewProps & {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: React.ReactNode;
  onBack?: () => void;
  className?: string;
}) {
  const tokens = useTokens();
  return (
    <View className={['w-full max-w-[760px] gap-2', className ?? ''].join(' ')} {...props}>
      {onBack ? (
        <Pressable
          accessibilityLabel="Zurück"
          accessibilityRole="button"
          className="mb-2 h-10 w-10 items-center justify-center rounded-full border border-line bg-surface active:opacity-70"
          onPress={onBack}
          onPressIn={() => haptic('heavy')}
        >
          <Icon name="arrow-left" size={18} color={tokens.text} />
        </Pressable>
      ) : null}
      {eyebrow ? (
        <Text className="text-[11px] font-black tracking-[1px] text-primary">{eyebrow}</Text>
      ) : null}
      <Text className="text-[30px] font-extrabold leading-9 tracking-[-0.8px] text-ink">
        {title}
      </Text>
      {description ? (
        <Text className="text-[15px] leading-6 text-subtle">{description}</Text>
      ) : null}
      {actions ? <View className="mt-2 flex-row flex-wrap gap-3">{actions}</View> : null}
    </View>
  );
}
