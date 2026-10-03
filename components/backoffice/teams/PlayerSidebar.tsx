import { useMemo, useState } from 'react';
import { Text, TextInput, View } from 'react-native';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { PillChoice } from '@/components/ui/PillChoice';
import { useTokens } from '@/components/ui/theme';
import type { Player } from '@/lib/api/players';
import { useDropZone } from './drag';
import { PlayerChip } from './PlayerChip';

export const POOL_ZONE = 'pool';

type Filter = 'unassigned' | 'all';

/**
 * Spielerliste der Teamzusammenstellung. Am Desktop als Sidebar neben den
 * Team-Feldern, mobil als eigener Bereich. Zugleich Drop-Zone „Ohne Team“.
 */
export function PlayerSidebar({
  players,
  teamName,
  onAdd,
  onImport,
  onPlayerPress,
  dragHint,
}: {
  players: Player[];
  teamName: (teamId: string | null) => string | null;
  onAdd: () => void;
  onImport: () => void;
  onPlayerPress: (player: Player) => void;
  dragHint: boolean;
}) {
  const tokens = useTokens();
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<Filter>('unassigned');
  const { ref, isOver, isDragging } = useDropZone(POOL_ZONE);

  const unassignedCount = players.filter((p) => !p.team_id).length;
  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return players.filter(
      (p) => (filter === 'all' || !p.team_id) && (!q || p.name.toLowerCase().includes(q)),
    );
  }, [players, query, filter]);

  return (
    <View
      className={[
        'gap-3 rounded-[22px] border bg-surface p-4 shadow-sm',
        isOver ? 'border-primary bg-primary-soft' : isDragging ? 'border-dashed border-secondary' : 'border-line',
      ].join(' ')}
      ref={ref}
    >
      <View className="flex-row items-center justify-between gap-2">
        <View className="gap-0.5">
          <Text className="text-[16px] font-extrabold text-ink">Spieler</Text>
          <Text className="text-[12px] text-subtle">
            {players.length} gesamt · {unassignedCount} ohne Team
          </Text>
        </View>
        <View className="flex-row gap-2">
          <Button accessibilityLabel="Spieler importieren" leftIcon="upload" onPress={onImport} size="sm" variant="outline" />
          <Button accessibilityLabel="Spieler anlegen" leftIcon="plus" onPress={onAdd} size="sm" />
        </View>
      </View>

      <View className="h-11 flex-row items-center gap-2 rounded-[14px] border border-line bg-canvas px-3">
        <Icon color={tokens.subtle} name="user" size={16} />
        <TextInput
          accessibilityLabel="Spieler suchen"
          className="h-full flex-1 text-[14px] text-ink outline-none"
          onChangeText={setQuery}
          placeholder="Suchen"
          placeholderTextColor={tokens.subtle}
          value={query}
        />
      </View>

      <PillChoice
        accessibilityLabel="Filter"
        onChange={setFilter}
        options={[
          { value: 'unassigned', label: `Ohne Team (${unassignedCount})` },
          { value: 'all', label: `Alle (${players.length})` },
        ]}
        value={filter}
      />

      <View className="gap-1.5">
        {visible.length === 0 ? (
          <Text className="py-4 text-center text-[13px] text-subtle">
            {players.length === 0
              ? 'Noch keine Spieler. Lege sie an oder importiere eine CSV-Liste.'
              : filter === 'unassigned' && unassignedCount === 0
                ? 'Alle Spieler sind einem Team zugeordnet.'
                : 'Keine Treffer.'}
          </Text>
        ) : (
          visible.map((p) => (
            <View className="gap-0.5" key={p.id}>
              <PlayerChip onPress={() => onPlayerPress(p)} player={p} />
              {filter === 'all' && p.team_id ? (
                <Text className="pl-10 text-[11px] text-subtle">{teamName(p.team_id)}</Text>
              ) : null}
            </View>
          ))
        )}
      </View>
      {dragHint && players.length > 0 ? (
        <Text className="text-[12px] text-subtle">Zum Zuordnen in ein Team ziehen oder antippen. Hierher ziehen entfernt aus dem Team.</Text>
      ) : null}
    </View>
  );
}
