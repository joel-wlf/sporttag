import { createInput } from '@gluestack-ui/core/input/creator';
import { TextInput, View } from 'react-native';

const InputRoot = createInput({
  Root: View,
  Icon: View,
  Slot: View,
  Input: TextInput,
});

export const Input = InputRoot;
export const InputField = InputRoot.Input;
export const InputSlot = InputRoot.Slot;
