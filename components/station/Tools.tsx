import { useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Icon } from '@/components/ui/Icon';
import { useTokens } from '@/components/ui/theme';
import { haptic } from '@/lib/haptics';
import { loadToolState, saveToolState } from '@/lib/station/store';
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

function ToolRow({
  label,
  value,
  first = false,
  children,
}: {
  label: string;
  value: string;
  /** Die erste Zeile trennt nichts: kein Strich direkt unter dem Kartenrand. */
  first?: boolean;
  children: React.ReactNode;
}) {
  return (
    <View
      className={[
        'flex-row items-center justify-between gap-3',
        first ? '' : 'border-t border-line pt-3',
      ].join(' ')}
    >
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

type PersistedTools = {
  stopwatch: { startedAt: number | null; accumulatedMs: number };
  timer: { endsAt: number | null; remainingMs: number };
  count: number;
};

export function ToolStrip({
  config,
  defaultSeconds = 900,
  eventId,
  matchId,
}: {
  config?: ToolConfig[];
  defaultSeconds?: number;
  /** Mit Event und Match bleiben Stände über Navigation und Neustart erhalten. */
  eventId?: string;
  matchId?: string;
}) {
  // Konfiguration aus dem Spiel (falls vorhanden) bestimmt die Startwerte;
  // ohne `tools_config` gelten die bisherigen Vorgaben.
  const timerConfig = config?.find(
    (t): t is Extract<ToolConfig, { type: 'timer' }> => t.type === 'timer',
  );
  const counterConfig = config?.find(
    (t): t is Extract<ToolConfig, { type: 'counter' }> => t.type === 'counter',
  );
  const stopwatchConfig = config?.find((t) => t.type === 'stopwatch');
  const timerSeconds = timerConfig?.seconds ?? defaultSeconds;

  // Zeiten werden aus Zeitstempeln berechnet, nicht durch Sekundenticks
  // hochgezählt: Bei gesperrtem Bildschirm pausiert JavaScript, und der
  // Timer lief bisher entsprechend nach. Der Stand wird lokal gesichert
  // (docs/datenkonzept.md Abschnitt 14) und übersteht Zurück-Navigation,
  // Einklappen und Neustart.
  const [tools, setTools] = useState<PersistedTools>(() => ({
    stopwatch: { startedAt: null, accumulatedMs: 0 },
    timer: { endsAt: null, remainingMs: timerSeconds * 1000 },
    count: counterConfig?.start ?? 0,
  }));
  const [loaded, setLoaded] = useState(!matchId);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const counterStep = counterConfig?.step ?? 1;
  const storageId = matchId ? `tools:${matchId}` : null;

  useEffect(() => {
    if (!storageId) return;
    let active = true;
    loadToolState<PersistedTools>(storageId)
      .then((stored) => {
        if (active && stored) {
          setTools(stored);
          setNowMs(Date.now());
        }
      })
      .catch(() => undefined)
      .finally(() => {
        if (active) setLoaded(true);
      });
    return () => {
      active = false;
    };
  }, [storageId]);

  const update = (change: (prev: PersistedTools) => PersistedTools) => {
    setNowMs(Date.now());
    setTools((prev) => {
      const next = change(prev);
      if (storageId && eventId && loaded) {
        void saveToolState(storageId, eventId, matchId ?? null, 'tools', next).catch(() => undefined);
      }
      return next;
    });
  };

  const stopwatchRunning = tools.stopwatch.startedAt !== null;
  const timerRunning = tools.timer.endsAt !== null;
  const elapsedMs =
    tools.stopwatch.accumulatedMs +
    (tools.stopwatch.startedAt !== null ? Math.max(0, nowMs - tools.stopwatch.startedAt) : 0);
  const remainingMs =
    tools.timer.endsAt !== null ? Math.max(0, tools.timer.endsAt - nowMs) : tools.timer.remainingMs;
  const elapsed = Math.floor(elapsedMs / 1000);
  const remaining = Math.ceil(remainingMs / 1000);
  const count = tools.count;

  // Hat das Spiel Werkzeuge konfiguriert, erscheinen nur diese; ohne
  // Konfiguration bleiben alle drei als Vorgabe sichtbar.
  const configured = Boolean(config && config.length > 0);
  const showStopwatch = !configured || Boolean(stopwatchConfig);
  const showTimer = !configured || Boolean(timerConfig);
  const showCounter = !configured || Boolean(counterConfig);

  const stopwatchLabel = stopwatchConfig?.label ?? 'Stoppuhr';
  const timerLabel = timerConfig?.label ?? 'Timer';
  const counterLabel = counterConfig?.label ?? 'Zähler';

  // Nur die Anzeige auffrischen, solange etwas läuft; ein abgelaufener
  // Timer gilt danach als angehalten (bei 0).
  const timerEndsAt = tools.timer.endsAt;
  useEffect(() => {
    if (!stopwatchRunning && timerEndsAt === null) return;
    const id = setInterval(() => {
      const current = Date.now();
      setNowMs(current);
      if (timerEndsAt !== null && current >= timerEndsAt) {
        update((prev) => ({ ...prev, timer: { endsAt: null, remainingMs: 0 } }));
      }
    }, 500);
    return () => clearInterval(id);
    // `update` ist bewusst nicht Abhängigkeit: es ändert sich je Render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stopwatchRunning, timerEndsAt]);

  const setStopwatchRunning = (run: boolean) =>
    update((prev) => {
      const sw = prev.stopwatch;
      if (run && sw.startedAt === null) return { ...prev, stopwatch: { ...sw, startedAt: Date.now() } };
      if (!run && sw.startedAt !== null) {
        return {
          ...prev,
          stopwatch: { startedAt: null, accumulatedMs: sw.accumulatedMs + Math.max(0, Date.now() - sw.startedAt) },
        };
      }
      return prev;
    });
  const resetStopwatch = () => update((prev) => ({ ...prev, stopwatch: { startedAt: null, accumulatedMs: 0 } }));
  const toggleTimer = () =>
    update((prev) => {
      const t = prev.timer;
      if (t.endsAt !== null) return { ...prev, timer: { endsAt: null, remainingMs: Math.max(0, t.endsAt - Date.now()) } };
      if (t.remainingMs <= 0) return prev;
      return { ...prev, timer: { ...t, endsAt: Date.now() + t.remainingMs } };
    });
  const shortenTimer = () =>
    update((prev) => {
      const t = prev.timer;
      if (t.endsAt !== null) return { ...prev, timer: { ...t, endsAt: Math.max(Date.now(), t.endsAt - 60000) } };
      return { ...prev, timer: { ...t, remainingMs: Math.max(0, t.remainingMs - 60000) } };
    });
  const setCount = (change: (value: number) => number) => update((prev) => ({ ...prev, count: change(prev.count) }));

  return (
    <View className="gap-3 rounded-card border border-line bg-surface p-4">
      {showStopwatch ? (
        <ToolRow first label={stopwatchLabel} value={format(elapsed)}>
          <IconButton
            icon={stopwatchRunning ? 'pause' : 'play'}
            onPress={() => setStopwatchRunning(!stopwatchRunning)}
            tone="primary"
          />
          <IconButton
            icon="stop"
            onPress={resetStopwatch}
          />
        </ToolRow>
      ) : null}
      {showTimer ? (
        <ToolRow first={!showStopwatch} label={timerLabel} value={format(remaining)}>
          <IconButton
            icon="minus"
            onPress={shortenTimer}
          />
          <IconButton
            icon={timerRunning ? 'pause' : 'play'}
            onPress={toggleTimer}
            tone="primary"
          />
        </ToolRow>
      ) : null}
      {showCounter ? (
        <ToolRow first={!showStopwatch && !showTimer} label={counterLabel} value={String(count)}>
          <IconButton
            icon="minus"
            onPress={() => setCount((value) => Math.max(0, value - counterStep))}
          />
          <IconButton
            icon="plus"
            onPress={() => setCount((value) => value + counterStep)}
            tone="primary"
          />
        </ToolRow>
      ) : null}
    </View>
  );
}
