import { useLocalSearchParams, useRouter } from 'expo-router';
import { Screen } from '@/components/layout/Screen';
import { ContextBar } from '@/components/station/ContextBar';
import { GameRules } from '@/components/station/GameRules';
import { EmptyState } from '@/components/ui/EmptyState';
import { useStationSession } from '@/providers/StationSessionProvider';

/**
 * Regeln als Sheet über dem Match: die Ergebniseingabe bleibt darunter
 * erhalten, statt in den Regel-Tab des Cockpits zu springen.
 */
export default function GameRulesSheet() {
  const router = useRouter();
  const { gameId } = useLocalSearchParams<{ gameId: string }>();
  const { pkg } = useStationSession();
  const game = pkg?.event_games.find((g) => g.id === gameId);

  return (
    <Screen density="compact" size="narrow">
      <ContextBar onBack={() => router.back()} showSync={false} title="Regeln" />
      {game ? (
        <GameRules game={game} />
      ) : (
        <EmptyState
          description="Dieses Spiel ist im Offline-Paket nicht vorhanden."
          icon="package"
          title="Keine Regeln"
        />
      )}
    </Screen>
  );
}
