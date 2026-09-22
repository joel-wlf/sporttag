import { useRouter } from 'expo-router';
import { Pressable, Text, View } from 'react-native';
import { Screen } from '@/components/layout/Screen';
import { Avatar } from '@/components/ui/Avatar';
import { EmptyState } from '@/components/ui/EmptyState';
import { Icon } from '@/components/ui/Icon';
import { useTokens } from '@/components/ui/theme';
import { haptic } from '@/lib/haptics';
import { dayPlan } from '@/lib/station/package';
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
  const { pkg, selectStaff, leave } = useStationSession();

  const select = (id: string) => {
    haptic('success');
    selectStaff(id);
    router.push('/assignment');
  };

  const leaveEvent = () => {
    haptic('light');
    void leave();
    router.replace('/join');
  };

  const staff = pkg?.event_staff ?? [];

  return (
    <Screen density="compact" size="narrow">
      <Pressable
        accessibilityLabel="Veranstaltung verlassen"
        accessibilityRole="button"
        className="h-10 w-10 items-center justify-center self-start rounded-full border border-line bg-surface active:opacity-70"
        onPress={leaveEvent}
      >
        <Icon color={tokens.text} name="arrow-left" size={17} />
      </Pressable>

      {staff.length === 0 ? (
        <EmptyState
          description="Im Backoffice ist noch niemand in der Betreuungsliste eingetragen."
          icon="user"
          title="Keine Betreuung geplant"
        />
      ) : (
        <View className="flex-1 gap-2">
          {staff.map((person) => {
            const entries = pkg ? dayPlan(pkg, person.id) : [];
            const note = entries
              .filter((e) => e.kind === 'assignment')
              .map((e) => `${e.block.name} · ${e.station.name}`)
              .join(' — ');
            return (
              <Pressable
                accessibilityRole="button"
                className="flex-row items-center gap-3 rounded-card border border-line bg-surface px-4 py-3.5 active:bg-primary-soft"
                key={person.id}
                onPress={() => select(person.id)}
                onPressIn={() => haptic('heavy')}
              >
                <Avatar initials={initialsOf(person.display_name)} size={44} />
                <View className="flex-1 gap-0.5">
                  <Text className="text-base font-bold text-ink">{person.display_name}</Text>
                  <Text className="text-xs text-subtle" numberOfLines={1}>
                    {note || 'Kein Einsatz geplant'}
                  </Text>
                </View>
                <Icon name="chevron-right" color={tokens.subtle} size={18} />
              </Pressable>
            );
          })}
        </View>
      )}

      <Pressable
        accessibilityRole="button"
        className="items-center py-3 active:opacity-60"
        onPress={leaveEvent}
      >
        <Text className="text-sm font-semibold text-subtle">Veranstaltung verlassen</Text>
      </Pressable>
    </Screen>
  );
}
