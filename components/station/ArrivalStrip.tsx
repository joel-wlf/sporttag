import { Pressable, Text, View } from 'react-native';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { useTokens } from '@/components/ui/theme';
import { delayTone, formatDelay, type DelayTone } from '@/lib/live/timeline';

/**
 * Laufzettel am Kopf der Ergebnisseite: einchecken, wenn eine Gruppe an der
 * Station ankommt, und ausschicken, wenn sie weiterzieht. Die Uhrzeit spielt
 * dabei bewusst keine Hauptrolle — sichtbar ist, wie lange die Gruppe schon da
 * ist und wie weit sie vom Plan abweicht (docs/datenkonzept.md 11.7).
 */

export type ArrivalRow = {
  participantId: string;
  teamName: string;
  arrivedAt: string | null;
  releasedAt: string | null;
  /** Verzug der Ankunft gegenüber dem geplanten Rundenstart. */
  delayMs: number | null;
};

const toneClass: Record<DelayTone, string> = {
  ahead: 'bg-success-soft text-success',
  onTime: 'bg-surface-muted text-subtle',
  slipping: 'bg-warning-soft text-warning',
  late: 'bg-danger-soft text-danger',
};

function minutesSince(iso: string, now: Date) {
  return Math.max(0, Math.round((now.getTime() - new Date(iso).getTime()) / 60000));
}

function statusText(row: ArrivalRow, now: Date): string {
  if (row.releasedAt) {
    const minutes = minutesSince(row.releasedAt, now);
    return minutes === 0 ? 'gerade weitergeschickt' : `weitergeschickt vor ${minutes} min`;
  }
  if (row.arrivedAt) {
    const minutes = minutesSince(row.arrivedAt, now);
    return minutes === 0 ? 'gerade eingetroffen' : `seit ${minutes} min an der Station`;
  }
  return 'noch nicht eingetroffen';
}

export function ArrivalStrip({
  rows,
  now,
  disabled,
  disabledHint,
  onArrive,
  onRelease,
  onUndoArrival,
  onUndoRelease,
}: {
  rows: ArrivalRow[];
  now: Date;
  disabled?: boolean;
  disabledHint?: string;
  onArrive: (participantId: string) => void;
  onRelease: (participantId: string) => void;
  onUndoArrival: (participantId: string) => void;
  onUndoRelease: (participantId: string) => void;
}) {
  const tokens = useTokens();
  if (rows.length === 0) return null;

  const openCount = rows.filter((r) => !r.releasedAt).length;

  return (
    <View className="gap-2 rounded-card border border-line bg-surface p-4">
      <View className="flex-row items-center justify-between gap-2">
        <Text className="text-2xs font-black tracking-[0.8px] text-subtle">GRUPPEN AN DER STATION</Text>
        <Text className="text-2xs font-bold text-subtle">
          {rows.length - openCount}/{rows.length} weiter
        </Text>
      </View>

      {rows.map((row) => {
        const tone = delayTone(row.delayMs);
        const released = Boolean(row.releasedAt);
        const arrived = Boolean(row.arrivedAt);
        return (
          <View className="flex-row items-center gap-3" key={row.participantId}>
            {/* Ein Fehltipp ist an der Station wahrscheinlich: die Zeile selbst
                nimmt die Ankunft wieder zurück. */}
            <Pressable
              accessibilityHint={arrived && !released ? 'Nimmt die Ankunft zurück' : undefined}
              accessibilityLabel={arrived && !released ? `Ankunft von ${row.teamName} zurücknehmen` : undefined}
              accessibilityRole={arrived && !released ? 'button' : undefined}
              className="min-w-0 flex-1 gap-0.5"
              disabled={!arrived || released || disabled}
              onPress={() => onUndoArrival(row.participantId)}
            >
              <View className="flex-row items-center gap-2">
                <Text className={['text-sm font-extrabold', released ? 'text-subtle' : 'text-ink'].join(' ')} numberOfLines={1}>
                  {row.teamName}
                </Text>
                {arrived && row.delayMs !== null ? (
                  <Text className={['rounded-full px-2 py-0.5 text-2xs font-black', toneClass[tone]].join(' ')}>
                    {formatDelay(row.delayMs)}
                  </Text>
                ) : null}
              </View>
              <Text className="text-2xs text-subtle" numberOfLines={1}>
                {statusText(row, now)}
              </Text>
            </Pressable>

            {released ? (
              <Pressable
                accessibilityLabel={`Weiterschickung von ${row.teamName} zurücknehmen`}
                accessibilityRole="button"
                className="flex-row items-center gap-1.5 rounded-full bg-success-soft px-3 py-2 active:opacity-70"
                onPress={() => onUndoRelease(row.participantId)}
              >
                <Icon color={tokens.success} name="check-circle" size={15} />
                <Text className="text-2xs font-black text-success">WEITER</Text>
              </Pressable>
            ) : arrived ? (
              <Button
                haptic="medium"
                isDisabled={disabled}
                label="Ausschicken"
                onPress={() => onRelease(row.participantId)}
                size="sm"
                variant="secondary"
              />
            ) : (
              <Button
                haptic="medium"
                isDisabled={disabled}
                label="Eingetroffen"
                leftIcon="check"
                onPress={() => onArrive(row.participantId)}
                size="sm"
                variant="outline"
              />
            )}
          </View>
        );
      })}

      {disabled && disabledHint ? <Text className="text-2xs text-warning">{disabledHint}</Text> : null}
    </View>
  );
}
