import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Pressable,
  ScrollView,
  Text,
  View,
  type LayoutChangeEvent,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import { Screen } from '@/components/layout/Screen';
import { ActionBar } from '@/components/station/ActionBar';
import { MissingPackage } from '@/components/station/MissingPackage';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { Icon } from '@/components/ui/Icon';
import { useTokens } from '@/components/ui/theme';
import { haptic } from '@/lib/haptics';
import { blockKindLabels, blockLabel, entryState, findDayEntry, formatTime, type EntryState } from '@/lib/station/package';
import type { DayEntry } from '@/lib/station/types';
import { useStationSession } from '@/providers/StationSessionProvider';

const GAP = 12;

const entryRowLabel = (entry: DayEntry) => {
  if (entry.kind === 'assignment') return `${entry.station.name} · ${entry.game.name}`;
  if (entry.kind === 'off') return `${blockLabel(entry.block)} · Kein Einsatz`;
  return blockLabel(entry.block);
};

function DayCard({
  entry,
  state,
  checkedIn,
  width,
  timezone,
}: {
  entry: DayEntry;
  state: EntryState;
  checkedIn: boolean;
  width: number;
  timezone: string;
}) {
  const tokens = useTokens();
  const isAssignment = entry.kind === 'assignment';

  const surface = checkedIn
    ? 'bg-primary'
    : state === 'now' && isAssignment
      ? 'border-2 border-primary bg-surface'
      : isAssignment
        ? 'border border-line bg-surface'
        : 'border border-line bg-surface-muted';

  const ink = checkedIn ? 'text-on-primary' : 'text-ink';
  const sub = checkedIn ? 'text-on-primary/80' : 'text-subtle';
  const stateChip = checkedIn
    ? 'bg-on-primary/20 text-on-primary'
    : state === 'now'
      ? 'bg-primary-soft text-primary'
      : 'bg-surface-muted text-subtle';

  return (
    <View
      className={['justify-between rounded-sheet p-5', surface, state === 'past' && !checkedIn ? 'opacity-60' : ''].join(
        ' ',
      )}
      style={{ width, minHeight: 190 }}
    >
      <View className="flex-row items-start justify-between gap-2">
        {state === 'future' ? (
          <View />
        ) : (
          <Text
            className={['rounded-full px-2.5 py-1 text-2xs font-black tracking-[0.8px]', stateChip].join(' ')}
          >
            {state === 'now' ? 'JETZT' : 'VORBEI'}
          </Text>
        )}
        {checkedIn ? (
          <View className="flex-row items-center gap-1.5 rounded-full bg-on-primary/20 px-2.5 py-1">
            <Icon color={tokens.onPrimary} name="check-circle" size={13} />
            <Text className="text-2xs font-black tracking-[0.5px] text-on-primary">EINGECHECKT</Text>
          </View>
        ) : null}
      </View>

      <View className="gap-2">
        {/* Der Block ist die verbindliche Einheit: er startet gemeinsam. Die
            Uhrzeit darunter ist nur der Plan — sie verschiebt sich im Lauf des
            Tages und steht deshalb bewusst klein. */}
        <View className="flex-row items-baseline gap-2">
          <Text className={['text-stat font-extrabold leading-[44px] tracking-[-1px]', ink].join(' ')}>
            {entry.block.position}
          </Text>
          <Text className={['text-sm font-bold', sub].join(' ')} numberOfLines={1}>
            {blockKindLabels[entry.block.kind]}
          </Text>
        </View>
        <View className="gap-0.5">
          <Text className={['text-lg font-extrabold', ink].join(' ')} numberOfLines={1}>
            {isAssignment ? entry.station.name : blockLabel(entry.block)}
          </Text>
          {entry.kind === 'assignment' ? (
            <Text className={['text-sm', sub].join(' ')} numberOfLines={1}>
              {entry.game.name}
            </Text>
          ) : entry.kind === 'off' ? (
            <Text className={['text-sm', sub].join(' ')} numberOfLines={1}>
              Kein Einsatz
            </Text>
          ) : null}
          <Text className={['text-2xs', sub].join(' ')} numberOfLines={1}>
            geplant ca. {formatTime(entry.block.starts_at, timezone)}–{formatTime(entry.block.ends_at, timezone)}
          </Text>
        </View>
      </View>
    </View>
  );
}

