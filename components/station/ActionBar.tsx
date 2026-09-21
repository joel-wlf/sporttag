import { View } from 'react-native';
import { Button, type ButtonProps } from '@/components/ui/Button';

/**
 * Fixierte Aktionsleiste für Screen.footer: die Hauptaktion sitzt auf jedem
 * Station-Screen an derselben Stelle im Daumenbereich.
 */
export function ActionBar({
  primary,
  secondary,
}: {
  primary: ButtonProps;
  secondary?: ButtonProps;
}) {
  // Zwei Buttons nebeneinander lassen keinen Platz für zusätzliche Icons.
  const icons = secondary ? { leftIcon: undefined, rightIcon: undefined } : {};

  return (
    <View className="flex-row gap-2">
      {secondary ? (
        <Button
          size="xl"
          variant="outline"
          {...secondary}
          {...icons}
          className={['flex-1', secondary.className ?? ''].join(' ')}
        />
      ) : null}
      <Button
        size="xl"
        variant="primary"
        {...primary}
        {...icons}
        fullWidth={!secondary}
        className={[secondary ? 'flex-1' : '', primary.className ?? ''].join(' ')}
      />
    </View>
  );
}
