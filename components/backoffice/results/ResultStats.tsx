import { View } from 'react-native';
import { StatCard } from '@/components/ui/StatCard';
import type { ResultRow } from '@/lib/results/derive';

export function ResultStats({ rows }: { rows: ResultRow[] }) {
  const count = (status: ResultRow['status']) => rows.filter((r) => r.status === status).length;
  const accepted = count('accepted') + count('corrected');
  const open = count('open');
  const needsReview = count('needs_review');
  const conflict = count('conflict');

  return (
    <View className="flex-row flex-wrap gap-3">
      <StatCard hint="im Tabellenstand" icon="check-circle" label="Angenommen" value={String(accepted)} />
      <StatCard hint="noch kein Ergebnis" icon="clock" label="Offen" value={String(open)} />
      <StatCard hint="Korrekturvorschlag prüfen" icon="alert" label="Klärung nötig" value={String(needsReview)} />
      <StatCard hint="widersprüchliche Abgaben" icon="alert" label="Konflikte" value={String(conflict)} />
    </View>
  );
}
