import type { ReactNode } from 'react';
import { Modal, View } from 'react-native';
import { Button, type ButtonVariant } from './Button';
import { Card, CardDescription, CardHeader, CardTitle } from './Card';

export function ConfirmDialog({
  visible,
  title,
  description,
  confirmLabel = 'Bestätigen',
  cancelLabel = 'Abbrechen',
  confirmVariant = 'danger',
  isLoading = false,
  isConfirmDisabled = false,
  onConfirm,
  onCancel,
  children,
}: {
  visible: boolean;
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  confirmVariant?: ButtonVariant;
  isLoading?: boolean;
  isConfirmDisabled?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  children?: ReactNode;
}) {
  return (
    <Modal animationType="fade" onRequestClose={onCancel} transparent visible={visible}>
      <View className="flex-1 items-center justify-center bg-black/40 px-6">
        <Card className="w-full max-w-[420px] gap-5">
          <CardHeader>
            <CardTitle>{title}</CardTitle>
            {description ? <CardDescription>{description}</CardDescription> : null}
          </CardHeader>
          {children}
          <View className="flex-row justify-end gap-3">
            <Button label={cancelLabel} onPress={onCancel} variant="outline" />
            <Button
              isDisabled={isConfirmDisabled}
              isLoading={isLoading}
              label={confirmLabel}
              onPress={onConfirm}
              variant={confirmVariant}
            />
          </View>
        </Card>
      </View>
    </Modal>
  );
}
