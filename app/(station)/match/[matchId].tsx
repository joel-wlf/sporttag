import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { Screen } from '@/components/layout/Screen';
import { ActionBar } from '@/components/station/ActionBar';
import { ArrivalStrip, type ArrivalRow } from '@/components/station/ArrivalStrip';
import { ContextBar } from '@/components/station/ContextBar';
import { RosterSheet, type RosterTeam } from '@/components/station/RosterSheet';
import { ToolStrip } from '@/components/station/Tools';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { Icon, type IconName } from '@/components/ui/Icon';
import { useTokens } from '@/components/ui/theme';
import { friendlyErrorMessage } from '@/lib/api/errors';
import { haptic } from '@/lib/haptics';
import { isResultWithdrawn, teamName, teamRoster } from '@/lib/station/package';
import {
  buildNumberPayload,
  buildOutcomePayload,
  buildPlacementPayload,
  hasBlockingTie,
  placementModeFor,
  rewardedPlaces,
} from '@/lib/station/scoring';
import type { PackageGame, PackageMatch, ResultPayloadValue } from '@/lib/station/types';
import { useStationSession } from '@/providers/StationSessionProvider';

type Participant = { id: string; name: string };

/** Obergrenze für Messwerte; die Datenbank speichert numeric(14,4). */
const MAX_MEASURED = 1_000_000;

/** Messwert mit deutschem Dezimalkomma, ohne überflüssige Nachkommastellen. */
function formatMeasured(value: number) {
  return String(Math.round(value * 10000) / 10000).replace('.', ',');
}

/**
 * Liest eine Eingabe wie "23,5" oder "23.5". Meter und Sekunden brauchen
 * Nachkommastellen; `parseInt` schnitt sie bisher stillschweigend ab.
 * Ungültige oder unplausible Eingaben ergeben `null` (alter Wert bleibt).
 */
function parseMeasured(input: string): number | null {
  const normalized = input.trim().replace(',', '.');
  if (!/^\d+(\.\d*)?$|^\.\d+$/.test(normalized)) return null;
  const parsed = Number(normalized);
  if (!Number.isFinite(parsed) || parsed < 0 || parsed > MAX_MEASURED) return null;
  return Math.round(parsed * 10000) / 10000;
}

function measurementLabel(game: PackageGame, teamCount: number) {
  if (game.measurement_type === 'number') {
    const direction = game.comparison_direction === 'lower' ? 'niedriger gewinnt' : 'höher gewinnt';
    return `${game.unit ?? 'Wert'}, ${direction}`;
  }
  if (teamCount > 2) return 'Platzierung';
  return game.allow_ties ? 'Sieg, Unentschieden, Niederlage' : 'Sieg oder Niederlage';
}

function InfoChip({ icon, label }: { icon: IconName; label: string }) {
  const tokens = useTokens();
  return (
    <View className="flex-row items-center gap-1.5 rounded-full bg-surface-muted px-3 py-1.5">
      <Icon color={tokens.subtle} name={icon} size={14} />
      <Text className="text-xs font-semibold text-subtle">{label}</Text>
    </View>
  );
}

