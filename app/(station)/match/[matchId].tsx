import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { Screen } from '@/components/layout/Screen';
import { ActionBar } from '@/components/station/ActionBar';
import { ContextBar } from '@/components/station/ContextBar';
import { ToolStrip } from '@/components/station/Tools';
import { StatusBadge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Icon, type IconName } from '@/components/ui/Icon';
import { useTokens } from '@/components/ui/theme';
import { friendlyErrorMessage } from '@/lib/api/errors';
import { haptic } from '@/lib/haptics';
import { teamName } from '@/lib/station/package';
import { buildNumberPayload, buildOutcomePayload, buildPlacementPayload } from '@/lib/station/scoring';
import type { PackageGame, PackageMatch } from '@/lib/station/types';
import { useStationSession } from '@/providers/StationSessionProvider';

type Participant = { id: string; name: string };

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
}: {
  game: PackageGame;
  teamCount: number;
  round?: string;
  onRules: () => void;
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
      <Pressable
        accessibilityRole="button"
        className="flex-row items-center gap-1 self-start active:opacity-70"
        onPress={onRules}
      >
        <Text className="text-sm font-bold text-primary">Regeln</Text>
        <Icon color={tokens.primary} name="chevron-right" size={14} />
      </Pressable>
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
  const [draft, setDraft] = useState(String(value));

  const commit = () => {
    const parsed = Number.parseInt(draft, 10);
    onChange(Number.isFinite(parsed) ? Math.max(0, parsed) : value);
    setEditing(false);
  };

  return (
    <View className="min-w-0 flex-1 basis-[150px] gap-2 rounded-card border border-line bg-surface p-4">
      <Text className="text-sm font-bold text-subtle" numberOfLines={1}>
        {team.name}
      </Text>
      <Pressable
        accessibilityLabel={`${team.name} Wert bearbeiten`}
        className="items-center"
        onPress={() => {
          setDraft(String(value));
          setEditing(true);
        }}
      >
        {editing ? (
          <TextInput
            autoFocus
            className="w-full text-center text-stat-lg font-extrabold leading-[60px] tracking-[-2px] text-ink"
            keyboardType="number-pad"
            onBlur={commit}
            onChangeText={setDraft}
            onSubmitEditing={commit}
            selectTextOnFocus
            value={draft}
          />
        ) : (
          <Text className="text-stat-lg font-extrabold leading-[60px] tracking-[-2px] text-ink">{value}</Text>
        )}
      </Pressable>
      {unit ? <Text className="text-center text-2xs text-subtle">{unit}</Text> : null}
      <View className="flex-row gap-2">
        <Button
          className="flex-1"
          haptic="medium"
          label="−"
          onPress={() => onChange(Math.max(0, value - 1))}
          size="lg"
          variant="outline"
        />
        <Button className="flex-1" haptic="medium" label="+" onPress={() => onChange(value + 1)} size="lg" />
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
            <Icon color={value === option.key ? tokens.primary : tokens.subtle} name="trophy" size={20} />
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
            className={[
              'flex-1 items-center rounded-control border px-3 py-2',
              mode === option ? 'border-primary bg-primary-soft' : 'border-line bg-surface',
            ].join(' ')}
            key={option}
            onPress={() => onModeChange(option)}
          >
            <Text className={['text-xs font-bold', mode === option ? 'text-primary' : 'text-subtle'].join(' ')}>
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
              className="flex-row items-center gap-3 rounded-control border border-line bg-surface px-3 py-3 active:bg-primary-soft"
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
                  <Text className={['text-xs font-extrabold', place ? 'text-on-primary' : 'text-subtle'].join(' ')}>
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
  const { matchId, station, block } = useLocalSearchParams<{
    matchId: string;
    setupId?: string;
    station?: string;
    block?: string;
  }>();
  const { pkg, activeCheckin, saveResult, syncCounts } = useStationSession();

  const match: PackageMatch | undefined = pkg?.matches.find((m) => m.id === matchId);
  const setup = match ? pkg?.station_setups.find((s) => s.id === match.station_setup_id) : undefined;
  const game = setup ? pkg?.event_games.find((g) => g.id === setup.event_game_id) : undefined;
  const round = match ? pkg?.rounds.find((r) => r.id === match.round_id) : undefined;

  const teams: Participant[] = useMemo(
    () => (match && pkg ? match.participants.map((p) => ({ id: p.id, name: teamName(pkg, p.team_id) })) : []),
    [match, pkg],
  );

  const existingValue = match
    ? pkg?.current_result_values.filter((v) => v.match_id === match.id && v.version === match.current_result_version)
    : [];
  const isCorrection = Boolean(match && match.current_result_version > 0);

  const [values, setValues] = useState<Record<string, number>>({});
  const [outcome, setOutcome] = useState<'home' | 'draw' | 'away' | null>(null);
  const [mode, setMode] = useState<PlacementMode>('winner');
  const [placements, setPlacements] = useState<Record<string, number>>({});
  const [reason, setReason] = useState('');
  const [showTools, setShowTools] = useState(true);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  if (!pkg || !match || !game) {
    return (
      <Screen density="compact">
        <ContextBar onBack={() => router.back()} title="Match nicht gefunden" />
      </Screen>
    );
  }

  const isMultiTeam = teams.length > 2;

  const togglePlacement = (participantId: string) => {
    setPlacements((prev) => {
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
    });
  };

  const canConfirm = isMultiTeam
    ? Object.keys(placements).length > 0
    : game.measurement_type === 'number'
      ? true
      : outcome !== null;

  const needsReason = isCorrection && reason.trim().length === 0;

  const confirm = async () => {
    if (!activeCheckin) {
      setError('Kein aktiver Check-in an dieser Station.');
      return;
    }
    if (needsReason) return;
    setError(null);
    setSaving(true);
    try {
      const payload = isMultiTeam
        ? buildPlacementPayload(match, mode, placements)
        : game.measurement_type === 'number'
          ? buildNumberPayload(match, game, values)
          : buildOutcomePayload(match, outcome ?? 'home');
      await saveResult(match.id, payload, isCorrection ? reason.trim() : undefined);
      haptic('success');
      setSaved(true);
    } catch (err) {
      setError(friendlyErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Screen
      density="compact"
      footer={
        <ActionBar
          primary={{
            label: isCorrection ? 'Korrektur speichern' : 'Ergebnis bestätigen',
            isDisabled: !canConfirm || needsReason,
            isLoading: saving,
            onPress: () => void confirm(),
          }}
        />
      }
    >
      <ContextBar
        onBack={() => router.back()}
        pendingSync={syncCounts.pending + syncCounts.sending}
        subtitle={[block, station].filter(Boolean).join(' · ')}
        title={teams.map((t) => t.name).join(' – ')}
      />

      <MatchInfo
        game={game}
        onRules={() => router.push({ pathname: '/cockpit/rules', params: { gameId: game.id } })}
        round={round?.label}
        teamCount={teams.length}
      />

      {existingValue && existingValue.length > 0 ? (
        <View className="gap-1 rounded-card border border-warning/40 bg-warning-soft p-3">
          <Text className="text-xs font-extrabold text-warning">Bereits ein Ergebnis vorhanden</Text>
          <Text className="text-xs text-warning">
            Eine neue Eingabe wird als Korrekturvorschlag gespeichert und von einem Organisator geprüft.
          </Text>
        </View>
      ) : null}

      {game.measurement_type === 'number' && !isMultiTeam ? (
        <View className="flex-row flex-wrap gap-3">
          {teams.map((team) => (
            <NumberPad
              key={team.id}
              onChange={(next) => setValues((prev) => ({ ...prev, [team.id]: next }))}
              team={team}
              unit={game.unit}
              value={values[team.id] ?? 0}
            />
          ))}
        </View>
      ) : !isMultiTeam ? (
        <OutcomeSegments
          allowTies={game.allow_ties}
          onChange={setOutcome}
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

      {isCorrection ? (
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
        className="flex-row items-center gap-2 self-start py-1"
        onPress={() => setShowTools((v) => !v)}
      >
        <Icon name={showTools ? 'chevron-down' : 'chevron-right'} size={16} />
        <Text className="text-sm font-semibold text-subtle">Werkzeuge</Text>
      </Pressable>
      {showTools ? <ToolStrip config={game.tools_config} defaultSeconds={game.default_duration_seconds ?? 900} /> : null}

      {error ? (
        <View className="items-start">
          <StatusBadge status="review" />
          <Text className="mt-1 text-xs text-danger">{error}</Text>
        </View>
      ) : saved ? (
        <View className="items-start">
          <StatusBadge status="saved" />
        </View>
      ) : null}
    </Screen>
  );
}
