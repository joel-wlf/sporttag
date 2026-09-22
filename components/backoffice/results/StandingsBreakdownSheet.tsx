import { Text, View } from 'react-native';
import { FormSheet } from '@/components/ui/FormSheet';
import type { TeamBreakdownEntry } from '@/lib/results/derive';

function formatPoints(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

export function StandingsBreakdownSheet({
  teamName,
  entries,
  onClose,
}: {
  teamName: string | null;
  entries: TeamBreakdownEntry[];
  onClose: () => void;
}) {
  return (
    <FormSheet onClose={onClose} title={teamName ? `Punkte · ${teamName}` : 'Punkte'} visible={Boolean(teamName)}>
      {entries.length === 0 ? (
        <Text className="text-[13px] text-subtle">Noch keine gewerteten Matches.</Text>
      ) : (
        <View className="gap-0">
          {entries.map((entry) => (
            <View className="flex-row items-center justify-between gap-3 border-b border-line py-2.5" key={entry.matchId}>
              <View className="flex-1 gap-0.5">
                <Text className="text-[13px] font-bold text-ink" numberOfLines={1}>
                  {entry.stationName} · {entry.gameName}
                </Text>
                <Text className="text-[12px] text-subtle">{entry.valueText}</Text>
              </View>
              <Text className="text-[14px] font-extrabold text-ink">{formatPoints(entry.points)} Pkt.</Text>
            </View>
          ))}
        </View>
      )}
    </FormSheet>
  );
}
