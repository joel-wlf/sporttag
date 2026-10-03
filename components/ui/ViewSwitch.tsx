import { Pressable, Text, View } from 'react-native';
import { haptic } from '@/lib/haptics';
import { Icon, type IconName } from './Icon';
import { useTokens } from './theme';

/**
 * Umschalter zwischen Ansichten desselben Inhalts (Karte/Zeitleiste,
 * Ergebnisse/Tabelle). Eine gemeinsame Spur mit hervorgehobenem Segment
 * (docs/design-system.md › Segmentierte Auswahl) statt loser Pillen, die wie
 * Filter oder Aktionen aussahen. Für Bildschirmleser eine Tab-Liste.
 */
export function ViewSwitch<T extends string>({
  value,
  options,
  onChange,
  accessibilityLabel,
}: {
  value: T;
  options: { value: T; label: string; icon?: IconName }[];
  onChange: (next: T) => void;
  accessibilityLabel?: string;
}) {
  const tokens = useTokens();
  return (
    <View
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="tablist"
      className="flex-row self-start rounded-full border border-line bg-surface-muted p-1"
    >
      {options.map((option) => {
        const active = option.value === value;
        return (
          <Pressable
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            className={[
              'min-h-[36px] flex-row items-center justify-center gap-1.5 rounded-full px-4',
              active ? 'bg-surface shadow-sm' : 'active:opacity-70',
            ].join(' ')}
            key={option.value}
            onPress={() => {
              if (active) return;
              haptic('light');
              onChange(option.value);
            }}
          >
            {option.icon ? (
              <Icon color={active ? tokens.primary : tokens.subtle} name={option.icon} size={14} />
            ) : null}
            <Text className={['text-[13px] font-bold', active ? 'text-primary' : 'text-subtle'].join(' ')}>
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
