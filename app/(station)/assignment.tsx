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
import {
  dayPlan,
  entryState,
  findDayEntry,
  type DayEntry,
  type EntryState,
} from '@/components/station/demoData';
import { Icon } from '@/components/ui/Icon';
import { useTokens } from '@/components/ui/theme';
import { haptic } from '@/lib/haptics';
import { useStationSession } from '@/providers/StationSessionProvider';

const GAP = 12;

const entryTitle = (entry: DayEntry) =>
  entry.kind === 'assignment' ? `${entry.block} · ${entry.station}` : entry.block;

const entryRowLabel = (entry: DayEntry) => {
  if (entry.kind === 'assignment') return `${entry.station} · ${entry.game}`;
  if (entry.kind === 'off') return `${entry.block} · Kein Einsatz`;
  return entry.block;
};

const entrySubtitle = (entry: DayEntry) => {
  if (entry.kind === 'assignment') return `${entry.game} · ${entry.groups} Gruppen`;
  if (entry.kind === 'off') return 'Kein Einsatz';
  return undefined;
};

function DayCard({
  entry,
  state,
  checkedIn,
  width,
}: {
  entry: DayEntry;
  state: EntryState;
  checkedIn: boolean;
  width: number;
}) {
  const tokens = useTokens();
  const isAssignment = entry.kind === 'assignment';
  const subtitle = entrySubtitle(entry);

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
        <View className="flex-row items-baseline gap-2">
          <Text className={['text-stat font-extrabold leading-[44px] tracking-[-1px]', ink].join(' ')}>
            {entry.start}
          </Text>
          <Text className={['text-sm font-semibold', sub].join(' ')}>bis {entry.end}</Text>
        </View>
        <View className="gap-0.5">
          <Text className={['text-lg font-extrabold', ink].join(' ')} numberOfLines={1}>
            {entryTitle(entry)}
          </Text>
          {subtitle ? (
            <Text className={['text-sm', sub].join(' ')} numberOfLines={1}>
              {subtitle}
            </Text>
          ) : null}
        </View>
      </View>
    </View>
  );
}

export default function StationDayScreen() {
  const router = useRouter();
  const tokens = useTokens();
  const { staffName, checkedInId, checkOut } = useStationSession();
  const scrollRef = useRef<ScrollView>(null);
  const positioned = useRef(false);
  const [width, setWidth] = useState(0);
  const [nowMinutes, setNowMinutes] = useState(() => {
    const now = new Date();
    return now.getHours() * 60 + now.getMinutes();
  });

  const [index, setIndex] = useState(() => {
    const checkedIndex = dayPlan.findIndex((entry) => entry.id === checkedInId);
    if (checkedIndex >= 0) return checkedIndex;
    const start = new Date();
    const minutes = start.getHours() * 60 + start.getMinutes();
    const currentIndex = dayPlan.findIndex((entry) => entryState(entry, minutes) === 'now');
    if (currentIndex >= 0) return currentIndex;
    const nextIndex = dayPlan.findIndex((entry) => entryState(entry, minutes) === 'future');
    return nextIndex >= 0 ? nextIndex : dayPlan.length - 1;
  });

  useEffect(() => {
    const id = setInterval(() => {
      const now = new Date();
      setNowMinutes(now.getHours() * 60 + now.getMinutes());
    }, 30000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (!width || positioned.current) return;
    positioned.current = true;
    scrollRef.current?.scrollTo({ x: index * (width + GAP), animated: false });
  }, [width, index]);

  // Beim Zurückkehren auf den Screen verliert die Liste ihre Scrollposition.
  useFocusEffect(
    useCallback(() => {
      if (width) scrollRef.current?.scrollTo({ x: index * (width + GAP), animated: false });
    }, [width, index]),
  );

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

  const selected = dayPlan[index];
  const activeEntry = findDayEntry(checkedInId);
  const selectedIsActive = checkedInId === selected.id;

  const goToMap = (entry: DayEntry) => {
    if (entry.kind !== 'assignment') return;
    router.push({
      pathname: '/map',
      params: {
        station: entry.station,
        block: entry.block,
        game: entry.game,
        entryId: entry.id,
      },
    });
  };

  const goToCockpit = (entry: DayEntry) => {
    if (entry.kind !== 'assignment') return;
    router.push({
      pathname: '/cockpit',
      params: { station: entry.station, block: entry.block, game: entry.game },
    });
  };

  const nextAssignment = dayPlan.findIndex(
    (entry) => entry.kind === 'assignment' && entryState(entry, nowMinutes) !== 'past',
  );

  const action = selectedIsActive
    ? {
        primary: {
          label: 'Zum Cockpit',
          rightIcon: 'chevron-right' as const,
          onPress: () => goToCockpit(selected),
        },
        secondary: { label: 'Auschecken', haptic: 'warning' as const, onPress: checkOut },
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
        {activeEntry ? (
          <Pressable
            accessibilityLabel={`Eingecheckt in ${activeEntry.block}, anzeigen`}
            accessibilityRole="button"
            className="flex-row items-center gap-1.5 rounded-full bg-success-soft px-2.5 py-1 active:opacity-70"
            onPress={() => select(dayPlan.findIndex((entry) => entry.id === activeEntry.id))}
          >
            <Icon color={tokens.success} name="check-circle" size={13} />
            <Text className="text-2xs font-bold text-success">{activeEntry.block}</Text>
          </Pressable>
        ) : null}
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
          ? dayPlan.map((entry) => (
              <DayCard
                checkedIn={checkedInId === entry.id}
                entry={entry}
                key={entry.id}
                state={entryState(entry, nowMinutes)}
                width={width}
              />
            ))
          : null}
      </ScrollView>

      <View className="flex-row justify-center gap-1.5">
        {dayPlan.map((entry, position) => (
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
        {dayPlan.map((entry, position) => {
          const state = entryState(entry, nowMinutes);
          const isSelected = position === index;
          const isActive = checkedInId === entry.id;
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
              <Text
                className={[
                  'w-11 text-xs font-bold',
                  state === 'now' ? 'text-primary' : 'text-subtle',
                ].join(' ')}
              >
                {entry.start}
              </Text>
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
