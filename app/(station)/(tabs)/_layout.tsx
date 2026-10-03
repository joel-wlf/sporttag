import { Tabs } from 'expo-router';
import { NativeTabs } from 'expo-router/unstable-native-tabs';
import { Platform } from 'react-native';
import { Icon, type IconName } from '@/components/ui/Icon';
import { useTokens } from '@/components/ui/theme';

/**
 * Eine Tab-Leiste für den ganzen Stationsbetrieb: Heute, Station, Karte,
 * Hilfe. Früher lag der Tagesplan außerhalb der Cockpit-Tabs, und Hilfe
 * (Notruf) war nur eingecheckt erreichbar. Sync ist kein Ort, sondern ein
 * Zustand: er sitzt als Symbol oben rechts und öffnet ein Sheet.
 */
const nativeTabs = [
  { name: 'assignment', label: 'Heute', sf: 'calendar', md: 'today' },
  { name: 'cockpit', label: 'Station', sf: 'flag.fill', md: 'flag' },
  { name: 'map', label: 'Karte', sf: 'map.fill', md: 'map' },
  { name: 'help', label: 'Hilfe', sf: 'phone.fill', md: 'call' },
] as const;

const webTabs: { name: string; label: string; icon: IconName }[] = [
  { name: 'assignment', label: 'Heute', icon: 'clock' },
  { name: 'cockpit', label: 'Station', icon: 'flag' },
  { name: 'map', label: 'Karte', icon: 'map-pin' },
  { name: 'help', label: 'Hilfe', icon: 'phone' },
];

export default function StationTabsLayout() {
  const tokens = useTokens();

  if (Platform.OS === 'web') {
    return (
      <Tabs
        screenOptions={{
          headerShown: false,
          sceneStyle: { backgroundColor: tokens.background },
          tabBarActiveTintColor: tokens.primary,
          tabBarInactiveTintColor: tokens.subtle,
          tabBarHideOnKeyboard: true,
          tabBarLabelStyle: { fontSize: 10, fontWeight: '700' },
          tabBarStyle: { backgroundColor: tokens.surface, borderTopColor: tokens.border },
        }}
      >
        {webTabs.map((tab) => (
          <Tabs.Screen
            key={tab.name}
            name={tab.name}
            options={{
              title: tab.label,
              tabBarLabel: tab.label,
              tabBarIcon: ({ color, size }) => (
                <Icon name={tab.icon} size={size} color={color as string} />
              ),
            }}
          />
        ))}
      </Tabs>
    );
  }

  return (
    <NativeTabs
      backgroundColor={tokens.surface}
      labelStyle={{ color: tokens.subtle, fontSize: 10, fontWeight: '700' }}
      tintColor={tokens.primary}
    >
      {nativeTabs.map((tab) => (
        <NativeTabs.Trigger key={tab.name} name={tab.name}>
          <NativeTabs.Trigger.Icon md={tab.md} sf={tab.sf} />
          <NativeTabs.Trigger.Label>{tab.label}</NativeTabs.Trigger.Label>
        </NativeTabs.Trigger>
      ))}
    </NativeTabs>
  );
}
