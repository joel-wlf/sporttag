import { createInput } from '@gluestack-ui/core/input/creator';
import { Text, TextInput, View, type TextInputProps } from 'react-native';
import { useTokens } from './theme';

const InputRoot = createInput({
  Root: View,
  Icon: View,
  Slot: View,
  Input: TextInput,
});

export const Input = InputRoot;
export const InputField = InputRoot.Input;
export const InputSlot = InputRoot.Slot;

export function Field({
  label,
  hint,
  error,
  className,
  ...props
}: TextInputProps & {
  label: string;
  hint?: string;
  error?: string;
  className?: string;
}) {
  const tokens = useTokens();
  const invalid = Boolean(error);
  return (
    <View className="gap-2">
      <Text className="text-[13px] font-bold text-ink">{label}</Text>
      <Input
        className={[
          'h-[50px] rounded-[14px] border bg-canvas px-1',
          invalid ? 'border-danger' : 'border-line',
          className ?? '',
        ].join(' ')}
      >
        <InputField
          className="h-full px-3 text-base text-ink outline-none"
          placeholderTextColor={tokens.subtle}
          {...props}
        />
      </Input>
      {error ? (
        <Text accessibilityRole="alert" className="text-[12px] font-semibold text-danger">
          {error}
        </Text>
      ) : hint ? (
        <Text className="text-[12px] text-subtle">{hint}</Text>
      ) : null}
    </View>
  );
}
