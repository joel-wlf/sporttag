import { createButton } from '@gluestack-ui/core/button/creator';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';

const ButtonRoot = createButton({
  Root: Pressable,
  Text,
  Group: View,
  Spinner: ActivityIndicator,
  Icon: View,
});

export const Button = ButtonRoot;
export const ButtonText = ButtonRoot.Text;
export const ButtonSpinner = ButtonRoot.Spinner;
export const ButtonGroup = ButtonRoot.Group;
