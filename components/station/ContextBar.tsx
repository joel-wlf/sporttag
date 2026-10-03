import { Pressable, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Icon } from '@/components/ui/Icon';
import { useTokens } from '@/components/ui/theme';
import { haptic } from '@/lib/haptics';
import { useStationSession } from '@/providers/StationSessionProvider';

/**
 * Sync-Symbol oben rechts auf jedem Stationsscreen. Öffnet den Sync als
 * Sheet; stehen Ergebnisse zur Übertragung aus, zeigt es deren Zahl.
 */
export function SyncButton() {
  const tokens = useTokens();
  const router = useRouter();
  const { syncCounts, syncOutcome } = useStationSession();
  const pending = syncCounts.pending + syncCounts.sending;
  const review = syncCounts.review;
  // Ein ungültiger Gerätezugang (Code widerrufen) blockiert jede Übertragung;
  // das muss sichtbar sein, sonst bleiben Ergebnisse still auf dem Gerät.
  const blocked = syncOutcome === 'unauthorized' || syncCounts.failed > 0;
  const tone = blocked || review > 0 ? 'danger' : pending > 0 ? 'warning' : null;

  return (
    <Pressable
      accessibilityHint="Öffnet den Übertragungsstand"
      accessibilityLabel={
        blocked
          ? syncOutcome === 'unauthorized'
            ? 'Übertragung blockiert, Gerätezugang ungültig'
            : 'Übertragung teilweise abgelehnt, Details öffnen'
          : review > 0
            ? `${review} Ergebnisse brauchen Klärung`
            : pending > 0
              ? `${pending} Ergebnisse warten auf Übertragung`
              : syncOutcome === 'offline'
                ? 'Synchronisierung, offline'
                : 'Synchronisierung, alles übertragen'
      }
      accessibilityRole="button"
      className={[
        'h-11 min-w-11 flex-row items-center justify-center gap-1 rounded-full px-2 active:opacity-70',
        tone === 'danger' ? 'bg-danger-soft' : tone === 'warning' ? 'bg-warning-soft' : '',
      ].join(' ')}
      onPress={() => {
        haptic('light');
        router.push('/sync');
      }}
    >
      <Icon
        // Ausstehend heißt nicht offline: der Zähler zeigt, dass noch etwas
        // hochgeladen wird; das Wolkensymbol erst, wenn wirklich kein Netz da ist.
        name={
          blocked || review > 0
            ? 'alert'
            : pending > 0
              ? 'upload'
              : syncOutcome === 'offline'
                ? 'wifi-off'
                : 'refresh'
        }
        size={18}
        color={
          tone === 'danger' ? tokens.danger : tone === 'warning' ? tokens.warning : tokens.subtle
        }
      />
      {review > 0 || pending > 0 ? (
        <Text
          className={[
            'text-xs font-extrabold',
            tone === 'danger' ? 'text-danger' : 'text-warning',
          ].join(' ')}
        >
          {review > 0 ? review : pending}
        </Text>
      ) : null}
    </Pressable>
  );
}

/**
 * Ersetzt Header im Stationsbereich: eine Zeile statt eines Doku-Header-Blocks.
 * Bewusst ohne description-Prop.
 */
export function ContextBar({
  title,
  subtitle,
  onBack,
  showSync = true,
}: {
  title: string;
  subtitle?: string;
  onBack?: () => void;
  /** In Sheets ohne Sync-Knopf, damit kein zweites Sheet darüber aufgeht. */
  showSync?: boolean;
}) {
  const tokens = useTokens();

  return (
    <View className="w-full max-w-[760px] flex-row items-center gap-3">
      {onBack ? (
        <Pressable
          accessibilityLabel="Zurück"
          accessibilityRole="button"
          className="h-11 w-11 items-center justify-center rounded-full border border-line bg-surface active:opacity-70"
          onPress={() => {
            haptic('light');
            onBack();
          }}
        >
          <Icon name="arrow-left" size={17} color={tokens.text} />
        </Pressable>
      ) : null}
      {/* Titel und Kontext untereinander: nebeneinander verdrängte ein langer
          Stationsname den Untertitel (Spiel, Block) komplett. */}
      <View accessibilityRole="header" className="min-w-0 flex-1">
        <Text className="text-lg font-extrabold leading-6 text-ink" numberOfLines={1}>
          {title}
        </Text>
        {subtitle ? (
          <Text className="text-sm text-subtle" numberOfLines={1}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {showSync ? <SyncButton /> : null}
    </View>
  );
}
