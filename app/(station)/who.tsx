import { useRouter } from 'expo-router';
import { Pressable, Text, View } from 'react-native';
import { Screen } from '@/components/layout/Screen';
import { Avatar } from '@/components/ui/Avatar';
import { Icon } from '@/components/ui/Icon';
import { useTokens } from '@/components/ui/theme';
import { haptic } from '@/lib/haptics';
import { useStationSession } from '@/providers/StationSessionProvider';

const staff = [
  { id: 'joel', name: 'Joel', initials: 'J', note: 'Block 1 · Station 1 — Block 2 · Station 3' },
  { id: 'elias', name: 'Elias', initials: 'E', note: 'Block 1 · Station 1' },
  { id: 'mira', name: 'Mira', initials: 'M', note: 'Block 1 · Station 2 — Block 2 · Station 2' },
  { id: 'noah', name: 'Noah', initials: 'N', note: 'Block 1 · Station 3' },
  { id: 'joel-wald', name: 'Joel (Wald)', initials: 'JW', note: 'Block 2 · Station 3, Wald' },
];

export default function StationWhoScreen() {
  const router = useRouter();
  const tokens = useTokens();
  const { setStaffName, leave } = useStationSession();

  const select = (name: string) => {
    haptic('success');
    setStaffName(name);
    router.push('/assignment');
  };

  const leaveEvent = () => {
    haptic('light');
    leave();
    router.replace('/join');
  };

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

      <View className="flex-1 gap-2">
        {staff.map((person) => (
          <Pressable
            accessibilityRole="button"
            className="flex-row items-center gap-3 rounded-card border border-line bg-surface px-4 py-3.5 active:bg-primary-soft"
            key={person.id}
            onPress={() => select(person.name)}
            onPressIn={() => haptic('heavy')}
          >
            <Avatar initials={person.initials} size={44} />
            <View className="flex-1 gap-0.5">
              <Text className="text-base font-bold text-ink">{person.name}</Text>
              <Text className="text-xs text-subtle">{person.note}</Text>
            </View>
            <Icon name="chevron-right" color={tokens.subtle} size={18} />
          </Pressable>
        ))}
      </View>

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
