import { useState } from 'react';
import { Text, View } from 'react-native';
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
import { DataTable, DataTableText, EditableCell, RowActionButton, RowActions } from '@/components/ui/DataTable';
import { EmptyState } from '@/components/ui/EmptyState';
import { ListRow } from '@/components/ui/ListRow';
import { useDesktop } from '@/components/ui/useDesktop';
import {
  type EventGameRow,
  type ScoringRuleRow,
  useDeleteEventGame,
  useDeleteScoringRule,
  useEventGames,
  useScoringRules,
  useSetDefaultScoringRule,
  useUpsertEventGame,
  useUpsertScoringRule,
} from '@/lib/api/games';
import { confirmAsync } from '@/lib/confirm';
import { friendlyErrorMessage } from '@/lib/api/errors';
import { useActiveEvent } from '@/providers/ActiveEventProvider';

function GamesContent() {
  const { eventId, event } = useActiveEvent();
  const { data: rules } = useScoringRules(eventId);
  const { data: games } = useEventGames(eventId);
  const setDefault = useSetDefaultScoringRule(eventId as string);
  const upsertRule = useUpsertScoringRule(eventId as string);
  const removeRule = useDeleteScoringRule(eventId as string);
  const upsertGame = useUpsertEventGame(eventId as string);
  const removeGame = useDeleteEventGame(eventId as string);
  const [editingRule, setEditingRule] = useState<ScoringRuleRow | 'new' | null>(null);
  const [editingGame, setEditingGame] = useState<EventGameRow | 'new' | null>(null);
  const [copyOpen, setCopyOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const desktop = useDesktop();

  const modeLabel = (mode: string) => (mode === 'win_draw_loss' ? 'Sieg/Unentschieden/Niederlage' : mode === 'placement' ? 'Platzierung' : 'Zahlwert');

  const handleSetDefault = async (ruleId: string) => {
    setError(null);
    try {
      await setDefault.mutateAsync(ruleId);
    } catch (err) {
      setError(friendlyErrorMessage(err));
    }
  };

  const handleDeleteRule = async (rule: ScoringRuleRow) => {
    if (!(await confirmAsync(`„${rule.name}“ wirklich löschen?`))) return;
    setError(null);
    try {
      await removeRule.mutateAsync(rule.id);
    } catch (err) {
      setError(friendlyErrorMessage(err));
    }
  };

  const handleDeleteGame = async (game: EventGameRow) => {
    if (!(await confirmAsync(`„${game.name}“ wirklich löschen?`))) return;
    setError(null);
    try {
      await removeGame.mutateAsync(game.id);
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
        action={<Button label="Neue Regel" leftIcon="plus" onPress={() => setEditingRule('new')} size="sm" />}
        title="Wertungsregeln"
      >
        {!rules || rules.length === 0 ? (
          <Card>
            <EmptyState description="Lege mindestens eine Wertungsregel an." icon="results" title="Keine Regeln" />
          </Card>
        ) : desktop ? (
          <Card className="overflow-hidden p-0">
            <DataTable
              columns={[
                {
                  key: 'name',
                  header: 'Regel',
                  flex: 2,
                  render: (rule) => (
                    <View>
                      <EditableCell
                        onCommit={(v) =>
                          v.trim() && upsertRule.mutate({ id: rule.id, name: v.trim(), mode: rule.mode, config: rule.config })
                        }
                        value={rule.name}
                      />
                      <Text className="px-1 text-[12px] text-subtle">{modeLabel(rule.mode)}</Text>
                    </View>
                  ),
                },
                {
                  key: 'default',
                  header: '',
                  width: 140,
                  align: 'right',
                  render: (rule) => (
                    <View className="items-end">
                      {event?.default_scoring_rule_id === rule.id ? (
                        <Badge tone="primary">Standard</Badge>
                      ) : (
                        <Button label="Als Standard" onPress={() => handleSetDefault(rule.id)} size="sm" variant="outline" />
                      )}
                    </View>
                  ),
                },
                {
                  key: 'actions',
                  header: '',
                  width: 80,
                  render: (rule) => (
                    <RowActions>
                      <RowActionButton accessibilityLabel="Regel bearbeiten" icon="edit" onPress={() => setEditingRule(rule)} />
                      <RowActionButton
                        accessibilityLabel="Regel löschen"
                        icon="trash"
                        onPress={() => handleDeleteRule(rule)}
                        tone="danger"
                      />
                    </RowActions>
                  ),
                },
              ]}
              data={rules}
              keyExtractor={(rule) => rule.id}
            />
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
                      showChevron
                      subtitle={modeLabel(rule.mode)}
                      title={rule.name}
                    />
                  </View>
                  {event?.default_scoring_rule_id === rule.id ? (
                    <Badge tone="primary">Standard</Badge>
                  ) : (
                    <Button label="Als Standard" onPress={() => handleSetDefault(rule.id)} size="sm" variant="outline" />
                  )}
                </View>
              ))}
            </View>
          </Card>
        )}
        {error ? <Badge tone="danger">{error}</Badge> : null}
      </Section>

      <Section
        action={
          <>
            <Button label="Aus Vorlage" onPress={() => setCopyOpen(true)} size="sm" variant="outline" />
            <Button label="Neues Spiel" leftIcon="plus" onPress={() => setEditingGame('new')} size="sm" />
          </>
        }
        title="Event-Spiele"
      >
        {!games || games.length === 0 ? (
          <Card>
            <EmptyState description="Lege die Spiele dieser Veranstaltung an." icon="package" title="Keine Spiele" />
          </Card>
        ) : desktop ? (
          <Card className="overflow-hidden p-0">
            <DataTable
              columns={[
                {
                  key: 'name',
                  header: 'Spiel',
                  flex: 2,
                  render: (g) => (
                    <EditableCell
                      onCommit={(v) =>
                        v.trim() &&
                        upsertGame.mutate({
                          id: g.id,
                          name: v.trim(),
                          measurement_type: g.measurement_type,
                          comparison_direction: g.comparison_direction,
                        })
                      }
                      value={g.name}
                    />
                  ),
                },
                {
                  key: 'teams',
                  header: 'Teams',
                  width: 110,
                  render: (g) => <DataTableText subtle>{`${g.min_teams}–${g.max_teams}`}</DataTableText>,
                },
                {
                  key: 'measurement',
                  header: 'Wertung',
                  width: 120,
                  render: (g) => <DataTableText subtle>{g.measurement_type === 'outcome' ? 'Ausgang' : 'Zahlwert'}</DataTableText>,
                },
                {
                  key: 'actions',
                  header: '',
                  width: 80,
                  render: (g) => (
                    <RowActions>
                      <RowActionButton accessibilityLabel="Spiel bearbeiten" icon="edit" onPress={() => setEditingGame(g)} />
                      <RowActionButton
                        accessibilityLabel="Spiel löschen"
                        icon="trash"
                        onPress={() => handleDeleteGame(g)}
                        tone="danger"
                      />
                    </RowActions>
                  ),
                },
              ]}
              data={games}
              keyExtractor={(g) => g.id}
            />
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
            rule={editingRule}
          />
          <EventGameFormModal
            eventId={eventId}
            game={editingGame}
            key={`game-${editingGame === 'new' ? 'new' : (editingGame?.id ?? 'closed')}`}
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
