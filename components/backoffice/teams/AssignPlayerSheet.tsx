import { Text, View } from 'react-native';
import { Button } from '@/components/ui/Button';
import { Choice } from '@/components/ui/Choice';
import { FormSheet } from '@/components/ui/FormSheet';
import { SkillDot } from './PlayerChip';
import type { Player } from '@/lib/api/players';
import type { TeamRow } from '@/lib/api/teams';
import { genderLabel, type TeamIndicator, type TeamStats } from '@/lib/teams/balance';
import { TeamPicker } from './TeamPicker';

/**
 * Zuordnung per Antippen: Team wählen, fixieren, bearbeiten. Mobil der
 * Hauptweg, am Desktop die Alternative zum Ziehen (Tastatur, Screenreader).
 */
export function AssignPlayerSheet({
  player,
  teams,
  stats,
  indicators,
  onMove,
  onToggleLock,
  onEdit,
  onClose,
}: {
  player: Player | null;
  teams: TeamRow[];
  stats: Map<string, TeamStats>;
  indicators: Map<string, TeamIndicator[]>;
  onMove: (teamId: string | null) => void;
  onToggleLock: () => void;
  onEdit: () => void;
  onClose: () => void;
}) {
  return (
    <FormSheet
      onClose={onClose}
      secondaryAction={player ? <Button label="Bearbeiten" leftIcon="edit" onPress={onEdit} variant="outline" /> : null}
      title={player?.name ?? 'Spieler'}
      visible={player !== null}
    >
      {player ? (
        <>
          <View className="flex-row items-center gap-3">
            <SkillDot skill={player.skill} />
            <Text className="text-[13px] text-subtle">
              {[
                player.skill != null ? `Stärke ${player.skill} von 6` : 'nicht bewertet',
                player.gender ? genderLabel[player.gender] : null,
                player.age != null ? `${player.age} Jahre` : null,
              ]
                .filter(Boolean)
                .join(' · ')}
            </Text>
          </View>
          <TeamPicker
            indicators={indicators}
            label="Team"
            onChange={(teamId) => {
              onMove(teamId);
              onClose();
            }}
            stats={stats}
            teams={teams}
            value={player.team_id}
          />
          <Choice
            description="Die automatische Verteilung verschiebt diesen Spieler nicht."
            label="Im Team fixieren"
            onPress={onToggleLock}
            selected={player.locked}
          />
        </>
      ) : null}
    </FormSheet>
  );
}
