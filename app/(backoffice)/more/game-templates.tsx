import { useState } from 'react';
import { View } from 'react-native';
import { GameTemplateFormModal } from '@/components/backoffice/GameTemplateFormModal';
import { Header } from '@/components/layout/Header';
import { Screen } from '@/components/layout/Screen';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { ListRow } from '@/components/ui/ListRow';
import { type GameTemplateRow, useGameTemplates } from '@/lib/api/templates';

export default function GameTemplatesScreen() {
  const { data: templates } = useGameTemplates();
  const [editing, setEditing] = useState<GameTemplateRow | 'new' | null>(null);

  return (
    <Screen>
      <Header
        actions={<Button label="Neue Vorlage" leftIcon="plus" onPress={() => setEditing('new')} />}
        description="Veranstaltungsübergreifende Spielvorlagen der Organisatoren."
        eyebrow="BIBLIOTHEK"
        title="Spielvorlagen"
      />
      {!templates || templates.length === 0 ? (
        <Card>
          <EmptyState
            action={<Button label="Erste Vorlage anlegen" onPress={() => setEditing('new')} />}
            description="Vorlagen lassen sich später ohne Änderung der Quelle in ein Event kopieren."
            icon="package"
            title="Noch keine Vorlagen"
          />
        </Card>
      ) : (
        <Card>
          <View className="gap-1">
            {templates.map((template) => (
              <ListRow
                icon="package"
                key={template.id}
                onPress={() => setEditing(template)}
                showChevron
                subtitle={`${template.min_teams}–${template.max_teams} Teams`}
                title={template.name}
              />
            ))}
          </View>
        </Card>
      )}
      <GameTemplateFormModal
        key={editing === 'new' ? 'new' : (editing?.id ?? 'closed')}
        onClose={() => setEditing(null)}
        template={editing}
      />
    </Screen>
  );
}
