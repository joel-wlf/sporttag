import { useMemo, useState } from 'react';
import { Text, View } from 'react-native';
import { FormSheet } from '@/components/ui/FormSheet';
import { PillChoice } from '@/components/ui/PillChoice';
import { SegmentedChoice } from '@/components/ui/SegmentedChoice';
import { confirmAsync } from '@/lib/confirm';
import { friendlyErrorMessage } from '@/lib/api/errors';
import { type Player, toBalancePlayer, useSetPlayerTeams } from '@/lib/api/players';
import type { TeamRow } from '@/lib/api/teams';
import { autoAssign, teamIndicators, teamStats, type AutoAssignMode, type BalanceWeights } from '@/lib/teams/balance';
import { TeamFacts, TeamIndicators } from './TeamField';

type Level = '0' | '1' | '2' | '3';
const levels: { value: Level; label: string }[] = [
  { value: '0', label: 'Aus' },
  { value: '1', label: 'Niedrig' },
  { value: '2', label: 'Mittel' },
  { value: '3', label: 'Hoch' },
];

/**
 * Automatische Verteilung mit einstellbaren Faktoren und Live-Vorschau.
 * Die Teamgröße wird immer ausgeglichen; fixierte Spieler bleiben stehen.
 */
export function AutoAssignSheet({
  eventId,
  teams,
  players,
  visible,
  onClose,
}: {
  eventId: string;
  teams: TeamRow[];
  players: Player[];
  visible: boolean;
  onClose: () => void;
}) {
  const setTeams = useSetPlayerTeams(eventId);
  const [skill, setSkill] = useState<Level>('3');
  const [gender, setGender] = useState<Level>('2');
  const [age, setAge] = useState<Level>('0');
  const [mode, setMode] = useState<AutoAssignMode>('unassigned');
  const [error, setError] = useState<string | null>(null);

  const teamIds = useMemo(() => teams.map((t) => t.id), [teams]);
  const weights: BalanceWeights = { skill: Number(skill), gender: Number(gender), age: Number(age) };

  const preview = useMemo(
    () => (visible ? autoAssign(players.map(toBalancePlayer), teamIds, weights, mode) : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [visible, players, teamIds, skill, gender, age, mode],
  );
  const previewStats = useMemo(() => (preview ? teamStats(preview.players, teamIds) : null), [preview, teamIds]);
  const previewIndicators = useMemo(() => (previewStats ? teamIndicators(previewStats) : null), [previewStats]);

  const moves = preview?.assignments ?? [];
  const reassigned = moves.filter((m) => players.find((p) => p.id === m.playerId)?.team_id != null).length;
  const lockedCount = players.filter((p) => p.locked).length;

  const handleSubmit = async () => {
    setError(null);
    if (moves.length === 0) {
      onClose();
      return;
    }
    if (
      reassigned > 0 &&
      !(await confirmAsync(
        `${reassigned} bereits zugeordnete Spieler wechseln das Team.`,
        'Teams neu verteilen?',
        'Verteilen',
      ))
    ) {
      return;
    }
    try {
      await setTeams.mutateAsync(moves.map((m) => ({ playerId: m.playerId, teamId: m.teamId })));
      onClose();
    } catch (err) {
      setError(friendlyErrorMessage(err));
    }
  };

  return (
    <FormSheet
      error={error}
      isSubmitting={setTeams.isPending}
      onClose={onClose}
      onSubmit={handleSubmit}
      submitLabel={moves.length ? `${moves.length} zuordnen` : 'Fertig'}
      title="Automatisch verteilen"
      visible={visible}
    >
      <SegmentedChoice
        label="Wer wird verteilt?"
        onChange={setMode}
        options={[
          { value: 'unassigned', label: 'Nur Spieler ohne Team', description: 'Bestehende Zuordnungen bleiben unverändert.' },
          {
            value: 'all',
            label: 'Alle neu verteilen',
            description: lockedCount
              ? `${lockedCount} fixierte Spieler bleiben in ihrem Team.`
              : 'Fixierte Spieler blieben in ihrem Team – aktuell ist keiner fixiert.',
          },
        ]}
        value={mode}
      />
      <Text className="text-[13px] leading-5 text-subtle">
        Die Teamgröße wird immer ausgeglichen. Lege fest, wie stark die übrigen Faktoren zählen.
      </Text>
      <PillChoice label="Stärke" onChange={setSkill} options={levels} value={skill} />
      <PillChoice label="Geschlecht" onChange={setGender} options={levels} value={gender} />
      <PillChoice label="Alter" onChange={setAge} options={levels} value={age} />

      <View className="gap-2">
        <Text className="text-[13px] font-bold text-ink">
          Vorschau · {moves.length === 0 ? 'keine Änderung' : `${moves.length} Spieler werden zugeordnet`}
        </Text>
        {teams.map((team) =>
          previewStats && previewIndicators ? (
            <View className="gap-2 rounded-2xl border border-line bg-surface px-4 py-3" key={team.id}>
              <Text className="text-[14px] font-bold text-ink">{team.number ? `${team.number} · ${team.name}` : team.name}</Text>
              <TeamFacts stats={previewStats.get(team.id)!} />
              <TeamIndicators indicators={previewIndicators.get(team.id) ?? []} />
            </View>
          ) : null,
        )}
      </View>
    </FormSheet>
  );
}
