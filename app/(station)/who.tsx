import { useRouter } from 'expo-router';
import { Pressable, Text, View } from 'react-native';
import { Screen } from '@/components/layout/Screen';
import { MissingPackage } from '@/components/station/MissingPackage';
import { Avatar } from '@/components/ui/Avatar';
import { EmptyState } from '@/components/ui/EmptyState';
import { Icon } from '@/components/ui/Icon';
import { useTokens } from '@/components/ui/theme';
import { confirmAsync } from '@/lib/confirm';
import { haptic } from '@/lib/haptics';
import { resetToJoin } from '@/lib/station/navigation';
import { useStationSession } from '@/providers/StationSessionProvider';

function initialsOf(name: string) {
  const parts = name.trim().split(/\s+/);
  return parts
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join('');
}

export default function StationWhoScreen() {
  const router = useRouter();
  const tokens = useTokens();
  const { pkg, staffId, selectStaff, leave, resetDevice, syncCounts } = useStationSession();
  // Vom Tagesplan aus geöffnet ("Person wechseln") liegt der Tagesplan
  // darunter; direkt nach dem Beitritt ist die Personenwahl die Wurzel.
  const canGoBack = router.canGoBack();

  const select = (id: string) => {
    haptic('success');
    selectStaff(id);
    if (canGoBack) router.back();
    else router.replace('/assignment');
  };

  const leaveEvent = async () => {
    const pending = syncCounts.pending + syncCounts.sending;
    if (
      !(await confirmAsync(
        `${pending > 0 ? `${pending} Ergebnis(se) sind noch nicht übertragen; sie bleiben auf dem Gerät gesichert. ` : ''}Ein offener Check-in wird beendet. Zurück geht es über „Zurück zu …“ auf dem Beitrittsbildschirm, auch ohne Internet und ohne Code.`,
        'Veranstaltung verlassen?',
        'Verlassen',
      ))
    ) {
      return;
    }
    haptic('light');
    await leave();
    resetToJoin(router);
  };

  const reset = async () => {
    if (
      !(await confirmAsync(
        `${syncCounts.pending + syncCounts.sending > 0 ? `ACHTUNG: ${syncCounts.pending + syncCounts.sending} Ergebnis(se) sind noch nicht übertragen und gehen verloren. ` : ''}Alle lokalen Daten dieses Geräts werden gelöscht. Danach ist ein neuer Veranstaltungscode nötig.`,
        'Gerät zurücksetzen?',
        'Zurücksetzen',
      ))
    ) {
      return;
    }
    haptic('warning');
    await resetDevice();
    resetToJoin(router);
  };

  const staff = pkg?.event_staff ?? [];

  return (
    <Screen density="compact" size="narrow">
      <View className="gap-3">
        {canGoBack ? (
          <Pressable
            accessibilityLabel="Zurück zum Tagesplan"
            accessibilityRole="button"
            className="h-11 w-11 items-center justify-center self-start rounded-full border border-line bg-surface active:opacity-70"
            onPress={() => router.back()}
          >
            <Icon color={tokens.text} name="arrow-left" size={17} />
          </Pressable>
        ) : null}
        <View className="gap-1">
          <Text accessibilityRole="header" className="text-xl font-extrabold text-ink">
            Wer betreut heute?
          </Text>
          <Text className="text-sm leading-5 text-subtle">
            {pkg?.event.name ? `${pkg.event.name} · ` : ''}Wähle deinen Namen, dann erscheint dein
            Tagesplan.
          </Text>
        </View>
      </View>

      {!pkg ? (
        <MissingPackage title="Keine Betreuungsliste" />
      ) : staff.length === 0 ? (
        <EmptyState
          description="Im Backoffice ist noch niemand in der Betreuungsliste eingetragen."
          icon="user"
          title="Keine Betreuung geplant"
        />
      ) : (
        <View className="flex-1 gap-2">
          {staff.map((person) => {
            const current = person.id === staffId;
            return (
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ selected: current }}
                className={[
                  'flex-row items-center gap-3 rounded-card border bg-surface px-4 py-3.5 active:bg-primary-soft',
                  current ? 'border-primary' : 'border-line',
                ].join(' ')}
                key={person.id}
                onPress={() => select(person.id)}
              >
                <Avatar initials={initialsOf(person.display_name)} size={44} />
                <View className="flex-1">
                  <Text className="text-base font-bold text-ink">{person.display_name}</Text>
                </View>
                <Icon
                  name={current ? 'check-circle' : 'chevron-right'}
                  color={current ? tokens.primary : tokens.subtle}
                  size={18}
                />
              </Pressable>
            );
          })}
        </View>
      )}

      <View className="items-center pb-2">
        <Pressable
          accessibilityRole="button"
          className="min-h-[44px] items-center justify-center px-4 active:opacity-60"
          onPress={() => void leaveEvent()}
        >
          <Text className="text-sm font-semibold text-subtle">Veranstaltung verlassen</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          className="min-h-[44px] items-center justify-center px-4 active:opacity-60"
          onPress={() => void reset()}
        >
          <Text className="text-sm font-semibold text-danger">Gerät zurücksetzen</Text>
        </Pressable>
      </View>
    </Screen>
  );
}
