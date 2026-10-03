import { Text, View } from 'react-native';
import { Card } from '@/components/ui/Card';
import { Icon } from '@/components/ui/Icon';
import { useTokens } from '@/components/ui/theme';
import { useDesktop } from '@/components/ui/useDesktop';
import { ViewSwitch } from '@/components/ui/ViewSwitch';
import { delayTone, formatDelay, formatDuration, type Timeline } from '@/lib/live/timeline';
import { GanttLegend, TimelineGantt, type GanttMode } from './TimelineGantt';

/**
 * Die Zeitleiste als eigene Ansicht im Live-Betrieb: oben die Kennzahlen, die
 * am Veranstaltungstag zählen (Verzug, Wartezeit, Leerlauf), darunter das
 * Gantt-Diagramm. Nicht "wie spät ist es", sondern "wie weit sind wir".
 */

function Metric({ label, value, tone }: { label: string; value: string; tone?: 'default' | 'warning' | 'danger' | 'success' }) {
  const valueClass =
    tone === 'danger' ? 'text-danger' : tone === 'warning' ? 'text-warning' : tone === 'success' ? 'text-success' : 'text-ink';
  return (
    <View className="min-w-[96px] gap-0.5">
      <Text className="text-2xs font-black tracking-[0.6px] text-subtle">{label}</Text>
      <Text className={['text-[19px] font-extrabold', valueClass].join(' ')}>{value}</Text>
    </View>
  );
}

function ModeToggle({ value, onChange }: { value: GanttMode; onChange: (next: GanttMode) => void }) {
  return (
    <ViewSwitch
      accessibilityLabel="Zeitleiste gliedern"
      onChange={onChange}
      options={[
        { value: 'station', label: 'Nach Station' },
        { value: 'team', label: 'Nach Gruppe' },
      ]}
      value={value}
    />
  );
}

export function TimelinePanel({
  timeline,
  mode,
  onModeChange,
  now,
  timezone,
  onSelectStation,
  selectedStationId,
}: {
  timeline: Timeline;
  mode: GanttMode;
  onModeChange: (next: GanttMode) => void;
  now: Date;
  timezone: string;
  onSelectStation?: (stationId: string) => void;
  selectedStationId?: string | null;
}) {
  const tokens = useTokens();
  const desktop = useDesktop();

  const waiting = timeline.teams.filter((t) => t.currentLeg?.phase === 'waiting').length;
  const idleMs = timeline.stations.reduce((sum, s) => sum + s.idleMs, 0);
  const worstTone = delayTone(timeline.worstDelayMs);
  const behind = timeline.teams.filter((t) => delayTone(t.delayMs) === 'late').length;

  return (
    <Card className="gap-4">
      <View className="gap-3">
        <View className="w-full flex-row flex-wrap gap-x-6 gap-y-3">
          <Metric
            label="VERZUG TYPISCH"
            tone={delayTone(timeline.medianDelayMs) === 'late' ? 'danger' : delayTone(timeline.medianDelayMs) === 'slipping' ? 'warning' : 'default'}
            value={timeline.medianDelayMs === null ? '–' : formatDelay(timeline.medianDelayMs)}
          />
          <Metric
            label="GRÖSSTER VERZUG"
            tone={worstTone === 'late' ? 'danger' : worstTone === 'slipping' ? 'warning' : 'default'}
            value={timeline.worstDelayMs === null ? '–' : formatDelay(timeline.worstDelayMs)}
          />
          <Metric label="WARTEN GERADE" tone={waiting > 0 ? 'warning' : 'default'} value={`${waiting}`} />
          <Metric label="LEERLAUF GESAMT" value={formatDuration(idleMs) ?? '–'} />
        </View>
        <ModeToggle onChange={onModeChange} value={mode} />
      </View>

      {behind > 0 ? (
        <View className="flex-row items-center gap-2 rounded-2xl bg-warning-soft px-4 py-3">
          <Icon color={tokens.warning} name="alert" size={16} />
          <Text className="flex-1 text-[13px] font-semibold text-warning">
            {behind} {behind === 1 ? 'Gruppe hängt' : 'Gruppen hängen'} deutlich hinterher. Der Plan verschiebt sich —
            das ist normal, solange der Abstand nicht weiter wächst.
          </Text>
        </View>
      ) : null}

      {timeline.offPlanCount > 0 ? (
        <View className="flex-row items-center gap-2 rounded-2xl bg-surface-muted px-4 py-3">
          <Icon color={tokens.subtle} name="clock" size={16} />
          <Text className="flex-1 text-[13px] text-ink">
            {timeline.offPlanCount === 1 ? '1 Ankunft liegt' : `${timeline.offPlanCount} Ankünfte liegen`} über eine Stunde vor
            der aktuellen Planzeit – der Zeitplan wurde vermutlich danach verschoben. Sie zählen nicht zum Verzug.
          </Text>
        </View>
      ) : null}

      <TimelineGantt
        mode={mode}
        now={now}
        onSelectStation={onSelectStation}
        selectedStationId={selectedStationId}
        timeline={timeline}
        timezone={timezone}
        vertical={!desktop}
      />

      <GanttLegend mode={mode} />
    </Card>
  );
}
