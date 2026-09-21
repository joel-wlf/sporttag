import { Pressable, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Icon } from '@/components/ui/Icon';
import { useTokens } from '@/components/ui/theme';
import { haptic } from '@/lib/haptics';

/**
 * Ersetzt Header im Stationsbereich: eine Zeile statt eines Doku-Header-Blocks.
 * Bewusst ohne description-Prop.
 */
export function ContextBar({
  title,
  subtitle,
  onBack,
  pendingSync = 0,
}: {
  title: string;
  subtitle?: string;
  onBack?: () => void;
  pendingSync?: number;
}) {
  const tokens = useTokens();
  const router = useRouter();

  return (
    <View className="w-full max-w-[760px] flex-row items-center gap-3">
      {onBack ? (
        <Pressable
          accessibilityLabel="Zurück"
          accessibilityRole="button"
          className="h-10 w-10 items-center justify-center rounded-full border border-line bg-surface active:opacity-70"
          onPress={onBack}
          onPressIn={() => haptic('heavy')}
        >
          <Icon name="arrow-left" size={17} color={tokens.text} />
        </Pressable>
      ) : null}
      <View className="min-w-0 flex-1 flex-row items-baseline gap-2">
        <Text className="text-lg font-extrabold text-ink" numberOfLines={1}>
          {title}
        </Text>
        {subtitle ? (
          <Text className="flex-1 text-sm text-subtle" numberOfLines={1}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      <Pressable
        accessibilityLabel={
          pendingSync > 0 ? `${pendingSync} Ergebnisse warten auf Übertragung` : 'Synchronisierung'
        }
        accessibilityRole="button"
        className="h-10 w-10 items-center justify-center rounded-full active:opacity-70"
        onPress={() => {
          haptic('light');
          router.push('/cockpit/sync');
        }}
      >
        <View className="items-center justify-center">
          <Icon
            name={pendingSync > 0 ? 'wifi-off' : 'refresh'}
            size={18}
            color={pendingSync > 0 ? tokens.warning : tokens.subtle}
          />
          {pendingSync > 0 ? (
            <View className="absolute -right-1 -top-1 h-3.5 w-3.5 items-center justify-center rounded-full bg-warning">
              <Text className="text-[9px] font-black text-on-primary">{pendingSync}</Text>
            </View>
          ) : null}
        </View>
      </Pressable>
    </View>
  );
}
