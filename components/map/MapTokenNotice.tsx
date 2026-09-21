import { ActivityIndicator, Text, View } from 'react-native';
import { Icon } from '@/components/ui/Icon';
import { useTokens } from '@/components/ui/theme';

export function MapTokenNotice({ height, missingToken = true }: { height: number; missingToken?: boolean }) {
  const tokens = useTokens();
  return (
    <View
      className="items-center justify-center gap-2 rounded-[22px] border border-line bg-surface-muted px-6"
      style={{ height }}
    >
      {missingToken ? (
        <>
          <Icon color={tokens.subtle} name="alert" size={22} />
          <Text className="text-center text-[13px] font-bold text-ink">Kein Mapbox-Token konfiguriert</Text>
          <Text className="text-center text-[12px] leading-5 text-subtle">
            Setze EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN in .env, um die Satellitenkarte zu laden.
          </Text>
        </>
      ) : (
        <>
          <ActivityIndicator color={tokens.primary} />
          <Text className="text-center text-[12px] text-subtle">Karte wird geladen…</Text>
        </>
      )}
    </View>
  );
}
