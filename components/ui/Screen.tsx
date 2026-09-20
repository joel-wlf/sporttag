import { type PropsWithChildren } from 'react';
import { Platform, ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '@/hooks/useTheme';
import { palette } from './theme';

export function Screen({ children }: PropsWithChildren) {
  const theme = useTheme();
  const color = palette(theme);
  return <SafeAreaView style={[styles.safe, { backgroundColor: color.background }]} edges={['left', 'right']}><ScrollView contentContainerStyle={styles.content}>{children}</ScrollView></SafeAreaView>;
}
const styles = StyleSheet.create({ safe: { flex: 1 }, content: { width: '100%', maxWidth: 760, alignSelf: 'center', padding: 24, gap: 20, paddingBottom: Platform.select({ web: 48, default: 24 }) } });
