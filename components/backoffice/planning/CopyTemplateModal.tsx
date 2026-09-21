import { useState } from 'react';
import { Text } from 'react-native';
import { Choice } from '@/components/ui/Choice';
import { FormSheet } from '@/components/ui/FormSheet';
import { friendlyErrorMessage } from '@/lib/api/errors';
import { useCopyTemplateIntoEvent } from '@/lib/api/games';
import { useGameTemplates } from '@/lib/api/templates';

export function CopyTemplateModal({ eventId, visible, onClose }: { eventId: string; visible: boolean; onClose: () => void }) {
  const { data: templates } = useGameTemplates();
  const copy = useCopyTemplateIntoEvent(eventId);
  const [error, setError] = useState<string | null>(null);

  const handleCopy = async (templateId: string) => {
    setError(null);
    try {
      await copy.mutateAsync(templateId);
      onClose();
    } catch (err) {
      setError(friendlyErrorMessage(err));
    }
  };

  return (
    <FormSheet error={error} onClose={onClose} title="Aus Vorlage kopieren" visible={visible}>
      {!templates || templates.length === 0 ? (
        <Text className="text-[13px] text-subtle">Noch keine Spielvorlagen in der Bibliothek.</Text>
      ) : (
        templates.map((template) => (
          <Choice
            description={`${template.min_teams}–${template.max_teams} Teams`}
            key={template.id}
            label={template.name}
            onPress={() => handleCopy(template.id)}
            selected={false}
          />
        ))
      )}
    </FormSheet>
  );
}
