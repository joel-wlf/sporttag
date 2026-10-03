import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Screen } from '@/components/layout/Screen';
import { ActionBar } from '@/components/station/ActionBar';
import { SyncButton } from '@/components/station/ContextBar';
import { MissingPackage } from '@/components/station/MissingPackage';
import type { ButtonProps } from '@/components/ui/Button';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { Icon } from '@/components/ui/Icon';
import { useTokens } from '@/components/ui/theme';
import { haptic } from '@/lib/haptics';
import {
  blockLabel,
  blockNumber,
  entryState,
  findDayEntry,
  formatTime,
  type EntryState,
} from '@/lib/station/package';
import type { DayEntry } from '@/lib/station/types';
import { useStationSession } from '@/providers/StationSessionProvider';

type Assignment = Extract<DayEntry, { kind: 'assignment' }>;

const entryRowLabel = (entry: DayEntry) => {
  if (entry.kind === 'assignment') return entry.station.name;
  if (entry.kind === 'off') return 'Kein Einsatz';
  return 'Pause';
};

/**
 * Welcher Eintrag oben groß steht und worauf die Hauptaktion wirkt. Keine
 * versteckte Auswahl: der Tagesplan zeigt immer, was jetzt zu tun ist.
 *
 * 1. Ein laufender Check-in, solange sein Block nicht vorbei ist.
 * 2. Sonst die Station im aktuellen Block.
 * 3. Sonst ein liegengebliebener Check-in (Erinnerung zum Auschecken).
 * 4. Sonst der aktuelle Block (Pause, kein Einsatz) oder der nächste Einsatz.
 */
function pickHero(entries: DayEntry[], active: DayEntry | undefined, now: Date) {
  if (active && entryState(active, now) !== 'past') return active;
  const current = entries.find((entry) => entryState(entry, now) === 'now');
  if (current?.kind === 'assignment') return current;
  if (active) return active;
  const next = entries.find(
    (entry) => entry.kind === 'assignment' && entryState(entry, now) === 'future',
  );
  return current ?? next ?? entries[entries.length - 1];
}

function HeroCard({
  entry,
  state,
  checkedIn,
  otherCheckinName,
  nextAssignment,
  timezone,
}: {
  entry: DayEntry;
  state: EntryState;
  checkedIn: boolean;
  otherCheckinName?: string;
  nextAssignment?: Assignment;
  timezone: string;
}) {
  const tokens = useTokens();
  const blocks = useStationSession().pkg?.blocks ?? [];
  const time = `geplant ca. ${formatTime(entry.block.starts_at, timezone)}–${formatTime(entry.block.ends_at, timezone)}`;
  const eyebrow = checkedIn
    ? 'EINGECHECKT'
    : entry.kind !== 'assignment'
      ? state === 'now'
        ? entry.kind === 'break'
          ? 'JETZT PAUSE'
          : 'JETZT KEIN EINSATZ'
        : 'HEUTE'
      : state === 'now'
        ? 'JETZT'
        : state === 'future'
          ? 'ALS NÄCHSTES'
          : 'VORBEI';

  return (
    <View
      className={[
        'gap-3 rounded-sheet p-5',
        checkedIn
          ? 'bg-primary'
          : entry.kind === 'assignment'
            ? 'border-2 border-primary bg-surface'
            : 'border border-line bg-surface-muted',
      ].join(' ')}
    >
      <View className="flex-row items-center gap-2">
        {checkedIn ? <Icon color={tokens.onPrimary} name="check-circle" size={14} /> : null}
        <Text
          className={[
            'text-2xs font-black tracking-[0.8px]',
            checkedIn ? 'text-on-primary' : 'text-primary',
          ].join(' ')}
        >
          {eyebrow} · {blockLabel(entry.block, blocks).toUpperCase()}
        </Text>
      </View>

      {entry.kind === 'assignment' ? (
        <View className="gap-1">
          <Text
            accessibilityRole="header"
            className={[
              'text-2xl font-extrabold tracking-[-0.5px]',
              checkedIn ? 'text-on-primary' : 'text-ink',
            ].join(' ')}
          >
            {entry.station.name}
          </Text>
          <Text
            className={['text-base font-semibold', checkedIn ? 'text-on-primary' : 'text-ink'].join(
              ' ',
            )}
          >
            {entry.game.name}
          </Text>
          <Text className={['text-xs', checkedIn ? 'text-on-primary' : 'text-subtle'].join(' ')}>
            {time}
          </Text>
          {entry.station.arrival_notes && !checkedIn ? (
            <View className="mt-2 flex-row items-start gap-2">
              <Icon color={tokens.subtle} name="map-pin" size={14} />
              <Text className="flex-1 text-sm leading-5 text-subtle">
                {entry.station.arrival_notes}
              </Text>
            </View>
          ) : null}
          {otherCheckinName && !checkedIn ? (
            <View className="mt-2 flex-row items-start gap-2 rounded-control bg-warning-soft px-3 py-2">
              <Icon color={tokens.warning} name="alert" size={14} />
              <Text className="flex-1 text-xs font-semibold leading-5 text-warning">
                Noch bei {otherCheckinName} eingecheckt. Beim Wechsel wird das beendet.
              </Text>
            </View>
          ) : null}
        </View>
      ) : (
        <View className="gap-1">
          <Text
            accessibilityRole="header"
            className="text-2xl font-extrabold tracking-[-0.5px] text-ink"
          >
            {entry.kind === 'break' ? 'Pause' : 'Kein Einsatz'}
          </Text>
          <Text className="text-xs text-subtle">{time}</Text>
          {nextAssignment ? (
            <Text className="mt-1 text-sm text-subtle">
              Danach: {nextAssignment.station.name} ab ca.{' '}
              {formatTime(nextAssignment.block.starts_at, timezone)}
            </Text>
          ) : (
            <Text className="mt-1 text-sm text-subtle">
              Heute ist kein weiterer Einsatz geplant.
            </Text>
          )}
        </View>
      )}
    </View>
  );
}