function MatchInfo({
  game,
  teamCount,
  round,
  onRules,
  onRoster,
}: {
  game: PackageGame;
  teamCount: number;
  round?: string;
  onRules: () => void;
  onRoster?: () => void;
}) {
  const tokens = useTokens();
  return (
    <View className="gap-3 rounded-card border border-line bg-surface p-4">
      <View className="flex-row items-baseline justify-between gap-3">
        <Text className="text-lg font-extrabold text-ink" numberOfLines={1}>
          {game.name}
        </Text>
        {round ? <Text className="text-sm font-bold text-subtle">{round}</Text> : null}
      </View>
      <View className="flex-row flex-wrap gap-2">
        <InfoChip icon="results" label={measurementLabel(game, teamCount)} />
        {game.default_duration_seconds ? (
          <InfoChip icon="clock" label={`${Math.round(game.default_duration_seconds / 60)} Min.`} />
        ) : null}
        {teamCount > 2 ? <InfoChip icon="users" label={`${teamCount} Teams`} /> : null}
        {game.materials ? <InfoChip icon="package" label={game.materials} /> : null}
      </View>
      <View className="flex-row flex-wrap gap-5">
        <Pressable
          accessibilityRole="button"
          className="flex-row items-center gap-1 self-start active:opacity-70"
          onPress={onRules}
        >
          <Text className="text-sm font-bold text-primary">Regeln</Text>
          <Icon color={tokens.primary} name="chevron-right" size={14} />
        </Pressable>
        {onRoster ? (
          <Pressable
            accessibilityRole="button"
            className="flex-row items-center gap-1 self-start active:opacity-70"
            onPress={onRoster}
          >
            <Text className="text-sm font-bold text-primary">Namen</Text>
            <Icon color={tokens.primary} name="chevron-right" size={14} />
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

function NumberPad({
  team,
  value,
  unit,
  onChange,
}: {
  team: Participant;
  value: number;
  unit?: string | null;
  onChange: (next: number) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(formatMeasured(value));

  // Jede gültige Eingabe gilt sofort: Zahlentastaturen haben auf iOS keine
  // Eingabetaste, und ein Tipp auf "Ergebnis speichern" nimmt dem Feld den
  // Fokus nicht — sonst würde der alte Wert gespeichert.
  const changeDraft = (text: string) => {
    setDraft(text);
    const parsed = parseMeasured(text);
    if (parsed !== null && parsed !== value) onChange(parsed);
  };

  const commit = () => {
    const parsed = parseMeasured(draft);
    if (parsed !== null && parsed !== value) onChange(parsed);
    setEditing(false);
  };

  return (
    <View className="min-w-0 flex-1 basis-[150px] gap-2 rounded-card border border-line bg-surface p-4">
      <Text className="text-sm font-bold text-subtle" numberOfLines={1}>
        {team.name}
      </Text>
      <Pressable
        accessibilityLabel={`${team.name}: ${value}${unit ? ` ${unit}` : ''}. Tippen, um den Wert einzugeben`}
        accessibilityRole="button"
        className="items-center"
        onPress={() => {
          // Bei 0 leer starten: sonst wird aus "0" beim Tippen "09".
          setDraft(value === 0 ? '' : formatMeasured(value));
          setEditing(true);
        }}
      >
        {editing ? (
          // textAlign als Style statt `text-center`: react-native-css 3.0.4
          // stürzt bei `text-center` auf einem nativen TextInput ab
          // ("undefined is not a function" in der nativeStyleMapping).
          <TextInput
            autoFocus
            className="w-full text-stat-lg font-extrabold leading-[60px] tracking-[-2px] text-ink"
            keyboardType="decimal-pad"
            onBlur={commit}
            onChangeText={changeDraft}
            onSubmitEditing={commit}
            selectTextOnFocus
            style={{ textAlign: 'center' }}
            value={draft}
          />
        ) : (
          <Text className="text-stat-lg font-extrabold leading-[60px] tracking-[-2px] text-ink">
            {formatMeasured(value)}
          </Text>
        )}
      </Pressable>
      {unit ? <Text className="text-center text-2xs text-subtle">{unit}</Text> : null}
      <View className="flex-row gap-2">
        <Button
          accessibilityLabel={`${team.name} minus eins`}
          className="flex-1"
          haptic="medium"
          isDisabled={value <= 0}
          label="−"
          onPress={() => {
            setEditing(false);
            onChange(Math.max(0, value - 1));
          }}
          size="lg"
          variant="outline"
        />
        <Button
          accessibilityLabel={`${team.name} plus eins`}
          className="flex-1"
          haptic="medium"
          label="+"
          onPress={() => {
            setEditing(false);
            onChange(value + 1);
          }}
          size="lg"
        />
      </View>
    </View>
  );
}

function OutcomeSegments({
  teams,
  allowTies,
  value,
  onChange,
}: {
  teams: [Participant, Participant];
  allowTies: boolean;
  value: 'home' | 'draw' | 'away' | null;
  onChange: (next: 'home' | 'draw' | 'away') => void;
}) {
  const tokens = useTokens();
  const options: { key: 'home' | 'draw' | 'away'; label: string }[] = [
    { key: 'home', label: teams[0].name },
    ...(allowTies ? [{ key: 'draw' as const, label: 'Unentschieden' }] : []),
    { key: 'away', label: teams[1].name },
  ];

  return (
    <View className="flex-row gap-2">
      {options.map((option) => (
        <Pressable
          accessibilityRole="radio"
          accessibilityState={{ selected: value === option.key }}
          className={[
            'min-h-[84px] flex-1 items-center justify-center gap-1 rounded-card border-2 px-2',
            value === option.key ? 'border-primary bg-primary-soft' : 'border-line bg-surface',
          ].join(' ')}
          key={option.key}
          onPress={() => {
            haptic('medium');
            onChange(option.key);
          }}
        >
          {option.key !== 'draw' ? (
            <Icon
              color={value === option.key ? tokens.primary : tokens.subtle}
              name="trophy"
              size={20}
            />
          ) : null}
          <Text
            className={[
              'text-center font-extrabold',
              option.key === 'draw' ? 'text-xs' : 'text-sm',
              value === option.key ? 'text-primary' : 'text-ink',
            ].join(' ')}
            numberOfLines={1}
          >
            {option.label}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

type PlacementMode = 'winner' | 'top3';

function PlacementList({
  teams,
  mode,
  onModeChange,
  placements,
  onToggle,
}: {
  teams: Participant[];
  mode: PlacementMode;
  onModeChange: (mode: PlacementMode) => void;
  placements: Record<string, number>;
  onToggle: (participantId: string) => void;
}) {
  const tokens = useTokens();
  return (
    <View className="gap-3">
      <View className="flex-row gap-2">
        {(['winner', 'top3'] as const).map((option) => (
          <Pressable
            accessibilityRole="radio"
            accessibilityState={{ selected: mode === option }}
            className={[
              'min-h-[44px] flex-1 items-center justify-center rounded-control border px-3 py-2',
              mode === option ? 'border-primary bg-primary-soft' : 'border-line bg-surface',
            ].join(' ')}
            key={option}
            onPress={() => onModeChange(option)}
          >
            <Text
              className={[
                'text-xs font-bold',
                mode === option ? 'text-primary' : 'text-subtle',
              ].join(' ')}
            >
              {option === 'winner' ? 'Nur Gewinner' : 'Top 3'}
            </Text>
          </Pressable>
        ))}
      </View>
      <View className="gap-1">
        {teams.map((team) => {
          const place = placements[team.id];
          const fallback = mode === 'winner' ? 2 : 4;
          return (
            <Pressable
              accessibilityLabel={`${team.name}, ${place ? `Platz ${place}` : 'ohne Platzierung'}`}
              accessibilityRole="button"
              className="min-h-[48px] flex-row items-center gap-3 rounded-control border border-line bg-surface px-3 py-3 active:bg-primary-soft"
              key={team.id}
              onPress={() => {
                haptic('medium');
                onToggle(team.id);
              }}
            >
              <Text className="flex-1 text-sm font-bold text-ink">{team.name}</Text>
              <View
                className={[
                  'h-8 min-w-8 items-center justify-center rounded-full px-2',
                  place ? 'bg-primary' : 'bg-surface-muted',
                ].join(' ')}
              >
                {place === 1 ? (
                  <Icon color={tokens.onPrimary} name="trophy" size={15} />
                ) : (
                  <Text
                    className={[
                      'text-xs font-extrabold',
                      place ? 'text-on-primary' : 'text-subtle',
                    ].join(' ')}
                  >
                    {place ?? fallback}
                  </Text>
                )}
              </View>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

export default function MatchResultScreen() {
  const router = useRouter();
  const tokens = useTokens();
  const { matchId, station, block } = useLocalSearchParams<{
    matchId: string;
    setupId?: string;
    station?: string;
    block?: string;
  }>();
  const {
    pkg,
    activeCheckin,
    checkIn,
    saveResult,
    setLiveValues,
    setTeamVisit,
    syncCounts,
    matchSync,
    liveStates,
    teamVisits,
  } = useStationSession();
  // Per Live-Activity-Deeplink geöffnet gibt es keinen Stapel darunter.
  const goBack = () => (router.canGoBack() ? router.back() : router.replace('/assignment'));

  const match: PackageMatch | undefined = pkg?.matches.find((m) => m.id === matchId);
  const setup = match
    ? pkg?.station_setups.find((s) => s.id === match.station_setup_id)
    : undefined;
  const game = setup ? pkg?.event_games.find((g) => g.id === setup.event_game_id) : undefined;
  const round = match ? pkg?.rounds.find((r) => r.id === match.round_id) : undefined;

  const teams: Participant[] = useMemo(
    () =>
      match && pkg
        ? match.participants.map((p) => ({ id: p.id, name: teamName(pkg, p.team_id) }))
        : [],
    [match, pkg],
  );

  const roster: RosterTeam[] = useMemo(
    () =>
      match && pkg
        ? match.participants.map((p) => ({ id: p.id, name: teamName(pkg, p.team_id), players: teamRoster(pkg, p.team_id) }))
        : [],
    [match, pkg],
  );
  const hasRoster = roster.some((t) => t.players.length > 0);
  const [rosterOpen, setRosterOpen] = useState(false);

  const existingValue = match
    ? pkg?.current_result_values.filter(
        (v) => v.match_id === match.id && v.version === match.current_result_version,
      )
    : [];
  // Auch eine eigene, noch nicht (oder gerade erst) übertragene Abgabe macht
  // jede weitere Eingabe zur Korrektur: der Server nimmt nur eine Abgabe je
  // Ergebnisstand an, die zweite landet zur Klärung bei der Leitung.
  const localSubmission = match ? matchSync[match.id] : undefined;
  // Nach einem Rückzug durch die Leitung ist die Version > 0, aber leer: dann
  // ist eine neue Eingabe wieder eine Erstabgabe.
  const hasServerResult = Boolean(existingValue && existingValue.length > 0);
  // Nach einem Rückzug ist die eigene frühere Abgabe erledigt: eine neue
  // Eingabe ist wieder eine Erstabgabe ohne Korrekturgrund.
  const withdrawn = Boolean(match && pkg && isResultWithdrawn(pkg, match));
  const isCorrection = Boolean(match && (hasServerResult || (localSubmission && !withdrawn)));
  const isMultiTeam = teams.length > 2;

  // Zählerstände kommen aus dem geteilten Live-Stand: Zählt eine andere Person
  // ein anderes Team, erscheint ihr Wert hier, ohne dass eigene Eingaben
  // überschrieben werden (siehe lib/station/liveMerge.ts).
  const liveEntries = match ? liveStates[match.id]?.values : undefined;
  const values = useMemo(() => {
    const out: Record<string, number> = {};
    for (const v of liveEntries ?? []) {
      if (v.measured_value != null) out[v.participant_id] = v.measured_value;
    }
    return out;
  }, [liveEntries]);
  const [outcome, setOutcome] = useState<'home' | 'draw' | 'away' | null>(null);
  // Standard aus der Wertungsregel des Spiels; die Station kann umschalten.
  const [modeOverride, setMode] = useState<PlacementMode | null>(null);
  const mode: PlacementMode =
    modeOverride ?? (pkg && match && game ? placementModeFor(pkg, match, game) : 'top3');
  const [placements, setPlacements] = useState<Record<string, number>>({});
  const [reason, setReason] = useState('');
  const [showTools, setShowTools] = useState(true);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 30000);
    return () => clearInterval(id);
  }, []);

  // Übernimmt den geteilten Live-Stand (auch von anderen Geräten derselben
  // Station), sobald er sich ändert. So sehen mehrere Geräte denselben
  // Zwischenstand, ohne dass ein Konflikt entsteht. Das synchrone Setzen in
  // einem Effekt ist hier gewollt: externer Zustand wird in bearbeitbare
  // Felder übernommen.
  const appliedLiveRef = useRef<string | null>(null);
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (!match || !game) return;
    const live = liveStates[match.id];
    // Zählerspiele lesen den Live-Stand direkt (`values`), nicht über Felder.
    if (game.measurement_type === 'number') return;
    if (!live || live.values.length === 0 || appliedLiveRef.current === live.updatedAt) return;
    appliedLiveRef.current = live.updatedAt;
    if (isMultiTeam) {
      const next: Record<string, number> = {};
      for (const v of live.values) if (v.placement != null) next[v.participant_id] = v.placement;
      setPlacements(next);
    } else {
      const home = live.values.find((v) => v.participant_id === match.participants[0]?.id);
      const away = live.values.find((v) => v.participant_id === match.participants[1]?.id);
      if (home?.placement === 1 && away?.placement === 1) setOutcome('draw');
      else if (home?.placement === 1) setOutcome('home');
      else if (away?.placement === 1) setOutcome('away');
    }
  }, [liveStates, match, game, isMultiTeam]);
  /* eslint-enable react-hooks/set-state-in-effect */

  if (!pkg || !match || !game) {
    return (
      <Screen density="compact">
        <ContextBar onBack={goBack} title="Match nicht gefunden" />
        <EmptyState
          action={<Button label="Zum Tagesplan" onPress={() => router.replace('/assignment')} />}
          description="Dieses Match ist im Offline-Paket nicht (mehr) vorhanden. Zurück zum Tagesplan oder die Person wechseln."
          icon="results"
          title="Match nicht gefunden"
        />
      </Screen>
    );
  }

  // Ergebnisse gehören zur Belegung, an der das Gerät eingecheckt ist. Ein
  // Check-in an einer anderen Station würde sie der falschen Station zuordnen.
  const checkedInHere = Boolean(
    activeCheckin && activeCheckin.stationSetupId === match.station_setup_id,
  );
  const plannedStart = round ? new Date(round.starts_at).getTime() : null;
  const arrivalRows: ArrivalRow[] = match.participants.map((participant) => {
    const visit = teamVisits[participant.id];
    const arrivedAt = visit?.arrivedAt ?? null;
    return {
      participantId: participant.id,
      teamName: teamName(pkg, participant.team_id),
      arrivedAt,
      releasedAt: visit?.releasedAt ?? null,
      delayMs:
        arrivedAt && plannedStart !== null ? new Date(arrivedAt).getTime() - plannedStart : null,
    };
  });

  const reportLive = (payload: ResultPayloadValue[]) => {
    void setLiveValues(match.id, payload, { started: true });
  };

  // Nur der geänderte Zähler wird gemeldet: ein ganzer Stand würde die Zähler
  // anderer Geräte mit veralteten Werten überschreiben.
  const changeValue = (participantId: string, next: number) => {
    setSaved(false);
    void setLiveValues(
      match.id,
      [{ participant_id: participantId, measured_value: next }],
      { started: true, counter: true },
    );
  };

  const changeOutcome = (next: 'home' | 'draw' | 'away') => {
    setSaved(false);
    setOutcome(next);
    reportLive(buildOutcomePayload(match, next).values);
  };

  const computePlacements = (prev: Record<string, number>, participantId: string) => {
    if (mode === 'winner') {
      return prev[participantId] === 1 ? {} : { [participantId]: 1 };
    }
    const current = prev[participantId];
    const next = { ...prev };
    if (current) {
      delete next[participantId];
    } else {
      const used = new Set(Object.values(next));
      const rank = [1, 2, 3].find((r) => !used.has(r));
      if (!rank) return prev;
      next[participantId] = rank;
    }
    return next;
  };

  const togglePlacement = (participantId: string) => {
    setSaved(false);
    const next = computePlacements(placements, participantId);
    setPlacements(next);
    // Nur tatsächlich gesetzte Platzierungen melden; fehlende Teams bleiben im
    // Backoffice ohne Wert, statt den Anzeige-Fallback als Ergebnis zu senden.
    reportLive(
      match.participants
        .filter((p) => next[p.id] != null)
        .map((p) => ({ participant_id: p.id, placement: next[p.id] })),
    );
  };

  // Zahlspiele erst speichern, wenn mindestens ein Wert eingegeben wurde:
  // sonst ging ein versehentliches 0 : 0 als Ergebnis durch.
  const isNumber = game.measurement_type === 'number';
  const numberTouched = Object.keys(values).length > 0;
  // "Niedriger gewinnt" (z. B. Zeit): Ein nicht eingetragenes Team stand als
  // 0 da und gewann damit. Hier muss jedes Team einen Wert haben.
  const missingLowerValue =
    isNumber &&
    game.comparison_direction === 'lower' &&
    teams.some((t) => values[t.id] === undefined);
  const canConfirm = isNumber
    ? numberTouched && !missingLowerValue
    : isMultiTeam
      ? Object.keys(placements).length > 0
      : outcome !== null;
  // Spiele ohne Unentschieden: ein Zahlen-Gleichstand ist kein gültiges
  // Ergebnis (der Server wertet es sonst als Unentschieden).
  const numberTie =
    isNumber &&
    !game.allow_ties &&
    (teams.length === 2
      ? (values[teams[0].id] ?? 0) === (values[teams[1].id] ?? 0)
      : hasBlockingTie(buildNumberPayload(match, game, values), rewardedPlaces(pkg, match, game)));

  const needsReason = isCorrection && reason.trim().length === 0;

  const confirm = async () => {
    // Doppeltipp: zweite Abgabe erst nach der ersten (sonst ein Konflikt).
    if (savingRef.current) return;
    if (!checkedInHere) {
      setError('Erst an dieser Station einchecken, dann lässt sich das Ergebnis speichern.');
      return;
    }
    if (needsReason) return;
    if (numberTie) {
      setError(
        isMultiTeam
          ? 'Bei diesem Spiel gibt es keinen geteilten Platz unter den gewerteten Plätzen. Bitte den Gleichstand auflösen.'
          : 'Bei diesem Spiel gibt es kein Unentschieden. Bitte den Gleichstand auflösen.',
      );
      return;
    }
    setError(null);
    setSaving(true);
    savingRef.current = true;
    try {
      const payload = isNumber
        ? buildNumberPayload(match, game, values)
        : isMultiTeam
          ? buildPlacementPayload(match, mode, placements)
          : buildOutcomePayload(match, outcome ?? 'home');
      await saveResult(match.id, payload, isCorrection ? reason.trim() : undefined);
      haptic('success');
      setSaved(true);
    } catch (err) {
      setError(friendlyErrorMessage(err));
    } finally {
      setSaving(false);
      savingRef.current = false;
    }
  };

  return (
    <Screen
      density="compact"
      footer={
        <View className="gap-2">
          {/* Rückmeldung direkt über der Aktion, wo der Blick gerade ist —
              nicht unter den Werkzeugen außerhalb des sichtbaren Bereichs. */}
          {error ? (
            <View
              accessibilityRole="alert"
              className="flex-row items-start gap-2 rounded-control bg-danger-soft px-3 py-2.5"
            >
              <Icon color={tokens.danger} name="alert" size={16} />
              <Text className="flex-1 text-sm font-semibold text-danger">{error}</Text>
            </View>
          ) : saved ? (
            <View
              accessibilityLiveRegion="polite"
              className="flex-row items-center gap-2 rounded-control bg-success-soft px-3 py-2.5"
            >
              <Icon color={tokens.success} name="check-circle" size={16} />
              <Text className="flex-1 text-sm font-semibold text-success">
                Auf Gerät gespeichert
                {syncCounts.pending + syncCounts.sending > 0
                  ? ' · wird übertragen, sobald Netz da ist'
                  : ''}
              </Text>
            </View>
          ) : !checkedInHere ? (
            <Text className="text-center text-xs text-subtle">
              Speichern geht erst, wenn du an dieser Station eingecheckt bist.
            </Text>
          ) : missingLowerValue && numberTouched ? (
            <Text className="text-center text-xs text-subtle">
              Bei diesem Spiel braucht jedes Team einen eigenen Wert.
            </Text>
          ) : isCorrection && needsReason ? (
            <Text className="text-center text-xs text-subtle">
              Für eine Korrektur bitte einen Grund angeben.
            </Text>
          ) : null}
          <ActionBar
            primary={
              saved
                ? {
                    label: 'Zurück zu den Matches',
                    leftIcon: 'arrow-left',
                    onPress: goBack,
                    variant: 'outline',
                  }
                : {
                    label: isCorrection ? 'Korrektur speichern' : 'Ergebnis speichern',
                    isDisabled: !canConfirm || needsReason || !checkedInHere,
                    isLoading: saving,
                    haptic: 'medium',
                    onPress: () => void confirm(),
                  }
            }
          />
        </View>
      }
    >
      <ContextBar
        onBack={goBack}
        subtitle={[block, station].filter(Boolean).join(' · ')}
        title={teams.map((t) => t.name).join(teams.length > 2 ? ' · ' : ' – ')}
      />

      {!checkedInHere ? (
        <View className="gap-3 rounded-card border border-warning/40 bg-warning-soft p-4">
          <View className="flex-row items-start gap-2">
            <Icon color={tokens.warning} name="alert" size={18} />
            <View className="flex-1 gap-0.5">
              <Text className="text-sm font-extrabold text-warning">
                {activeCheckin
                  ? 'Du bist an einer anderen Station eingecheckt'
                  : 'Nicht an dieser Station eingecheckt'}
              </Text>
              <Text className="text-xs leading-5 text-warning">
                Ergebnisse und Laufzettel zählen erst, wenn dieses Gerät hier eingecheckt ist.
              </Text>
            </View>
          </View>
          <Button
            label={activeCheckin ? 'Hierher wechseln' : 'Einchecken'}
            onPress={() => {
              haptic('success');
              void checkIn(match.station_setup_id);
            }}
            size="sm"
          />
        </View>
      ) : null}

      <ArrivalStrip
        disabled={!checkedInHere}
        disabledHint="Erst an der Station einchecken, dann lässt sich der Laufzettel führen."
        now={now}
        onArrive={(participantId) => {
          haptic('medium');
          void setTeamVisit(participantId, { arrivedAt: new Date().toISOString() });
        }}
        onRelease={(participantId) => {
          haptic('success');
          void setTeamVisit(participantId, { releasedAt: new Date().toISOString() });
        }}
        onUndoArrival={(participantId) => void setTeamVisit(participantId, { arrivedAt: null })}
        onUndoRelease={(participantId) => void setTeamVisit(participantId, { releasedAt: null })}
        rows={arrivalRows}
      />

      <MatchInfo
        game={game}
        onRoster={hasRoster ? () => setRosterOpen(true) : undefined}
        onRules={() => router.push({ pathname: '/rules/[gameId]', params: { gameId: game.id } })}
        round={round?.label}
        teamCount={teams.length}
      />
      <RosterSheet onClose={() => setRosterOpen(false)} teams={roster} visible={rosterOpen} />

      {localSubmission && !withdrawn && !(existingValue && existingValue.length > 0) && !saved ? (
        <View className="gap-1 rounded-card border border-warning/40 bg-warning-soft p-3">
          <Text className="text-xs font-extrabold text-warning">
            Auf diesem Gerät bereits gespeichert
          </Text>
          <Text className="text-xs text-warning">
            Eine neue Eingabe geht als Korrektur mit Begründung zur Prüfung an die
            Veranstaltungsleitung.
          </Text>
        </View>
      ) : null}

      {existingValue && existingValue.length > 0 ? (
        <View className="gap-1 rounded-card border border-warning/40 bg-warning-soft p-3">
          <Text className="text-xs font-extrabold text-warning">
            Bereits ein Ergebnis vorhanden
          </Text>
          <Text className="text-xs text-warning">
            Eine neue Eingabe wird als Korrekturvorschlag gespeichert und von einem Organisator
            geprüft.
          </Text>
        </View>
      ) : null}

      {isNumber ? (
        <View className="flex-row flex-wrap gap-3">
          {teams.map((team) => (
            <NumberPad
              key={team.id}
              onChange={(next) => changeValue(team.id, next)}
              team={team}
              unit={game.unit}
              value={values[team.id] ?? 0}
            />
          ))}
        </View>
      ) : !isMultiTeam ? (
        <OutcomeSegments
          allowTies={game.allow_ties}
          onChange={changeOutcome}
          teams={teams as [Participant, Participant]}
          value={outcome}
        />
      ) : (
        <PlacementList
          mode={mode}
          onModeChange={(next) => {
            setMode(next);
            setPlacements({});
          }}
          onToggle={togglePlacement}
          placements={placements}
          teams={teams}
        />
      )}

      {isCorrection && !saved ? (
        <View className="gap-1.5">
          <Text className="text-xs font-bold text-subtle">Korrekturgrund</Text>
          <TextInput
            className="rounded-control border border-line bg-surface px-3 py-2.5 text-sm text-ink"
            multiline
            onChangeText={setReason}
            placeholder="Warum wird das Ergebnis korrigiert?"
            value={reason}
          />
        </View>
      ) : null}

      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded: showTools }}
        className="min-h-[44px] flex-row items-center gap-2 self-start"
        onPress={() => setShowTools((v) => !v)}
      >
        <Icon name={showTools ? 'chevron-down' : 'chevron-right'} size={16} />
        <Text className="text-sm font-semibold text-subtle">Werkzeuge</Text>
      </Pressable>
      {showTools ? (
        <ToolStrip
          config={game.tools_config}
          defaultSeconds={game.default_duration_seconds ?? 900}
          eventId={pkg.event.id}
          matchId={match.id}
        />
      ) : null}
    </Screen>
  );
}
