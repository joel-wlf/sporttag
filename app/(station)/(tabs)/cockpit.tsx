import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Screen } from '@/components/layout/Screen';
import { ContextBar } from '@/components/station/ContextBar';
import { MissingPackage } from '@/components/station/MissingPackage';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { Icon, type IconName } from '@/components/ui/Icon';
import { useTokens } from '@/components/ui/theme';
import { haptic } from '@/lib/haptics';
import { useMatchLiveActivity } from '@/lib/live/useMatchLiveActivity';
import {
  blockLabel,
  entryState,
  formatTime,
  gameForSetup,
  matchesForSetup,
  stationForSetup,
  isResultWithdrawn,
  matchTeamsLabel,
} from '@/lib/station/package';
import { useStationSession } from '@/providers/StationSessionProvider';

/**
 * Der Tab "Station": der eine Ort für eine Station. Oben die Stationskarte
 * mit Lage und Check-in, darunter die Runden. Solange dieses Gerät hier nicht
 * eingecheckt ist, sind die Runden grau und gesperrt; Auschecken sitzt unten.
 *
 * Welche Station gezeigt wird: die aus dem Tagesplan gewählte (`setupId`),
 * sonst die eingecheckte, sonst der eigene Einsatz im aktuellen Block.
 */
export default function StationScreen() {
  const router = useRouter();
  const tokens = useTokens();
  const params = useLocalSearchParams<{ setupId?: string }>();
  const { pkg, entries, activeCheckin, matchSync, liveStates, checkIn, checkOut } = useStationSession();
  const [busy, setBusy] = useState(false);
  // Eigene Uhr: ohne sie rückten "Jetzt dran" und "Ergebnis fehlt" erst beim
  // nächsten zufälligen Re-Render in die nächste Runde weiter.
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 30000);
    return () => clearInterval(id);
  }, []);

  const currentAssignment = entries.find(
    (entry) => entry.kind === 'assignment' && entryState(entry, now) === 'now',
  );
  const setupId =
    params.setupId ??
    activeCheckin?.stationSetupId ??
    (currentAssignment?.kind === 'assignment' ? currentAssignment.setupId : undefined);
  const setup = setupId ? pkg?.station_setups.find((s) => s.id === setupId) : undefined;
  const stationRow = setup && pkg ? stationForSetup(pkg, setup) : undefined;
  const gameRow = setup && pkg ? gameForSetup(pkg, setup) : undefined;
  const blockRow = setup ? pkg?.blocks.find((b) => b.id === setup.block_id) : undefined;
  const block = blockRow ? blockLabel(blockRow, pkg?.blocks ?? []) : undefined;
  const timezone = pkg?.event.timezone ?? 'Europe/Berlin';

  const checkedInHere = Boolean(setupId && activeCheckin?.stationSetupId === setupId);
  const otherSetup =
    activeCheckin && !checkedInHere
      ? pkg?.station_setups.find((s) => s.id === activeCheckin.stationSetupId)
      : undefined;
  const otherStation = otherSetup && pkg ? stationForSetup(pkg, otherSetup) : undefined;

  const matches =
    pkg && setupId
      ? matchesForSetup(pkg, setupId).map((m) => ({
          match: m,
          round: pkg.rounds.find((r) => r.id === m.round_id),
        }))
      : [];

  // Ein fertiges oder abgesagtes Match "läuft" nicht, auch wenn seine
  // geplante Runde gerade noch andauert. Auf diesem Gerät schon abgegeben
  // gilt hier als erledigt, auch bevor der Server den Matchstatus nachzieht.
  // Eine eigene Abgabe zählt als erledigt — außer die Leitung hat das
  // Ergebnis inzwischen zurückgezogen.
  const settledHere = (match: (typeof matches)[number]['match']) =>
    Boolean(matchSync[match.id]) && !(pkg && isResultWithdrawn(pkg, match));
  const running = matches.find(
    ({ match, round }) =>
      !settledHere(match) &&
      (match.status === 'in_progress' ||
        ((match.status === 'scheduled' || match.status === 'ready') &&
          round !== undefined &&
          new Date(round.starts_at) <= now &&
          now < new Date(round.ends_at))),
  );
  // Läuft gerade nichts, steht das nächste offene Match oben.
  const upcoming = running
    ? undefined
    : matches.find(
        ({ match, round }) =>
          !settledHere(match) &&
          (match.status === 'scheduled' || match.status === 'ready') &&
          round !== undefined &&
          new Date(round.starts_at) > now,
      );
  const hero = checkedInHere ? (running ?? upcoming) : undefined;

  const matchScore = (matchId: string) => {
    if (!pkg || !gameRow || gameRow.measurement_type !== 'number') return null;
    const match = pkg.matches.find((m) => m.id === matchId);
    if (!match) return null;
    const accepted = pkg.current_result_values.filter(
      (v) => v.match_id === matchId && v.version === match.current_result_version,
    );
    // Solange kein Ergebnis angenommen ist, zählt der mitlaufende Live-Stand
    // (auch für die Live Activity: ein laufendes Match hat nie ein
    // angenommenes Ergebnis, der Sperrbildschirm blieb sonst leer).
    const values: { participant_id: string; measured_value?: number | null }[] =
      accepted.length > 0 ? accepted : (liveStates[matchId]?.values ?? []);
    if (values.length === 0) return null;
    const format = (value: number | null | undefined) =>
      value == null ? '–' : String(Math.round(Number(value) * 100) / 100).replace('.', ',');
    return match.participants
      .map((p) => format(values.find((v) => v.participant_id === p.id)?.measured_value))
      .join(' : ');
  };

  // Hooks vor jedem frühen Return: sonst ändert sich ihre Reihenfolge, sobald
  // das Paket nachgeladen oder eine Station gewählt wird, und React stürzt ab.
  useMatchLiveActivity(
    checkedInHere && running && pkg
      ? {
          matchId: running.match.id,
          gameName: gameRow?.name ?? '',
          teamsLabel: matchTeamsLabel(pkg, running.match),
          scoreLabel: matchScore(running.match.id),
          roundEndsAt: running.round?.ends_at ?? null,
        }
      : null,
  );

  if (!pkg) {
    return (
      <Screen density="compact">
        <MissingPackage />
      </Screen>
    );
  }

  if (!setupId || !setup) {
    return (
      <Screen density="compact">
        <EmptyState
          action={<Button label="Zum Tagesplan" onPress={() => router.navigate('/assignment')} />}
          description="Gerade ist für dich keine Station geplant. Im Tagesplan siehst du deine nächsten Einsätze."
          icon="flag"
          title="Keine Station"
        />
      </Screen>
    );
  }

  const doCheckIn = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await checkIn(setupId);
      haptic('success');
    } finally {
      setBusy(false);
    }
  };

  /**
   * Zustand je Match aus Sicht dieses Geräts: eigene Abgabe (gesichert,
   * übertragen, Klärung) vor dem Serverstatus. Immer mit Text, nie nur Farbe.
   */
  const matchState = (
    matchId: string,
    status: string,
    roundEndsAt?: string,
  ): { label: string; icon: IconName; color: string } | null => {
    const local = matchSync[matchId];
    if (status === 'cancelled') return { label: 'Abgesagt', icon: 'close', color: tokens.subtle };
    const pkgMatch = pkg.matches.find((m) => m.id === matchId);
    if (pkgMatch && isResultWithdrawn(pkg, pkgMatch))
      return { label: 'Zurückgezogen – neu erfassen', icon: 'alert', color: tokens.warning };
    if (local?.status === 'review')
      return { label: 'Klärung nötig', icon: 'alert', color: tokens.danger };
    if (local?.status === 'pending')
      return { label: 'Auf Gerät gesichert', icon: 'clock', color: tokens.warning };
    if (local?.status === 'synced')
      return { label: 'Übertragen', icon: 'check-circle', color: tokens.success };
    if (status === 'completed')
      return { label: 'Erfasst', icon: 'check-circle', color: tokens.subtle };
    // Runde vorbei, aber weder hier noch zentral ein Ergebnis: nachtragen.
    if (roundEndsAt && new Date(roundEndsAt) < now)
      return { label: 'Ergebnis fehlt', icon: 'alert', color: tokens.warning };
    return null;
  };

  const openMatch = (matchId: string) =>
    router.push({
      pathname: '/match/[matchId]',
      params: { matchId, setupId, station: stationRow?.name, block, game: gameRow?.name },
    });

  return (
    <Screen density="compact">
      <ContextBar
        subtitle={[block, gameRow?.name].filter(Boolean).join(' · ')}
        title={stationRow?.name ?? 'Station'}
      />

      {/* Stationskarte: Lage und Check-in an einem Ort. */}
      <View
        className={[
          'gap-3 overflow-hidden rounded-sheet',
          checkedInHere ? 'bg-primary p-4' : 'border-2 border-primary bg-surface',
        ].join(' ')}
      >
        {checkedInHere ? (
          <View className="flex-row items-center gap-2">
            <Icon color={tokens.onPrimary} name="check-circle" size={18} />
            <View className="flex-1">
              <Text className="text-base font-extrabold text-on-primary">Eingecheckt</Text>
              <Text className="text-xs text-on-primary">
                seit {activeCheckin ? formatTime(activeCheckin.checkedInAt, timezone) : ''}
              </Text>
            </View>
            {/* Klein in der Karte statt als große Aktion: Auschecken beendet
                die Betreuung und soll nicht wie die Hauptaktion wirken. */}
            <Pressable
              accessibilityHint="Beendet die Betreuung dieser Station auf diesem Gerät"
              accessibilityRole="button"
              className="min-h-[44px] items-center justify-center rounded-full border border-on-primary/50 px-4 active:opacity-70"
              onPress={() => {
                haptic('warning');
                void checkOut();
              }}
            >
              <Text className="text-sm font-bold text-on-primary">Auschecken</Text>
            </Pressable>
          </View>
        ) : (
          <>
            <View className="gap-3 p-4">
              {stationRow?.arrival_notes ? (
                <View className="flex-row items-start gap-2">
                  <Icon color={tokens.subtle} name="map-pin" size={14} />
                  <Text className="flex-1 text-sm leading-5 text-subtle">
                    {stationRow.arrival_notes}
                  </Text>
                </View>
              ) : null}
              {otherStation ? (
                <View className="flex-row items-start gap-2 rounded-control bg-warning-soft px-3 py-2">
                  <Icon color={tokens.warning} name="alert" size={14} />
                  <Text className="flex-1 text-xs font-semibold leading-5 text-warning">
                    Du bist noch bei {otherStation.name} eingecheckt. Beim Wechsel wird das beendet.
                  </Text>
                </View>
              ) : (
                <Text className="text-sm text-subtle">
                  Nicht eingecheckt. Die Runden sind freigeschaltet, sobald du hier eingecheckt
                  bist.
                </Text>
              )}
              <Button
                fullWidth
                isLoading={busy}
                label={otherStation ? 'Hierher wechseln' : 'Einchecken'}
                onPress={() => void doCheckIn()}
                size="lg"
              />
            </View>
          </>
        )}
      </View>

      {matches.length === 0 ? (
        <EmptyState
          description="Für diese Belegung sind noch keine Matches geplant."
          icon="results"
          title="Keine Matches"
        />
      ) : (
        <>
          {hero && pkg ? (
            <Pressable
              accessibilityRole="button"
              className="gap-2 rounded-card border border-primary bg-primary-soft p-4 active:opacity-90"
              onPress={() => openMatch(hero.match.id)}
            >
              {/* "Läuft" nur, wenn es wirklich läuft; nach Plan fällige
                  Matches heißen "Jetzt dran". */}
              <Text className="text-2xs font-black tracking-[0.6px] text-primary">
                {hero === upcoming
                  ? 'ALS NÄCHSTES'
                  : hero.match.status === 'in_progress'
                    ? 'LÄUFT'
                    : 'JETZT DRAN'}
                {hero.round?.label ? ` · ${hero.round.label}` : ''}
              </Text>
              <Text className="text-lg font-extrabold text-ink">
                {matchTeamsLabel(pkg, hero.match)}
              </Text>
              <View className="flex-row items-center justify-end gap-1">
                <Text className="text-sm font-bold text-primary">Ergebnis erfassen</Text>
                <Icon color={tokens.primary} name="chevron-right" size={16} />
              </View>
            </Pressable>
          ) : null}

          {/* Ohne Check-in hier: Runden grau und gesperrt. */}
          <View
            accessibilityState={{ disabled: !checkedInHere }}
            className={['gap-1', checkedInHere ? '' : 'opacity-40'].join(' ')}
          >
            <Text className="px-1 pb-1 text-xs font-extrabold uppercase tracking-[0.5px] text-subtle">
              Runden
            </Text>
            {matches.map(({ match, round }) => {
              const score = matchScore(match.id);
              const state = matchState(match.id, match.status, round?.ends_at);
              const done =
                match.status === 'completed' ||
                match.status === 'cancelled' ||
                Boolean(matchSync[match.id]);
              const teams = matchTeamsLabel(pkg, match);
              const disabled = !checkedInHere || match.status === 'cancelled';
              // Die Runde aus der Karte oben bleibt in der Liste, markiert
              // statt ausgeblendet: sonst fehlte z. B. R1 scheinbar.
              const isHero = match.id === hero?.match.id;
              return (
                <Pressable
                  accessibilityLabel={[round?.label, teams, score, state?.label]
                    .filter(Boolean)
                    .join(', ')}
                  accessibilityRole="button"
                  accessibilityState={{ disabled }}
                  className={[
                    'min-h-[56px] flex-row items-center gap-3 rounded-control px-3 py-3 active:bg-surface-muted',
                    isHero ? 'bg-primary-soft' : '',
                  ].join(' ')}
                  disabled={disabled}
                  key={match.id}
                  onPress={() => {
                    haptic('selection');
                    openMatch(match.id);
                  }}
                >
                  {/* Die Runde ordnet, nicht die Uhr: sie endet, wenn das
                        letzte Spiel fertig ist. Die geplante Zeit steht klein
                        darunter (docs/datenkonzept.md 11.7). */}
                  <View className="w-12">
                    <Text
                      className={['text-sm font-extrabold', done ? 'text-subtle' : 'text-ink'].join(
                        ' ',
                      )}
                      numberOfLines={1}
                    >
                      {round?.label ?? '–'}
                    </Text>
                    <Text className="text-2xs text-subtle">
                      {round ? formatTime(round.starts_at, timezone) : ''}
                    </Text>
                  </View>
                  <View className="min-w-0 flex-1 gap-0.5">
                    <Text
                      className={[
                        'text-sm font-bold',
                        done ? 'text-subtle' : 'text-ink',
                        match.status === 'cancelled' ? 'line-through' : '',
                      ].join(' ')}
                    >
                      {teams}
                    </Text>
                    {state && checkedInHere ? (
                      <View className="flex-row items-center gap-1">
                        <Icon color={state.color} name={state.icon} size={12} />
                        <Text className="text-2xs font-semibold text-subtle">{state.label}</Text>
                      </View>
                    ) : null}
                  </View>
                  {isHero ? (
                    <Text className="text-2xs font-black tracking-[0.5px] text-primary">
                      {hero === upcoming ? 'NÄCHSTES' : 'JETZT'}
                    </Text>
                  ) : null}
                  {score ? <Text className="text-sm font-extrabold text-ink">{score}</Text> : null}
                  {!disabled ? <Icon color={tokens.subtle} name="chevron-right" size={16} /> : null}
                </Pressable>
              );
            })}
          </View>
        </>
      )}
    </Screen>
  );
}