export default function StationDayScreen() {
  const router = useRouter();
  const tokens = useTokens();
  const { pkg, staffName, entries, checkedInEntryId, activeCheckin } = useStationSession();
  const [now, setNow] = useState(() => new Date());
  const timezone = pkg?.event.timezone ?? 'Europe/Berlin';

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 30000);
    return () => clearInterval(id);
  }, []);

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

  const active = findDayEntry(entries, checkedInEntryId);
  // Ein Check-in an einer Belegung, die nicht im eigenen Plan steht (z. B.
  // nach einem Personenwechsel), zählt trotzdem als "woanders eingecheckt".
  const activeElsewhereName = activeCheckin
    ? active?.kind === 'assignment'
      ? active.station.name
      : pkg?.stations.find((s) =>
          pkg.station_setups.some(
            (su) => su.id === activeCheckin.stationSetupId && su.station_id === s.id,
          ),
        )?.name
    : undefined;

  const hero = pickHero(entries, active, now);
  const heroState = entryState(hero, now);
  const heroCheckedIn = hero.id === checkedInEntryId;
  const nextAssignment = entries.find(
    (entry): entry is Assignment =>
      entry.kind === 'assignment' && entry.id !== hero.id && entryState(entry, now) !== 'past',
  );

  // "Zur Station" öffnet nur den Tab "Station" für diesen Einsatz; ein- und
  // ausgecheckt wird dort in der Stationskarte, nicht hier.
  const openStation = (entry: Assignment) =>
    router.navigate({ pathname: '/cockpit', params: { setupId: entry.setupId } });

  // Eine Hauptaktion nur, wenn es etwas zu tun gibt: in Pausen und nach dem
  // letzten Einsatz bleibt die Leiste leer, statt einen toten Knopf zu zeigen.
  const primary: ButtonProps | undefined =
    hero.kind === 'assignment'
      ? { label: 'Zur Station', rightIcon: 'chevron-right', onPress: () => openStation(hero) }
      : undefined;

  return (
    <Screen
      density="compact"
      footer={primary ? <ActionBar primary={primary} /> : undefined}
      size="narrow"
    >
      <View className="flex-row items-center justify-between gap-3">
        <View className="min-w-0 flex-1">
          <Text accessibilityRole="header" className="text-xl font-extrabold text-ink">
            Heute
          </Text>
          <Pressable
            accessibilityHint="Öffnet die Personenwahl"
            accessibilityLabel={`Angemeldet als ${staffName ?? 'unbekannt'}. Person wechseln`}
            accessibilityRole="button"
            className="min-h-[32px] flex-row items-center gap-1 self-start active:opacity-60"
            onPress={() => router.push('/who')}
          >
            <Text className="text-sm font-semibold text-subtle">
              {staffName ?? 'Person wählen'}
            </Text>
            <Icon color={tokens.subtle} name="chevron-down" size={14} />
          </Pressable>
        </View>
        <SyncButton />
      </View>

      <HeroCard
        checkedIn={heroCheckedIn}
        entry={hero}
        nextAssignment={nextAssignment}
        otherCheckinName={!heroCheckedIn ? activeElsewhereName : undefined}
        state={heroState}
        timezone={timezone}
      />

      <View className="gap-1">
        <Text className="px-1 pb-1 text-xs font-extrabold uppercase tracking-[0.5px] text-subtle">
          Tagesplan
        </Text>
        {entries.map((entry) => {
          const state = entryState(entry, now);
          const isActive = entry.id === checkedInEntryId;
          const isHero = entry.id === hero.id;
          const isAssignment = entry.kind === 'assignment';
          const muted = state === 'past' && !isActive;
          const content = (
            <>
              <View className="w-12">
                <Text
                  className={[
                    'text-xs font-bold',
                    state === 'now' ? 'text-primary' : muted ? 'text-subtle' : 'text-ink',
                  ].join(' ')}
                >
                  {formatTime(entry.block.starts_at, timezone)}
                </Text>
                <Text className="text-2xs text-subtle">{entry.block.kind === 'break' ? 'Pause' : `Bl. ${blockNumber(entry.block, pkg?.blocks ?? [])}`}</Text>
              </View>
              <View className="min-w-0 flex-1">
                <Text
                  className={[
                    'text-sm',
                    isAssignment ? 'font-bold' : '',
                    isAssignment && !muted ? 'text-ink' : 'text-subtle',
                  ].join(' ')}
                  numberOfLines={1}
                >
                  {entryRowLabel(entry)}
                </Text>
                {entry.kind === 'assignment' ? (
                  <Text className="text-xs text-subtle" numberOfLines={1}>
                    {entry.game.name}
                    {state === 'past' && !isActive ? ' · vorbei' : ''}
                  </Text>
                ) : null}
              </View>
              {isActive ? (
                <Icon color={tokens.success} name="check-circle" size={18} />
              ) : state === 'now' ? (
                <Text className="text-2xs font-black tracking-[0.5px] text-primary">JETZT</Text>
              ) : null}
              {isAssignment ? <Icon color={tokens.subtle} name="chevron-right" size={16} /> : null}
            </>
          );
          const rowClass = [
            'min-h-[56px] flex-row items-center gap-3 rounded-control px-3 py-2.5',
            isHero ? 'bg-surface-muted' : '',
          ].join(' ');

          if (entry.kind !== 'assignment') {
            return (
              <View className={rowClass} key={entry.id}>
                {content}
              </View>
            );
          }
          return (
            <Pressable
              accessibilityHint="Öffnet die Station"
              accessibilityLabel={`${formatTime(entry.block.starts_at, timezone)}, ${blockLabel(entry.block, pkg?.blocks ?? [])}, ${entry.station.name}, ${entry.game.name}${isActive ? ', eingecheckt' : state === 'now' ? ', jetzt' : state === 'past' ? ', vorbei' : ''}`}
              accessibilityRole="button"
              className={[rowClass, 'active:bg-primary-soft'].join(' ')}
              key={entry.id}
              onPress={() => {
                haptic('selection');
                openStation(entry);
              }}
            >
              {content}
            </Pressable>
          );
        })}
      </View>
    </Screen>
  );
}
