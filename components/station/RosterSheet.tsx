import { Modal, ScrollView, Text, View } from 'react-native';
import { Button } from '@/components/ui/Button';
import { useDesktop } from '@/components/ui/useDesktop';

export type RosterTeam = { id: string; name: string; players: string[] };

/** Namensliste der Teams eines Matches für die Anwesenheit. Nur Anzeige. */
export function RosterSheet({
  visible,
  teams,
  onClose,
}: {
  visible: boolean;
  teams: RosterTeam[];
  onClose: () => void;
}) {
  const desktop = useDesktop();
  return (
    <Modal
      animationType="slide"
      onRequestClose={onClose}
      presentationStyle={desktop ? undefined : 'pageSheet'}
      visible={visible}
    >
      <View className="flex-1 bg-canvas">
        <View className="flex-row items-center justify-between border-b border-line px-5 py-4">
          <Text className="text-[17px] font-extrabold text-ink">Namen</Text>
          <Button accessibilityLabel="Schließen" leftIcon="close" onPress={onClose} size="sm" variant="ghost" />
        </View>
        <ScrollView contentContainerStyle={{ padding: 20, gap: 16 }}>
          {teams.map((team) => (
            <View className="gap-2 rounded-card border border-line bg-surface p-4" key={team.id}>
              <View className="flex-row items-baseline justify-between">
                <Text className="text-lg font-extrabold text-ink">{team.name}</Text>
                <Text className="text-sm font-bold text-subtle">{team.players.length}</Text>
              </View>
              {team.players.length === 0 ? (
                <Text className="text-sm text-subtle">–</Text>
              ) : (
                team.players.map((name, i) => (
                  <Text
                    className={['py-1.5 text-base text-ink', i > 0 ? 'border-t border-line' : ''].join(' ')}
                    key={`${name}-${i}`}
                  >
                    {name}
                  </Text>
                ))
              )}
            </View>
          ))}
        </ScrollView>
      </View>
    </Modal>
  );
}
