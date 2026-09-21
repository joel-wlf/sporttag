import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Screen } from '@/components/layout/Screen';
import { Badge } from '@/components/ui/Badge';
import { Icon, type IconName } from '@/components/ui/Icon';
import { useTokens } from '@/components/ui/theme';
import { callEmergency, emergencyNumber, type CallResult, type EmergencyKind } from '@/lib/emergency';
import { haptic, type HapticStyle } from '@/lib/haptics';

type Status = { kind: EmergencyKind; result: CallResult | 'calling' };

const statusText: Record<Status['result'], string> = {
  calling: 'Anruf wird gestartet …',
  started: 'Anruf gestartet',
  unavailable: 'Anruf nicht möglich',
  not_configured: 'Keine Nummer hinterlegt',
};

const statusTone: Record<Status['result'], 'neutral' | 'success' | 'danger' | 'warning'> = {
  calling: 'neutral',
  started: 'success',
  unavailable: 'danger',
  not_configured: 'warning',
};

function BigButton({
  label,
  number,
  icon,
  tone,
  hapticStyle,
  onPress,
}: {
  label: string;
  number?: string;
  icon: IconName;
  tone: 'primary' | 'danger';
  hapticStyle: HapticStyle;
  onPress: () => void;
}) {
  const tokens = useTokens();
  return (
    <Pressable
      accessibilityRole="button"
      className={[
        'flex-1 items-center justify-center gap-2 rounded-sheet active:opacity-90',
        tone === 'danger' ? 'bg-danger' : 'bg-primary',
      ].join(' ')}
      onPress={onPress}
      onPressIn={() => haptic(hapticStyle)}
      style={{ minHeight: 180 }}
    >
      <Icon color={tokens.onPrimary} name={icon} size={48} />
      <Text className="text-xl font-black tracking-[-0.5px] text-on-primary">{label}</Text>
      {number ? <Text className="text-xs font-semibold text-on-primary/75">{number}</Text> : null}
    </Pressable>
  );
}

export default function CockpitHelpScreen() {
  const [status, setStatus] = useState<Status | null>(null);

  const trigger = async (kind: EmergencyKind) => {
    setStatus({ kind, result: 'calling' });
    const result = await callEmergency(kind);
    setStatus({ kind, result });
  };

  return (
    <Screen density="compact">
      <View className="flex-1 justify-center gap-4">
        <BigButton
          hapticStyle="heavy"
          icon="headset"
          label="Assistenz"
          number={emergencyNumber('assistance')}
          onPress={() => void trigger('assistance')}
          tone="primary"
        />
        <BigButton
          hapticStyle="error"
          icon="medical"
          label="Medizinisch"
          number={emergencyNumber('medical')}
          onPress={() => void trigger('medical')}
          tone="danger"
        />
      </View>
      {status ? (
        <View className="items-center pb-2">
          <Badge tone={statusTone[status.result]}>{statusText[status.result]}</Badge>
        </View>
      ) : null}
    </Screen>
  );
}