export default function StationDayScreen() {
  const router = useRouter();
  const tokens = useTokens();
  const { pkg, staffName, entries, checkedInEntryId, checkOut, syncCounts } = useStationSession();
  const scrollRef = useRef<ScrollView>(null);
  const positioned = useRef(false);
  const [width, setWidth] = useState(0);
  const [now, setNow] = useState(() => new Date());
  const timezone = pkg?.event.timezone ?? 'Europe/Berlin';

  const [index, setIndex] = useState(() => {
    const checkedIndex = entries.findIndex((entry) => entry.id === checkedInEntryId);
    if (checkedIndex >= 0) return checkedIndex;
    const currentIndex = entries.findIndex((entry) => entryState(entry, new Date()) === 'now');
    if (currentIndex >= 0) return currentIndex;
    const nextIndex = entries.findIndex((entry) => entryState(entry, new Date()) === 'future');
    return nextIndex >= 0 ? nextIndex : Math.max(0, entries.length - 1);
  });

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 30000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (!width || positioned.current || entries.length === 0) return;
    positioned.current = true;
    scrollRef.current?.scrollTo({ x: index * (width + GAP), animated: false });
  }, [width, index, entries.length]);

  useFocusEffect(
    useCallback(() => {
      if (width) scrollRef.current?.scrollTo({ x: index * (width + GAP), animated: false });
    }, [width, index]),
  );

  if (entries.length === 0) {
    return (
      <Screen density="compact" size="narrow">
        {!pkg ? (
          <MissingPackage title="Kein Tagesplan" />
        ) : (
          <EmptyState
            action={<Button label="Person wechseln" onPress={() => router.push('/who')} />}
            description="Für diese Person ist heute kein Block geplant."
            icon="clock"
            title="Kein Einsatz geplant"
          />
        )}
      </Screen>
    );
  }

  const select = (next: number) => {
    setIndex(next);
    haptic('selection');
    if (width) scrollRef.current?.scrollTo({ x: next * (width + GAP), animated: true });
  };

  const onLayout = (event: LayoutChangeEvent) => setWidth(event.nativeEvent.layout.width);

  const onMomentumEnd = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (!width) return;
    const next = Math.round(event.nativeEvent.contentOffset.x / (width + GAP));
    if (next !== index) setIndex(next);
  };

  const selected = entries[index];
  const activeEntry = findDayEntry(entries, checkedInEntryId);
  const selectedIsActive = checkedInEntryId === selected.id;

  const goToMap = (entry: DayEntry) => {
    if (entry.kind !== 'assignment') return;
    router.push({
      pathname: '/map',
      params: { setupId: entry.setupId, station: entry.station.name, block: blockLabel(entry.block), game: entry.game.name },
    });
  };

  const goToCockpit = (entry: DayEntry) => {
    if (entry.kind !== 'assignment') return;
    router.push({
      pathname: '/cockpit',
      params: { setupId: entry.setupId, station: entry.station.name, block: blockLabel(entry.block), game: entry.game.name },
    });
  };

  const nextAssignment = entries.findIndex((entry) => entry.kind === 'assignment' && entryState(entry, now) !== 'past');

  const action = selectedIsActive
    ? {
        primary: {
          label: 'Zum Cockpit',
          rightIcon: 'chevron-right' as const,
          onPress: () => goToCockpit(selected),
        },
        secondary: { label: 'Auschecken', haptic: 'warning' as const, onPress: () => void checkOut() },
      }
    : selected.kind === 'assignment'
      ? {
          primary: {
            label: 'Zur Station',
            rightIcon: 'chevron-right' as const,
            onPress: () => goToMap(selected),
          },
        }
      : activeEntry
        ? {
            primary: {
              label: 'Zum Cockpit',
              rightIcon: 'chevron-right' as const,
              onPress: () => goToCockpit(activeEntry),
            },
          }
        : {
            primary: {
              label: 'Nächster Einsatz',
              rightIcon: 'chevron-right' as const,
              isDisabled: nextAssignment < 0,
              onPress: () => select(nextAssignment),
            },
          };

  return (
    <Screen density="compact" footer={<ActionBar {...action} />} size="narrow">
      <View className="flex-row items-center justify-between gap-3">
        <Pressable
          accessibilityLabel="Person wechseln"
          accessibilityRole="button"
          className="flex-row items-center gap-1 active:opacity-60"
          onPress={() => router.push('/who')}
        >
          <Text className="text-sm font-semibold text-subtle">{staffName ?? 'Tagesplan'}</Text>
          <Icon color={tokens.subtle} name="chevron-down" size={14} />
        </Pressable>
        <View className="flex-row items-center gap-2">
          {syncCounts.pending + syncCounts.sending > 0 ? (
            <Pressable
              accessibilityLabel={`${syncCounts.pending + syncCounts.sending} Ergebnisse warten auf Übertragung`}
              accessibilityRole="button"
              className="flex-row items-center gap-1.5 rounded-full bg-warning-soft px-2.5 py-1 active:opacity-70"
              onPress={() => router.push('/cockpit/sync')}
            >
              <Icon color={tokens.warning} name="wifi-off" size={13} />
              <Text className="text-2xs font-bold text-warning">{syncCounts.pending + syncCounts.sending}</Text>
            </Pressable>
          ) : null}
          {activeEntry ? (
            <Pressable
              accessibilityLabel={`Eingecheckt in ${blockLabel(activeEntry.block)}, anzeigen`}
              accessibilityRole="button"
              className="flex-row items-center gap-1.5 rounded-full bg-success-soft px-2.5 py-1 active:opacity-70"
              onPress={() => select(entries.findIndex((entry) => entry.id === activeEntry.id))}
            >
              <Icon color={tokens.success} name="check-circle" size={13} />
              <Text className="text-2xs font-bold text-success">{blockLabel(activeEntry.block)}</Text>
            </Pressable>
          ) : null}
        </View>
      </View>

      <ScrollView
        contentContainerStyle={{ gap: GAP, alignItems: 'flex-start' }}
        decelerationRate="fast"
        horizontal
        onLayout={onLayout}
        onMomentumScrollEnd={onMomentumEnd}
        ref={scrollRef}
        showsHorizontalScrollIndicator={false}
        snapToInterval={width ? width + GAP : undefined}
        style={{ flexGrow: 0 }}
      >
        {width
          ? entries.map((entry) => (
              <DayCard
                checkedIn={checkedInEntryId === entry.id}
                entry={entry}
                key={entry.id}
                state={entryState(entry, now)}
                timezone={timezone}
                width={width}
              />
            ))
          : null}
      </ScrollView>

      <View className="flex-row justify-center gap-1.5">
        {entries.map((entry, position) => (
          <View
            className={[
              'h-1.5 rounded-full',
              position === index ? 'w-5 bg-primary' : 'w-1.5 bg-line',
            ].join(' ')}
            key={entry.id}
          />
        ))}
      </View>

      <View className="gap-0.5">
        {entries.map((entry, position) => {
          const state = entryState(entry, now);
          const isSelected = position === index;
          const isActive = checkedInEntryId === entry.id;
          return (
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ selected: isSelected }}
              className={[
                'flex-row items-center gap-3 rounded-control px-3 py-2.5 active:opacity-70',
                isSelected ? 'bg-surface-muted' : '',
                state === 'past' && !isActive ? 'opacity-50' : '',
              ].join(' ')}
              key={entry.id}
              onPress={() => select(position)}
            >
              <View className="w-11">
                <Text className={['text-xs font-bold', state === 'now' ? 'text-primary' : 'text-ink'].join(' ')}>
                  Bl. {entry.block.position}
                </Text>
                <Text className="text-2xs text-subtle">{formatTime(entry.block.starts_at, timezone)}</Text>
              </View>
              <Text
                className={[
                  'flex-1 text-sm',
                  entry.kind === 'assignment' ? 'font-bold text-ink' : 'text-subtle',
                ].join(' ')}
                numberOfLines={1}
              >
                {entryRowLabel(entry)}
              </Text>
              {isActive ? (
                <Icon color={tokens.success} name="check-circle" size={16} />
              ) : state === 'now' ? (
                <View className="h-2 w-2 rounded-full bg-primary" />
              ) : null}
            </Pressable>
          );
        })}
      </View>
    </Screen>
  );
}
