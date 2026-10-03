import { useState } from 'react';
import { Text, View, type GestureResponderEvent, type LayoutChangeEvent } from 'react-native';
import { haptic } from '@/lib/haptics';
import { useTokens } from './theme';

/**
 * Gestufter Schieberegler (z. B. Stärke 1–6). Ziehen und Tippen auf die Spur
 * setzen den Wert; für Screenreader ist er als „adjustable“ mit
 * Erhöhen/Verringern bedienbar. `null` bedeutet „nicht gesetzt“ – dann ist
 * kein Regler sichtbar, und der erste Tipp setzt den Wert.
 */
export function StepSlider({
  label,
  value,
  min,
  max,
  onChange,
  minLabel,
  maxLabel,
  emptyLabel = 'Nicht gesetzt',
  onClear,
}: {
  label: string;
  value: number | null;
  min: number;
  max: number;
  onChange: (value: number) => void;
  minLabel?: string;
  maxLabel?: string;
  emptyLabel?: string;
  onClear?: () => void;
}) {
  const tokens = useTokens();
  const [width, setWidth] = useState(0);

  const steps = max - min;
  const THUMB = 28;

  const valueAt = (x: number) => {
    const usableWidth = Math.max(1, width - THUMB);
    const ratio = Math.min(1, Math.max(0, (x - THUMB / 2) / usableWidth));
    return min + Math.round(ratio * steps);
  };
  // Läuft nur in Ereignissen, nie beim Rendern.
  const update = (evt: GestureResponderEvent) => {
    const next = valueAt(evt.nativeEvent.locationX);
    if (next !== value) {
      haptic('selection');
      onChange(next);
    }
  };

  const handleLayout = (event: LayoutChangeEvent) => setWidth(event.nativeEvent.layout.width);

  const usable = Math.max(0, width - THUMB);
  const position = (v: number) => THUMB / 2 + (usable * (v - min)) / Math.max(1, steps);
  const ticks = Array.from({ length: steps + 1 }, (_, i) => min + i);

  return (
    <View className="gap-2">
      <View className="flex-row items-center justify-between">
        <Text className="text-[13px] font-bold text-ink">{label}</Text>
        <View className="flex-row items-center gap-3">
          <Text className={['text-[13px] font-extrabold', value == null ? 'text-subtle' : 'text-primary'].join(' ')}>
            {value == null ? emptyLabel : `${value} von ${max}`}
          </Text>
          {onClear && value != null ? (
            <Text accessibilityRole="button" className="text-[13px] font-bold text-subtle underline" onPress={onClear}>
              Zurücksetzen
            </Text>
          ) : null}
        </View>
      </View>
      <View
        accessibilityActions={[
          { name: 'increment', label: 'Erhöhen' },
          { name: 'decrement', label: 'Verringern' },
        ]}
        accessibilityLabel={label}
        accessibilityRole="adjustable"
        accessibilityValue={value == null ? { text: emptyLabel } : { min, max, now: value }}
        accessible
        className="h-11 justify-center"
        onAccessibilityAction={(event) => {
          const current = value ?? Math.round((min + max) / 2);
          if (event.nativeEvent.actionName === 'increment') onChange(Math.min(max, value == null ? current : current + 1));
          if (event.nativeEvent.actionName === 'decrement') onChange(Math.max(min, value == null ? current : current - 1));
        }}
        onLayout={handleLayout}
      >
        <View className="mx-[14px] h-1.5 rounded-full bg-surface-muted" />
        {value != null && width > 0 ? (
          <View
            className="absolute h-1.5 rounded-full bg-primary"
            style={{ left: THUMB / 2, width: position(value) - THUMB / 2 }}
          />
        ) : null}
        {width > 0
          ? ticks.map((tick) => (
              <View
                className="absolute h-2.5 w-2.5 rounded-full"
                key={tick}
                style={{
                  left: position(tick) - 5,
                  backgroundColor: value != null && tick <= value ? tokens.primary : tokens.border,
                }}
              />
            ))
          : null}
        {value != null && width > 0 ? (
          <View
            className="absolute items-center justify-center rounded-full border-2 border-primary bg-surface shadow-sm"
            style={{ left: position(value) - THUMB / 2, width: THUMB, height: THUMB }}
          >
            <Text className="text-[12px] font-black text-primary">{value}</Text>
          </View>
        ) : null}
        {/* Oberste, kinderlose Fläche: locationX bezieht sich immer auf die Spur. */}
        <View
          className="absolute inset-0"
          onMoveShouldSetResponder={() => true}
          onResponderGrant={update}
          onResponderMove={update}
          onResponderTerminationRequest={() => false}
          onStartShouldSetResponder={() => true}
        />
      </View>
      {minLabel || maxLabel ? (
        <View className="flex-row justify-between">
          <Text className="text-[12px] text-subtle">{minLabel}</Text>
          <Text className="text-[12px] text-subtle">{maxLabel}</Text>
        </View>
      ) : null}
    </View>
  );
}
