import { Tabs } from 'expo-router';
import { useTheme } from '@/hooks/useTheme';
import { palette } from '@/components/ui/theme';
export default function AppLayout() { const theme = useTheme(); const color = palette(theme); return <Tabs screenOptions={{ tabBarActiveTintColor: color.accent, sceneStyle: { backgroundColor: color.background } }}><Tabs.Screen name="index" options={{ title: 'Home' }} /><Tabs.Screen name="settings" options={{ title: 'Settings' }} /></Tabs>; }
