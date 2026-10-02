import { Pressable, Text, View } from 'react-native';
import { Icon } from '@/components/ui/Icon';
import { useTokens } from '@/components/ui/theme';
import type { Player } from '@/lib/api/players';
import type { TeamRow } from '@/lib/api/teams';
import { formatSkill, type TeamIndicator, type TeamStats } from '@/lib/teams/balance';
import { useDropZone } from './drag';
import { PlayerChip } from './PlayerChip';

const toneClass: Record<TeamIndicator['tone'], { box: string; text: string; color: 'danger' | 'warning' | 'success' | 'subtle' }> = {
  danger: { box: 'bg-danger-soft', text: 'text-danger', color: 'danger' },
  warning: { box: 'bg-warning-soft', text: 'text-warning', color: 'warning' },
  success: { box: 'bg-success-soft', text: 'text-success', color: 'success' },
  neutral: { box: 'bg-surface-muted', text: 'text-subtle', color: 'subtle' },
};

export function TeamIndicators({ indicators }: { indicators: TeamIndicator[] }) {
  const tokens = useTokens();
  return (
    <View className="flex-row flex-wrap gap-1.5">
      {indicators.map((item) => {
        const tone = toneClass[item.tone];
        return (
          <View className={['flex-row items-center gap-1 rounded-full px-2.5 py-1', tone.box].join(' ')} key={item.key}>
            <Icon color={tokens[tone.color]} name={item.icon} size={12} />
            <Text className={['text-[11px] font-bold', tone.text].join(' ')}>{item.label}</Text>
          </View>
        );
      })}
    </View>
  );
}

/** Kennzahlen eines Teams in einer Zeile: Anzahl, Ø Stärke, w/m/d, Ø Alter. */
export function TeamFacts({ stats }: { stats: TeamStats }) {
  const genders = [
    stats.female ? `${stats.female} w` : null,
    stats.male ? `${stats.male} m` : null,
    stats.diverse ? `${stats.diverse} d` : null,
  ].filter(Boolean);
  return (
    <View className="flex-row flex-wrap gap-x-4 gap-y-1">
      <Fact label="Spieler" value={String(stats.count)} />
      <Fact label="Ø Stärke" value={formatSkill(stats.skillAvg)} />
      {genders.length ? <Fact label="Geschl." value={genders.join(' · ')} /> : null}
      {stats.ageAvg != null ? <Fact label="Ø Alter" value={stats.ageAvg.toLocaleString('de-DE', { maximumFractionDigits: 1 })} /> : null}
    </View>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <View className="flex-row items-baseline gap-1">
      <Text className="text-[15px] font-extrabold text-ink">{value}</Text>
      <Text className="text-[11px] font-semibold text-subtle">{label}</Text>
    </View>
  );
}

/** Ein Team als Feld: Kopf, Hinweise, Kennzahlen und die zugeordneten Spieler. Zugleich Drop-Zone. */
export function TeamField({
  team,
  players,
  stats,
  indicators,
  onEditTeam,
  onPlayerPress,
  emptyHint,
}: {
  team: TeamRow;
  players: Player[];
  stats: TeamStats;
  indicators: TeamIndicator[];
  onEditTeam: () => void;
  onPlayerPress: (player: Player) => void;
  emptyHint: string;
}) {
  const tokens = useTokens();
  const { ref, isOver, isDragging } = useDropZone(team.id);

  return (
    <View
      className={[
        'gap-3 rounded-[22px] border bg-surface p-4 shadow-sm',
        isOver ? 'border-primary bg-primary-soft' : isDragging ? 'border-dashed border-secondary' : 'border-line',
      ].join(' ')}
      ref={ref}
    >
      <Pressable
        accessibilityHint="Team bearbeiten"
        accessibilityRole="button"
        className="flex-row items-center gap-2 active:opacity-70"
        onPress={onEditTeam}
      >
        <View
          className="h-3 w-3 rounded-full border border-line"
          style={{ backgroundColor: team.color || tokens.secondary }}
        />
        <Text className="flex-1 text-[16px] font-extrabold text-ink" numberOfLines={1}>
          {team.number ? `${team.number} · ${team.name}` : team.name}
        </Text>
        <Icon color={tokens.subtle} name="edit" size={16} />
      </Pressable>
      <TeamIndicators indicators={indicators} />
      <TeamFacts stats={stats} />
      <View className="gap-1.5 border-t border-line pt-3">
        {players.length === 0 ? (
          <Text className="py-3 text-center text-[13px] text-subtle">{emptyHint}</Text>
        ) : (
          players.map((p) => <PlayerChip key={p.id} onPress={() => onPlayerPress(p)} player={p} />)
        )}
      </View>
    </View>
  );
}
