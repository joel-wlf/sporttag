import { Text, View } from 'react-native';
import { Badge } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';
import { DataTable, DataTableText } from '@/components/ui/DataTable';
import { ListRow } from '@/components/ui/ListRow';
import { useDesktop } from '@/components/ui/useDesktop';
import type { StandingsRow } from '@/lib/api/results';

function formatPoints(value: number | null): string {
  if (value === null) return '0';
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

/** Rangtext mit sichtbar geteilten Plätzen, z. B. „1.“ zweimal statt „1./2.“. */
function rankLabel(rank: number | null): string {
  return rank === null ? '–' : `${rank}.`;
}

export function StandingsTable({
  rows,
  final,
  onSelectTeam,
}: {
  rows: StandingsRow[];
  final: boolean;
  onSelectTeam: (teamId: string) => void;
}) {
  const desktop = useDesktop();
  const showWdl = rows.some((r) => (r.wins ?? 0) + (r.draws ?? 0) + (r.losses ?? 0) > 0);

  const header = (
    <View className="flex-row items-center gap-2">
      <Badge tone={final ? 'success' : 'warning'}>{final ? 'Endgültig' : 'Vorläufig'}</Badge>
      <Text className="text-[12px] text-subtle">
        {final ? 'Abschlussabgleich bestätigt' : 'Wird final, sobald der Abschlussabgleich bestätigt ist'}
      </Text>
    </View>
  );

  if (rows.length === 0) {
    return (
      <View className="gap-3">
        {header}
        <Card variant="muted">
          <Text className="text-center text-[13px] text-subtle">Noch keine gewerteten Ergebnisse.</Text>
        </Card>
      </View>
    );
  }

  if (desktop) {
    return (
      <View className="gap-3">
        {header}
        <Card className="overflow-hidden p-0">
          <DataTable
            columns={[
              { key: 'rank', header: 'Platz', width: 64, render: (r: StandingsRow) => <DataTableText>{rankLabel(r.rank)}</DataTableText> },
              { key: 'team', header: 'Team', flex: 2, render: (r: StandingsRow) => <DataTableText>{r.team_name}</DataTableText> },
              { key: 'played', header: 'Spiele', width: 80, align: 'right', render: (r: StandingsRow) => <DataTableText subtle>{r.matches_played ?? 0}</DataTableText> },
              ...(showWdl
                ? [
                    {
                      key: 'wdl',
                      header: 'S/U/N',
                      width: 90,
                      align: 'right' as const,
                      render: (r: StandingsRow) => <DataTableText subtle>{`${r.wins ?? 0}/${r.draws ?? 0}/${r.losses ?? 0}`}</DataTableText>,
                    },
                  ]
                : []),
              { key: 'points', header: 'Punkte', width: 90, align: 'right', render: (r: StandingsRow) => <DataTableText>{formatPoints(r.table_points)}</DataTableText> },
            ]}
            data={rows}
            keyExtractor={(r) => r.team_id ?? ''}
            onRowPress={(r) => r.team_id && onSelectTeam(r.team_id)}
          />
        </Card>
      </View>
    );
  }

  return (
    <View className="gap-3">
      {header}
      <Card>
        <View className="gap-1">
          {rows.map((r) => (
            <ListRow
              key={r.team_id}
              onPress={() => r.team_id && onSelectTeam(r.team_id)}
              showChevron
              subtitle={`${rankLabel(r.rank)} Platz · ${r.matches_played ?? 0} Spiele`}
              title={r.team_name ?? 'Team'}
              value={`${formatPoints(r.table_points)} Pkt.`}
            />
          ))}
        </View>
      </Card>
    </View>
  );
}
