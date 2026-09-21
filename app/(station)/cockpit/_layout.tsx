import { Tabs } from 'expo-router';
import { NativeTabs } from 'expo-router/unstable-native-tabs';
import { Platform } from 'react-native';
import { Icon, type IconName } from '@/components/ui/Icon';
import { useTokens } from '@/components/ui/theme';

const nativeTabs = [
  { name: 'index', label: 'Matches', sf: 'list.bullet.rectangle', md: 'checklist' },
  { name: 'rules', label: 'Regeln', sf: 'doc.text', md: 'description' },
  { name: 'sync', label: 'Sync', sf: 'arrow.triangle.2.circlepath', md: 'sync' },
  { name: 'help', label: 'Hilfe', sf: 'phone.fill', md: 'call' },
] as const;

const webTabs: { name: string; label: string; icon: IconName }[] = [
  { name: 'index', label: 'Matches', icon: 'results' },
  { name: 'rules', label: 'Regeln', icon: 'package' },
  { name: 'sync', label: 'Sync', icon: 'refresh' },
  { name: 'help', label: 'Hilfe', icon: 'phone' },
];

export default function CockpitLayout() {
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
