import { Text, View } from 'react-native';
import { Card } from '@/components/ui/Card';
import { Icon } from '@/components/ui/Icon';
import { useTokens } from '@/components/ui/theme';
import { Header } from './Header';
import { Screen } from './Screen';

export function ModuleScreen({
  eyebrow,
  title,
  description,
  capabilities,
  children,
}: {
  eyebrow: string;
  title: string;
  description?: string;
  capabilities?: string[];
  children?: React.ReactNode;
}) {
  const tokens = useTokens();
  return (
    <Screen>
      <Header description={description} eyebrow={eyebrow} title={title} />
      {capabilities && capabilities.length > 0 ? (
        <Card>
          <View className="gap-3">
            {capabilities.map((capability) => (
              <View className="flex-row items-start gap-3" key={capability}>
                <View className="mt-0.5 h-7 w-7 items-center justify-center rounded-full bg-primary-soft">
                  <Icon name="check" size={15} color={tokens.primary} />
                </View>
                <Text className="flex-1 text-[14px] leading-5 text-ink">{capability}</Text>
              </View>
            ))}
          </View>
        </Card>
      ) : null}
      {children}
    </Screen>
  );
}
