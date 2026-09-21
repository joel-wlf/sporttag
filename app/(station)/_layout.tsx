import { Stack } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTokens } from '@/components/ui/theme';
import { StationSessionProvider } from '@/providers/StationSessionProvider';

export default function StationLayout() {
  const tokens = useTokens();
  return (
    <StationSessionProvider>
      <SafeAreaView
        edges={['top', 'left', 'right']}
        style={{ flex: 1, backgroundColor: tokens.background }}
      >
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: tokens.background },
          }}
        />
      </SafeAreaView>
    </StationSessionProvider>
  );
}
