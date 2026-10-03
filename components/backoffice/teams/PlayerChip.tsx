import { Platform, Pressable, Text, View } from 'react-native';
import { Icon } from '@/components/ui/Icon';
import { useTokens } from '@/components/ui/theme';
import { genderLabel, genderShort } from '@/lib/teams/balance';
import type { Player } from '@/lib/api/players';
import { useDraggable } from './drag';

/** Kompakte Spielerzeile: Name, Geschlecht, Stärke 1–6, Alter, fixiert. */
export function PlayerChip({ player, onPress }: { player: Player; onPress: () => void }) {
  const tokens = useTokens();
  const dragProps = useDraggable(player.id, player.name);

  const facts = [
    player.gender ? genderLabel[player.gender] : null,
    player.skill != null ? `Stärke ${player.skill} von 6` : 'nicht bewertet',
    player.age != null ? `${player.age} Jahre` : null,
    player.locked ? 'fixiert' : null,
  ]
    .filter(Boolean)
    .join(', ');

  return (
    <View {...dragProps} style={Platform.OS === 'web' ? ({ userSelect: 'none', cursor: dragProps ? 'grab' : undefined } as object) : undefined}>
      <Pressable
        accessibilityHint="Öffnet die Teamzuordnung"
        accessibilityLabel={`${player.name}, ${facts}`}
        accessibilityRole="button"
        className="min-h-[40px] flex-row items-center gap-2 rounded-xl border border-line bg-surface px-2.5 py-1.5 active:opacity-70"
        onPress={onPress}
      >
        <SkillDot skill={player.skill} />
        <Text className="flex-1 text-[13px] font-semibold text-ink" numberOfLines={1}>
          {player.name}
        </Text>
        {player.gender ? (
          <Text className="w-4 text-center text-[12px] font-bold text-subtle">{genderShort[player.gender]}</Text>
        ) : null}
        {player.age != null ? <Text className="text-[12px] text-subtle">{player.age}</Text> : null}
        {player.locked ? <Icon color={tokens.primary} name="shield" size={14} /> : null}
      </Pressable>
    </View>
  );
}

/** Stärke als Zahl in einem Kreis; je stärker, desto kräftiger gefüllt. */
export function SkillDot({ skill }: { skill: number | null }) {
  if (skill == null) {
    return (
      <View className="h-6 w-6 items-center justify-center rounded-full border border-dashed border-line">
        <Text className="text-[11px] font-bold text-subtle">–</Text>
      </View>
    );
  }
  return (
    <View
      className={[
        'h-6 w-6 items-center justify-center rounded-full',
        skill >= 5 ? 'bg-primary' : skill >= 3 ? 'bg-secondary' : 'bg-surface-muted border border-line',
      ].join(' ')}
    >
      <Text className={['text-[11px] font-black', skill >= 5 ? 'text-on-primary' : 'text-ink'].join(' ')}>
        {skill}
      </Text>
    </View>
  );
}
