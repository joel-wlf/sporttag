import { Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { Button } from './Button';
import { Icon } from './Icon';
import { useTokens } from './theme';
import { useDesktop } from './useDesktop';

/**
 * Modales Formularblatt für Anlegen/Bearbeiten. Ersetzt eine eigene
 * Editor-Route: einheitliches Verhalten auf iOS, Android und Web.
 * Auf Desktop-Breiten (siehe useDesktop) erscheint es als schmale
 * Seitenschublade statt als vollflächiges Blatt.
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
  const desktop = useDesktop();

  const body = (
    <>
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
    </>
  );

  if (desktop) {
    return (
      <Modal animationType="fade" onRequestClose={onClose} transparent visible={visible}>
        <View className="flex-1 flex-row justify-end">
          <Pressable
            accessibilityLabel="Schließen"
            accessibilityRole="button"
            className="absolute inset-0 bg-black/30"
            onPress={onClose}
          />
          <View className="h-full w-[420px] max-w-full bg-canvas shadow-xl" style={{ elevation: 12 }}>
            {body}
          </View>
        </View>
      </Modal>
    );
  }

  return (
    <Modal animationType="slide" onRequestClose={onClose} presentationStyle="pageSheet" visible={visible}>
      <View className="flex-1 bg-canvas">{body}</View>
    </Modal>
  );
}
