import { Modal, ScrollView, Text, View } from 'react-native';
import { Button } from './Button';
import { Icon } from './Icon';
import { useTokens } from './theme';

/**
 * Modales Formularblatt für Anlegen/Bearbeiten. Ersetzt eine eigene
 * Editor-Route: einheitliches Verhalten auf iOS, Android und Web.
 */
export function FormSheet({
  visible,
  title,
  onClose,
  onSubmit,
  submitLabel = 'Speichern',
  isSubmitting = false,
  error,
  secondaryAction,
  children,
}: {
  visible: boolean;
  title: string;
  onClose: () => void;
  onSubmit?: () => void;
  submitLabel?: string;
  isSubmitting?: boolean;
  error?: string | null;
  secondaryAction?: React.ReactNode;
  children: React.ReactNode;
}) {
  const tokens = useTokens();
  return (
    <Modal animationType="slide" onRequestClose={onClose} presentationStyle="pageSheet" visible={visible}>
      <View className="flex-1 bg-canvas">
        <View className="flex-row items-center justify-between border-b border-line px-5 py-4">
          <Text className="text-[17px] font-extrabold text-ink">{title}</Text>
          <Button leftIcon="close" onPress={onClose} size="sm" variant="ghost" />
        </View>
        <ScrollView className="flex-1" contentContainerStyle={{ padding: 20, gap: 16 }} keyboardShouldPersistTaps="handled">
          {children}
          {error ? (
            <View className="flex-row items-center gap-2 rounded-2xl bg-danger-soft px-4 py-3">
              <Icon color={tokens.danger} name="alert" size={16} />
              <Text className="flex-1 text-[13px] font-semibold text-danger">{error}</Text>
            </View>
          ) : null}
        </ScrollView>
        <View className="flex-row items-center justify-between gap-3 border-t border-line px-5 py-4">
          <View>{secondaryAction}</View>
          <View className="flex-row gap-3">
            <Button label="Abbrechen" onPress={onClose} variant="outline" />
            {onSubmit ? <Button isLoading={isSubmitting} label={submitLabel} onPress={onSubmit} /> : null}
          </View>
        </View>
      </View>
    </Modal>
  );
}
