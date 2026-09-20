import { type PropsWithChildren } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { GlassView, isGlassEffectAPIAvailable } from 'expo-glass-effect';
import { useTheme } from '@/hooks/useTheme';
import { palette } from '@/components/ui/theme';

export function PlatformSurface({ children }: PropsWithChildren) {
  const theme = useTheme();
  const color = palette(theme);
  const style = [styles.surface, { backgroundColor: Platform.OS === 'ios' ? 'transparent' : color.surface, borderColor: color.border }];
  if (Platform.OS === 'ios' && isGlassEffectAPIAvailable()) {
    return <GlassView glassEffectStyle="regular" colorScheme={theme} style={style}>{children}</GlassView>;
  }
  return <View style={style}>{children}</View>;
}
const styles = StyleSheet.create({ surface: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 18, padding: 20, gap: 12, shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 12, elevation: 2 } });
