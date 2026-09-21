import { Slot, Tabs } from 'expo-router';
import { NativeTabs } from 'expo-router/unstable-native-tabs';
import { Platform, useWindowDimensions } from 'react-native';
import { BackofficeShell } from '@/components/layout/BackofficeShell';
import { tabItems } from '@/components/layout/navigation';
import { Icon } from '@/components/ui/Icon';
import { useTokens } from '@/components/ui/theme';

/**
 * Native Tab-Leiste für iOS und Android. SF Symbols auf iOS,
 * Material Symbols auf Android.
 */
const nativeTabItems = [
  { name: 'index', label: 'Events', sf: 'calendar', md: 'event' },
  { name: 'planning', label: 'Planung', sf: 'square.grid.2x2', md: 'dashboard' },
  { name: 'live', label: 'Live', sf: 'waveform.path.ecg', md: 'sensors' },
  { name: 'results', label: 'Ergebnis', sf: 'chart.bar', md: 'leaderboard' },
  { name: 'more', label: 'Mehr', sf: 'ellipsis.circle', md: 'more_horiz' },
] as const;

export default function BackofficeLayout() {
  const { width } = useWindowDimensions();
  const tokens = useTokens();
  const wide = width >= 960;

  // Breite Ansichten (Web-Desktop, iPad): gruppierte Sidebar, keine Tab-Leiste.
  if (wide) {
    return (
      <BackofficeShell wide>
        <Slot />
      </BackofficeShell>
    );
  }

  // Web erhält die JS-Tab-Leiste von Expo Router.
  if (Platform.OS === 'web') {
    return (
      <BackofficeShell wide={false}>
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
          {tabItems.map((item) => (
            <Tabs.Screen
              key={item.name}
              name={item.name}
              options={{
                title: item.label,
                tabBarLabel: item.tabLabel,
                tabBarIcon: ({ color, size }) => (
                  <Icon name={item.icon} size={size} color={color as string} />
                ),
              }}
            />
          ))}
        </Tabs>
      </BackofficeShell>
    );
  }

  // iOS und Android: echte native Tab-Leiste.
  return (
    <BackofficeShell wide={false}>
      <NativeTabs
        backgroundColor={tokens.surface}
        labelStyle={{ color: tokens.subtle, fontSize: 10, fontWeight: '700' }}
        tintColor={tokens.primary}
      >
        {nativeTabItems.map((tab) => (
          <NativeTabs.Trigger key={tab.name} name={tab.name}>
            <NativeTabs.Trigger.Icon md={tab.md} sf={tab.sf} />
            <NativeTabs.Trigger.Label>{tab.label}</NativeTabs.Trigger.Label>
          </NativeTabs.Trigger>
        ))}
      </NativeTabs>
    </BackofficeShell>
  );
}
