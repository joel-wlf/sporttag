import { Text, View } from 'react-native';
import { Badge } from '@/components/ui/Badge';
import type { Coverage, MatrixTeam, Warning } from '@/lib/schedule/matrix';

export function CoveragePanel({
  coverage,
  teams,
  gameNames,
  warnings,
}: {
  coverage: Coverage[];
  teams: MatrixTeam[];
  gameNames: Map<string, string>;
  warnings: Warning[];
}) {
  const teamById = new Map(teams.map((t) => [t.id, t]));
  return (
    <View className="gap-4">
      {warnings.length > 0 ? (
        <View className="gap-1.5 rounded-xl border border-warning bg-warning-soft p-3">
          <Text className="text-[13px] font-bold text-warning">Hinweise</Text>
          {warnings.map((w) => (
            <Text className="text-[13px] text-ink" key={w.key}>
              • {w.message}
            </Text>
          ))}
        </View>
      ) : null}
      <View className="gap-1">
        {coverage.map((c) => {
          const team = teamById.get(c.teamId);
          return (
            <View className="flex-row flex-wrap items-center gap-x-3 gap-y-1 border-b border-line py-2" key={c.teamId}>
              <View className="w-[160px] flex-row items-center gap-2">
                <View className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: team?.color ?? '#A9B58A' }} />
                <Text className="text-[14px] font-semibold text-ink" numberOfLines={1}>
                  {team?.name}
                </Text>
              </View>
              <Text className="w-[120px] text-[13px] text-subtle">
                {c.matches} Spiele · {c.idleRounds} frei
              </Text>
              <View className="flex-1 flex-row flex-wrap gap-1.5">
                {c.missingGames.length === 0 ? (
                  <Badge tone="success">Alle Spiele</Badge>
                ) : (
                  c.missingGames.map((g) => (
                    <Badge key={g} tone="neutral">
                      fehlt: {gameNames.get(g)}
                    </Badge>
                  ))
                )}
              </View>
            </View>
          );
        })}
      </View>
    </View>
  );
}
