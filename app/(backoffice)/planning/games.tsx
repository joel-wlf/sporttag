import { useState } from 'react';
import { View } from 'react-native';
import { RequireEvent } from '@/components/backoffice/RequireEvent';
import { CopyTemplateModal } from '@/components/backoffice/planning/CopyTemplateModal';
import { EventGameFormModal } from '@/components/backoffice/planning/EventGameFormModal';
import { ScoringRuleFormModal } from '@/components/backoffice/planning/ScoringRuleFormModal';
import { Header } from '@/components/layout/Header';
import { Screen } from '@/components/layout/Screen';
import { Section } from '@/components/layout/Section';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { ListRow } from '@/components/ui/ListRow';
import {
  type EventGameRow,
  type ScoringRuleRow,
  useEventGames,
  useScoringRules,
  useSetDefaultScoringRule,
} from '@/lib/api/games';
import { friendlyErrorMessage } from '@/lib/api/errors';
import { useActiveEvent } from '@/providers/ActiveEventProvider';

function GamesContent() {
  const { eventId, event } = useActiveEvent();
  const { data: rules } = useScoringRules(eventId);
  const { data: games } = useEventGames(eventId);
  const setDefault = useSetDefaultScoringRule(eventId as string);
  const [editingRule, setEditingRule] = useState<ScoringRuleRow | 'new' | null>(null);
  const [editingGame, setEditingGame] = useState<EventGameRow | 'new' | null>(null);
  const [copyOpen, setCopyOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const locked = event?.status !== 'draft';

  const modeLabel = (mode: string) => (mode === 'win_draw_loss' ? 'Sieg/Unentschieden/Niederlage' : mode === 'placement' ? 'Platzierung' : 'Zahlwert');

  const handleSetDefault = async (ruleId: string) => {
    setError(null);
    try {
      await setDefault.mutateAsync(ruleId);
    } catch (err) {
      setError(friendlyErrorMessage(err));
    }
  };

  return (
    <Screen>
      <Header
        description="Event-Spiele, Regeln und Tabellenpunkte konfigurieren."
        eyebrow="PLANUNG"
        title="Spiele & Wertung"
      />

      <Section
        action={!locked ? <Button label="Neue Regel" leftIcon="plus" onPress={() => setEditingRule('new')} size="sm" /> : undefined}
        title="Wertungsregeln"
      >
        {!rules || rules.length === 0 ? (
          <Card>
            <EmptyState description="Lege mindestens eine Wertungsregel an." icon="results" title="Keine Regeln" />
          </Card>
        ) : (
          <Card>
            <View className="gap-1">
              {rules.map((rule) => (
                <View className="flex-row items-center gap-2" key={rule.id}>
                  <View className="flex-1">
                    <ListRow
                      icon="results"
                      onPress={() => setEditingRule(rule)}
                      showChevron={!locked}
                      subtitle={modeLabel(rule.mode)}
                      title={rule.name}
                    />
                  </View>
                  {event?.default_scoring_rule_id === rule.id ? (
                    <Badge tone="primary">Standard</Badge>
                  ) : !locked ? (
                    <Button label="Als Standard" onPress={() => handleSetDefault(rule.id)} size="sm" variant="outline" />
                  ) : null}
                </View>
              ))}
            </View>
          </Card>
        )}
        {error ? <Badge tone="danger">{error}</Badge> : null}
      </Section>

      <Section
        action={
          !locked ? (
            <>
              <Button label="Aus Vorlage" onPress={() => setCopyOpen(true)} size="sm" variant="outline" />
              <Button label="Neues Spiel" leftIcon="plus" onPress={() => setEditingGame('new')} size="sm" />
            </>
          ) : undefined
        }
        title="Event-Spiele"
      >
        {!games || games.length === 0 ? (
          <Card>
            <EmptyState description="Lege die Spiele dieser Veranstaltung an." icon="package" title="Keine Spiele" />
          </Card>
        ) : (
          <Card>
            <View className="gap-1">
              {games.map((game) => (
                <ListRow
                  icon="package"
                  key={game.id}
                  onPress={() => setEditingGame(game)}
                  showChevron
                  subtitle={`${game.min_teams}–${game.max_teams} Teams · ${game.measurement_type === 'outcome' ? 'Ausgang' : 'Zahlwert'}`}
                  title={game.name}
                />
              ))}
            </View>
          </Card>
        )}
      </Section>

      {eventId ? (
        <>
          <CopyTemplateModal eventId={eventId} onClose={() => setCopyOpen(false)} visible={copyOpen} />
          <ScoringRuleFormModal
            eventId={eventId}
            key={`rule-${editingRule === 'new' ? 'new' : (editingRule?.id ?? 'closed')}`}
            onClose={() => setEditingRule(null)}
            rule={locked ? null : editingRule}
          />
          <EventGameFormModal
            eventId={eventId}
            game={editingGame}
            key={`game-${editingGame === 'new' ? 'new' : (editingGame?.id ?? 'closed')}`}
            locked={locked}
            onClose={() => setEditingGame(null)}
            scoringRules={rules ?? []}
          />
        </>
      ) : null}
    </Screen>
  );
}

export default function GamesScreen() {
  return (
    <RequireEvent>
      <GamesContent />
    </RequireEvent>
  );
}
