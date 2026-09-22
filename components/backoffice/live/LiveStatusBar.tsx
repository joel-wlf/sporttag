import { Platform, Text, View } from 'react-native';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Icon } from '@/components/ui/Icon';
import { useTokens } from '@/components/ui/theme';
import type { RoundRow } from '@/lib/api/schedule';
import { roundProgress } from '@/lib/live/derive';

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
}

function formatAge(ms: number) {
  const seconds = Math.max(0, Math.round(ms / 1000));
  if (seconds < 60) return `vor ${seconds} s`;
  return `vor ${Math.round(seconds / 60)} min`;
}

/**
 * Kopfleiste des Live-Cockpits: welche Runde gerade angezeigt wird (mit
 * Blättern und Sprung zur aktuellen Runde) und wie frisch die Daten sind.
 */
export function LiveStatusBar({
  round,
  roundNumber,
  roundCount,
  isCurrent,
  hasPrev,
  hasNext,
  onPrev,
  onNext,
  onNow,
  onOpenSchedule,
  lastUpdated,
  now,
  connected,
  unreachableDevices,
  liveActivity,
}: {
  round: RoundRow | null;
  roundNumber: number;
  roundCount: number;
  isCurrent: boolean;
  hasPrev: boolean;
  hasNext: boolean;
  onPrev: () => void;
  onNext: () => void;
  onNow: () => void;
  onOpenSchedule: () => void;
  lastUpdated: Date;
  now: Date;
  connected: boolean;
  unreachableDevices: number;
  /** Schalter für die Event-Health-Live-Activity (nur iOS, siehe useEventHealthLiveActivity). */
  liveActivity?: { active: boolean; onToggle: () => void };
}) {
  const tokens = useTokens();
  return (
    <Card className="gap-3 p-4">
      <View className="flex-row items-center gap-3">
        <Button accessibilityLabel="Vorherige Runde" isDisabled={!hasPrev} leftIcon="arrow-left" onPress={onPrev} size="sm" variant="outline" />
        <View className="min-w-0 flex-1 items-center">
          <Text className="text-[16px] font-extrabold text-ink" numberOfLines={1}>
            {round ? `Runde ${roundNumber} von ${roundCount}` : 'Noch keine Runden'}
          </Text>
          {/* Der Fortschritt steht vorn: eine Runde endet, wenn das letzte
              Spiel fertig ist, nicht wenn die Uhr es sagt. Die geplante Zeit
              bleibt als Orientierung stehen (docs/datenkonzept.md 11.7). */}
          <Text className="text-center text-[12px] font-semibold text-subtle" numberOfLines={2}>
            {round ? roundProgress(round, now) : 'Im Zeitplan sind noch keine Runden angelegt'}
          </Text>
          {round ? (
            <Text className="text-center text-[11px] text-subtle opacity-70" numberOfLines={1}>
              geplant ca. {formatTime(round.starts_at)}–{formatTime(round.ends_at)}
            </Text>
          ) : null}
        </View>
        <Button accessibilityLabel="Nächste Runde" isDisabled={!hasNext} leftIcon="chevron-right" onPress={onNext} size="sm" variant="outline" />
      </View>

      <View className="flex-row flex-wrap items-center justify-between gap-2 border-t border-line pt-3">
        <View className="flex-row items-center gap-2 rounded-full bg-surface-muted px-3 py-1.5">
          <View className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: connected ? tokens.success : tokens.danger }} />
          <Text className="text-[12px] font-bold text-subtle">
            {connected ? 'Live' : 'Keine Live-Verbindung'} · aktualisiert {formatAge(now.getTime() - lastUpdated.getTime())}
          </Text>
        </View>
        {round && !isCurrent ? <Button label="Zur aktuellen Runde" onPress={onNow} size="sm" variant="secondary" /> : null}
        {!round ? <Button label="Zeitplan anlegen" onPress={onOpenSchedule} size="sm" variant="secondary" /> : null}
        {liveActivity && Platform.OS === 'ios' ? (
          <Button
            label={liveActivity.active ? 'Live Activity aus' : 'Auf Sperrbildschirm zeigen'}
            leftIcon={liveActivity.active ? 'bell-off' : 'bell'}
            onPress={liveActivity.onToggle}
            size="sm"
            variant={liveActivity.active ? 'secondary' : 'outline'}
          />
        ) : null}
      </View>

      {unreachableDevices > 0 ? (
        <View className="flex-row items-center gap-2 rounded-2xl bg-warning-soft px-4 py-3">
          <Icon color={tokens.warning} name="wifi-off" size={16} />
          <Text className="flex-1 text-[13px] font-semibold text-warning">
            {unreachableDevices} {unreachableDevices === 1 ? 'Gerät meldet' : 'Geräte melden'} sich seit über 5 min nicht. Was dort passiert, ist hier evtl. noch
            nicht sichtbar.
          </Text>
        </View>
      ) : null}
    </Card>
  );
}
