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
      {/* Neuer key je Layout: beim Wechsel zwischen einem und zwei Knöpfen
          blieb sonst die alte Vollbreite hängen und drückte den zweiten Knopf
          zu einer leeren Pille zusammen. */}
      <Button
        key={secondary ? 'split' : 'full'}
        size="xl"
        variant="primary"
        {...primary}
        {...icons}
        fullWidth={!secondary}
        // Die Hauptaktion bekommt zwei Drittel: lange Labels wie "Station
        // übernehmen" brechen sonst in der halben Breite um.
        className={[secondary ? 'flex-[2]' : '', primary.className ?? ''].join(' ')}
      />
    </View>
  );
}
