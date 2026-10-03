import { useRouter } from 'expo-router';
import { Text, View } from 'react-native';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { useTokens } from '@/components/ui/theme';
import { useDeviceSyncOverview } from '@/lib/api/devices';
import { useActiveEvent } from '@/providers/ActiveEventProvider';

/**
 * Hinweis für Planungs- und Einstellungsseiten einer veröffentlichten oder
 * laufenden Veranstaltung: Änderungen erhöhen die Planversion, Stationsgeräte
 * laden den Plan beim nächsten Sync neu (docs/datenkonzept.md 8.6). Zeigt,
 * wie viele Geräte schon auf dem aktuellen Stand sind – ehrlich nach dem
 * letzten Gerätebericht, nicht als Zusage.
 */
export function PlanVersionNotice() {
  const tokens = useTokens();
  const router = useRouter();
  const { eventId, event } = useActiveEvent();
  const { data: devices } = useDeviceSyncOverview(
    event && event.status !== 'draft' ? eventId : null,
  );

  if (!event || event.status === 'draft') return null;

  const active = (devices ?? []).filter((d) => !d.revoked_at && d.expected);
  const current = active.filter((d) => d.downloaded_plan_version === event.plan_version).length;
  const behind = active.length - current;

  return (
    <View className="w-full max-w-[760px] gap-2 rounded-2xl border border-line bg-surface-muted px-4 py-3">
      <View className="flex-row items-start gap-2">
        <View className="pt-0.5">
          <Icon color={tokens.primary} name="refresh" size={16} />
        </View>
        <View className="min-w-0 flex-1 gap-0.5">
          <Text className="text-[13px] font-bold text-ink">
            {event.status === 'running' ? 'Läuft' : 'Veröffentlicht'} · Planversion{' '}
            {event.plan_version}
          </Text>
          <Text className="text-[13px] leading-5 text-subtle">
            Änderungen gelten sofort. Stationsgeräte laden den neuen Plan beim nächsten Sync. Noch nicht
            übertragene Ergebnisse werden weiter gewertet; nur wenn du bei einem Match Station oder Teams
            änderst, kommt dessen Ergebnis unter Ergebnisse als „Konflikt“ zur Klärung an. Matches mit
            Ergebnissen lassen sich nicht mehr löschen – im Live-Betrieb absagen.
          </Text>
          {active.length > 0 ? (
            <Text
              className={[
                'text-[13px] font-semibold',
                behind > 0 ? 'text-warning' : 'text-success',
              ].join(' ')}
            >
              {behind > 0
                ? `${current} von ${active.length} ${active.length === 1 ? 'Gerät hat' : 'Geräten haben'} Version ${event.plan_version} – ${behind} noch nicht.`
                : active.length === 1
                  ? `Das verbundene Gerät hat Version ${event.plan_version}.`
                  : `Alle ${active.length} Geräte haben Version ${event.plan_version}.`}
            </Text>
          ) : null}
        </View>
      </View>
      {behind > 0 ? (
        <Button
          className="self-start"
          label="Geräte ansehen"
          onPress={() => router.navigate('/more/devices')}
          rightIcon="chevron-right"
          size="sm"
          variant="outline"
        />
      ) : null}
    </View>
  );
}
