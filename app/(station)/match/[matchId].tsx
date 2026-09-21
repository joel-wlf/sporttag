import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { Screen } from '@/components/layout/Screen';
import { ActionBar } from '@/components/station/ActionBar';
import { ContextBar } from '@/components/station/ContextBar';
import {
  findGame,
  findMatch,
  pendingSyncCount,
  type DemoMatch,
  type DemoTeam,
} from '@/components/station/demoData';
import { ToolStrip } from '@/components/station/Tools';
import { StatusBadge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Icon, type IconName } from '@/components/ui/Icon';
import { useTokens } from '@/components/ui/theme';
import { haptic } from '@/lib/haptics';

function measurementLabel(match: DemoMatch) {
  if (match.measurementType === 'number') {
    const direction = match.comparisonDirection === 'lower' ? 'niedriger gewinnt' : 'höher gewinnt';
    return `${match.unit ?? 'Wert'}, ${direction}`;
  }
  if (match.teams.length > 2) return 'Platzierung';
  return match.allowTies ? 'Sieg, Unentschieden, Niederlage' : 'Sieg oder Niederlage';
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

function MatchInfo({ match, onRules }: { match: DemoMatch; onRules: () => void }) {
  const tokens = useTokens();
  const game = findGame(match.game);
  return (
    <View className="gap-3 rounded-card border border-line bg-surface p-4">
      <View className="flex-row items-baseline justify-between gap-3">
        <Text className="text-lg font-extrabold text-ink" numberOfLines={1}>
          {match.game}
        </Text>
        <Text className="text-sm font-bold text-subtle">
          {match.round} · {match.time}
        </Text>
      </View>
      <View className="flex-row flex-wrap gap-2">
        <InfoChip icon="results" label={measurementLabel(match)} />
        {game ? <InfoChip icon="clock" label={`${Math.round(game.durationSeconds / 60)} Min.`} /> : null}
        {match.teams.length > 2 ? (
          <InfoChip icon="users" label={`${match.teams.length} Teams`} />
        ) : null}
        {game ? <InfoChip icon="package" label={game.materials} /> : null}
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
  team: DemoTeam;
  value: number;
  unit?: string;
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
          <Text className="text-stat-lg font-extrabold leading-[60px] tracking-[-2px] text-ink">
            {value}
          </Text>
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
        <Button
          className="flex-1"
          haptic="medium"
          label="+"
          onPress={() => onChange(value + 1)}
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
  teams: [DemoTeam, DemoTeam];
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
  teams: DemoTeam[];
  mode: PlacementMode;
  onModeChange: (mode: PlacementMode) => void;
  placements: Record<string, number>;
  onToggle: (teamId: string) => void;
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
            <Text
              className={['text-xs font-bold', mode === option ? 'text-primary' : 'text-subtle'].join(' ')}
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
                  <Text
                    className={['text-xs font-extrabold', place ? 'text-on-primary' : 'text-subtle'].join(
                      ' ',
                    )}
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
  const { matchId, station, block } = useLocalSearchParams<{
    matchId: string;
    station?: string;
    block?: string;
    game?: string;
  }>();
  const match = useMemo(() => findMatch(matchId), [matchId]);

  const [values, setValues] = useState<Record<string, number>>({});
  const [outcome, setOutcome] = useState<'home' | 'draw' | 'away' | null>(null);
  const [mode, setMode] = useState<PlacementMode>('winner');
  const [placements, setPlacements] = useState<Record<string, number>>({});
  const [showTools, setShowTools] = useState(true);
  const [saved, setSaved] = useState(false);

  if (!match) {
    return (
      <Screen density="compact">
        <ContextBar onBack={() => router.back()} title="Match nicht gefunden" />
      </Screen>
    );
  }

  const isMultiTeam = match.teams.length > 2;

  const togglePlacement = (teamId: string) => {
    setPlacements((prev) => {
      if (mode === 'winner') {
        return prev[teamId] === 1 ? {} : { [teamId]: 1 };
      }
      const current = prev[teamId];
      const next = { ...prev };
      if (current) {
        delete next[teamId];
      } else {
        const used = new Set(Object.values(next));
        const rank = [1, 2, 3].find((r) => !used.has(r));
        if (!rank) return prev;
        next[teamId] = rank;
      }
      return next;
    });
  };

  const canConfirm = isMultiTeam
    ? Object.keys(placements).length > 0
    : match.measurementType === 'number'
      ? true
      : outcome !== null;

  return (
    <Screen
      density="compact"
      footer={
        <ActionBar
          primary={{
            label: 'Ergebnis bestätigen',
            isDisabled: !canConfirm,
            onPress: () => {
              haptic('success');
              setSaved(true);
            },
          }}
        />
      }
    >
      <ContextBar
        onBack={() => router.back()}
        pendingSync={pendingSyncCount}
        subtitle={[block, station].filter(Boolean).join(' · ')}
        title={match.teams.map((t) => t.name).join(' – ')}
      />

      <MatchInfo
        match={match}
        onRules={() => router.push({ pathname: '/cockpit/rules', params: { game: match.game } })}
      />

      {match.measurementType === 'number' && !isMultiTeam ? (
        <View className="flex-row flex-wrap gap-3">
          {match.teams.map((team) => (
            <NumberPad
              key={team.id}
              onChange={(next) => setValues((prev) => ({ ...prev, [team.id]: next }))}
              team={team}
              unit={match.unit}
              value={values[team.id] ?? 0}
            />
          ))}
        </View>
      ) : !isMultiTeam ? (
        <OutcomeSegments
          allowTies={match.allowTies}
          onChange={setOutcome}
          teams={match.teams as [DemoTeam, DemoTeam]}
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
          teams={match.teams}
        />
      )}

      <Pressable
        accessibilityRole="button"
        className="flex-row items-center gap-2 self-start py-1"
        onPress={() => setShowTools((v) => !v)}
      >
        <Icon name={showTools ? 'chevron-down' : 'chevron-right'} size={16} />
        <Text className="text-sm font-semibold text-subtle">Werkzeuge</Text>
      </Pressable>
      {showTools ? (
        <ToolStrip defaultSeconds={findGame(match.game)?.durationSeconds ?? 900} />
      ) : null}

      {saved ? (
        <View className="items-start">
          <StatusBadge status="saved" />
        </View>
      ) : null}
    </Screen>
  );
}
