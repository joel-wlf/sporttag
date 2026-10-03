import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Screen } from '@/components/layout/Screen';
import { ContextBar } from '@/components/station/ContextBar';
import { Badge } from '@/components/ui/Badge';
import { Icon, type IconName } from '@/components/ui/Icon';
import { useTokens } from '@/components/ui/theme';
import { callNumber, emergencyNumber, type CallResult, type EmergencyKind } from '@/lib/emergency';
import { useStationSession } from '@/providers/StationSessionProvider';
import { haptic, type HapticStyle } from '@/lib/haptics';

type Status = { kind: EmergencyKind; result: CallResult | 'calling' };

const statusText: Record<Status['result'], string> = {
  calling: 'Anruf wird gestartet …',
  // Die App übergibt nur an das Telefon: iOS fragt nach, Android öffnet den
  // Wähler. Ob wirklich angerufen wird, weiß die App nicht.
  started: 'An Telefon übergeben – dort Anruf bestätigen',
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

export default function HelpScreen() {
  const [status, setStatus] = useState<Status | null>(null);
  const { pkg } = useStationSession();
  const assistance = emergencyNumber(pkg?.event, 'assistance');
  const medical = emergencyNumber(pkg?.event, 'medical');

  const trigger = async (kind: EmergencyKind) => {
    setStatus({ kind, result: 'calling' });
    const result = await callNumber(kind === 'assistance' ? assistance : medical);
    setStatus({ kind, result });
  };

  return (
    <Screen density="compact">
      <ContextBar subtitle="Tippen startet sofort den Anruf" title="Hilfe" />
      <View className="flex-1 justify-center gap-4">
        <BigButton
          hapticStyle="heavy"
          icon="headset"
          label="Assistenz"
          number={assistance ?? 'Keine Nummer hinterlegt'}
          onPress={() => void trigger('assistance')}
          tone="primary"
        />
        <BigButton
          hapticStyle="error"
          icon="medical"
          label="Medizinisch"
          number={medical ?? 'Keine Nummer hinterlegt'}
          onPress={() => void trigger('medical')}
          tone="danger"
        />
      </View>
      {status ? (
        <View className="items-center pb-2">
          <Badge tone={statusTone[status.result]}>{statusText[status.result]}</Badge>
        </View>
      ) : null}
      <Text className="pb-2 text-center text-sm font-semibold text-subtle">
        Bei einem echten Notfall zuerst 112 anrufen.
      </Text>
    </Screen>
  );
}
