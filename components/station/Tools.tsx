import { useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Icon } from '@/components/ui/Icon';
import { useTokens } from '@/components/ui/theme';
import { haptic } from '@/lib/haptics';
import type { ToolConfig } from '@/lib/station/types';

const format = (totalSeconds: number) => {
  const minutes = String(Math.floor(totalSeconds / 60)).padStart(2, '0');
  const seconds = String(totalSeconds % 60).padStart(2, '0');
  return `${minutes}:${seconds}`;
};

function IconButton({
  icon,
  onPress,
  tone = 'default',
}: {
  icon: 'play' | 'pause' | 'stop' | 'minus' | 'plus';
  onPress: () => void;
  tone?: 'default' | 'primary';
}) {
  const tokens = useTokens();
  return (
    <Pressable
      accessibilityRole="button"
      className={[
        'h-10 w-10 items-center justify-center rounded-full active:opacity-70',
        tone === 'primary' ? 'bg-primary' : 'border border-line bg-surface',
      ].join(' ')}
      onPress={() => {
        haptic('medium');
        onPress();
      }}
    >
      <Icon color={tone === 'primary' ? tokens.onPrimary : tokens.text} name={icon} size={16} />
    </Pressable>
  );
}

function ToolRow({ label, value, children }: { label: string; value: string; children: React.ReactNode }) {
  return (
    <View className="flex-row items-center justify-between gap-3 border-t border-line pt-3">
      <View className="gap-0.5">
        <Text className="text-2xs font-extrabold tracking-[0.6px] text-subtle">
          {label.toUpperCase()}
        </Text>
        <Text
          className="text-xl font-extrabold tracking-[-0.5px] text-ink"
          style={{ fontVariant: ['tabular-nums'] }}
        >
          {value}
        </Text>
      </View>
      <View className="flex-row gap-2">{children}</View>
    </View>
  );
}

export function ToolStrip({ config, defaultSeconds = 900 }: { config?: ToolConfig[]; defaultSeconds?: number }) {
  // Konfiguration aus dem Spiel (falls vorhanden) bestimmt die Startwerte;
  // ohne `tools_config` gelten die bisherigen Vorgaben.
  const timerConfig = config?.find((t): t is Extract<ToolConfig, { type: 'timer' }> => t.type === 'timer');
  const counterConfig = config?.find((t): t is Extract<ToolConfig, { type: 'counter' }> => t.type === 'counter');
  const stopwatchConfig = config?.find((t) => t.type === 'stopwatch');

  const [elapsed, setElapsed] = useState(0);
  const [stopwatchRunning, setStopwatchRunning] = useState(false);
  const [remaining, setRemaining] = useState(timerConfig?.seconds ?? defaultSeconds);
  const [timerRunning, setTimerRunning] = useState(false);
  const [count, setCount] = useState(counterConfig?.start ?? 0);
  const counterStep = counterConfig?.step ?? 1;

  const stopwatchLabel = stopwatchConfig?.label ?? 'Stoppuhr';
  const timerLabel = timerConfig?.label ?? 'Timer';
  const counterLabel = counterConfig?.label ?? 'Zähler';

  useEffect(() => {
    if (!stopwatchRunning) return;
    const id = setInterval(() => setElapsed((value) => value + 1), 1000);
    return () => clearInterval(id);
  }, [stopwatchRunning]);

  useEffect(() => {
    if (!timerRunning || remaining <= 0) return;
    const id = setTimeout(() => {
      const next = Math.max(0, remaining - 1);
      setRemaining(next);
      if (next === 0) setTimerRunning(false);
    }, 1000);
    return () => clearTimeout(id);
  }, [timerRunning, remaining]);

  return (
    <View className="gap-3 rounded-card border border-line bg-surface p-4">
      <ToolRow label={stopwatchLabel} value={format(elapsed)}>
        <IconButton
          icon={stopwatchRunning ? 'pause' : 'play'}
          onPress={() => setStopwatchRunning((value) => !value)}
          tone="primary"
        />
        <IconButton
          icon="stop"
          onPress={() => {
            setStopwatchRunning(false);
            setElapsed(0);
          }}
        />
      </ToolRow>
      <ToolRow label={timerLabel} value={format(remaining)}>
        <IconButton icon="minus" onPress={() => setRemaining((value) => Math.max(0, value - 60))} />
        <IconButton
          icon={timerRunning ? 'pause' : 'play'}
          onPress={() => setTimerRunning((value) => !value)}
          tone="primary"
        />
      </ToolRow>
      <ToolRow label={counterLabel} value={String(count)}>
        <IconButton icon="minus" onPress={() => setCount((value) => Math.max(0, value - counterStep))} />
        <IconButton icon="plus" onPress={() => setCount((value) => value + counterStep)} tone="primary" />
      </ToolRow>
    </View>
  );
}
