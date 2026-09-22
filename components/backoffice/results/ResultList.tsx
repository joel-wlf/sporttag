import { View } from 'react-native';
import { Badge } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';
import { DataTable, DataTableText } from '@/components/ui/DataTable';
import { ListRow } from '@/components/ui/ListRow';
import { useDesktop } from '@/components/ui/useDesktop';
import { blockLabel, roundLabel } from '@/lib/api/schedule';
import { describeCurrentValues, resultStatusLabel, type ResultRow } from '@/lib/results/derive';
import { resultBadgeTone } from './resultStatusBadge';

function teamsLabel(row: ResultRow): string {
  return row.participants.map((p) => p.team?.name ?? '–').join(' – ');
}

function roundTimeLabel(row: ResultRow): string {
  if (!row.round) return '–';
  const time = new Date(row.round.starts_at).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
  return `${row.block ? blockLabel(row.block) : ''} · ${roundLabel(row.round)} · ${time}`.replace(/^ · /, '');
}

export function ResultList({ rows, onSelect }: { rows: ResultRow[]; onSelect: (row: ResultRow) => void }) {
  const desktop = useDesktop();

  if (desktop) {
    return (
      <Card className="overflow-hidden p-0">
        <DataTable
          columns={[
            { key: 'round', header: 'Runde', flex: 1.4, render: (r: ResultRow) => <DataTableText subtle>{roundTimeLabel(r)}</DataTableText> },
            {
              key: 'station',
              header: 'Station / Spiel',
              flex: 1.4,
              render: (r: ResultRow) => <DataTableText>{[r.station?.name, r.game?.name].filter(Boolean).join(' · ') || '–'}</DataTableText>,
            },
            { key: 'teams', header: 'Teams', flex: 1.6, render: (r: ResultRow) => <DataTableText>{teamsLabel(r)}</DataTableText> },
            { key: 'result', header: 'Ergebnis', flex: 1.4, render: (r: ResultRow) => <DataTableText subtle>{describeCurrentValues(r)}</DataTableText> },
            { key: 'version', header: 'Version', width: 72, render: (r: ResultRow) => <DataTableText subtle>{r.match.current_result_version}</DataTableText> },
            {
              key: 'status',
              header: 'Status',
              width: 140,
              render: (r: ResultRow) => <Badge tone={resultBadgeTone[r.status]}>{resultStatusLabel[r.status]}</Badge>,
            },
          ]}
          data={rows}
          keyExtractor={(r) => r.match.id}
          onRowPress={onSelect}
        />
      </Card>
    );
  }

  return (
    <Card>
      <View className="gap-1">
        {rows.map((row) => (
          <ListRow
            key={row.match.id}
            onPress={() => onSelect(row)}
            showChevron
            subtitle={`${teamsLabel(row)} · ${describeCurrentValues(row)}`}
            title={[row.station?.name, row.game?.name].filter(Boolean).join(' · ') || 'Match'}
            value={resultStatusLabel[row.status]}
          />
        ))}
      </View>
    </Card>
  );
}
