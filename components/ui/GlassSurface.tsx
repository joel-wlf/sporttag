import { GlassView, isGlassEffectAPIAvailable } from 'expo-glass-effect';
import { Platform, View, type ViewProps } from 'react-native';
import { useTheme } from '@/hooks/useTheme';

/**
 * Gemeinsame Glasfläche. Auf unterstützten iOS-Versionen wird echtes natives
 * Liquid Glass verwendet, alle anderen Plattformen erhalten die passende
 * undurchsichtige Entsprechung aus dem Designsystem.
 */
export function GlassSurface({
  children,
  className,
  fallbackClassName = 'bg-surface border border-line',
  ...props
}: ViewProps & { className?: string; fallbackClassName?: string }) {
  const theme = useTheme();

  if (Platform.OS === 'ios' && isGlassEffectAPIAvailable()) {
    return (
      <GlassView glassEffectStyle="regular" colorScheme={theme} style={props.style}>
        {children}
      </GlassView>
    );
  }

  return (
    <View className={[fallbackClassName, className ?? ''].join(' ')} {...props}>
      {children}
    </View>
  );
}
