import { useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { Screen } from '@/components/layout/Screen';
import { Icon } from '@/components/ui/Icon';
import { useTokens } from '@/components/ui/theme';
import { haptic } from '@/lib/haptics';

const CODE_LENGTH = 6;

export default function StationJoinScreen() {
  const router = useRouter();
  const tokens = useTokens();
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<TextInput>(null);

  const handleChange = (value: string) => {
    const digits = value.replace(/\D/g, '').slice(0, CODE_LENGTH);
    setCode(digits);
    setError(null);
    if (digits.length === CODE_LENGTH) {
      haptic('success');
      router.push('/who');
    }
  };

  const digits = Array.from({ length: CODE_LENGTH }, (_, index) => code[index] ?? '');

  return (
    <Screen density="compact" size="narrow">
      <View className="flex-1 items-center justify-center gap-8">
        <View className="items-center gap-1">
          <Icon name="flag" color={tokens.primary} size={28} />
          <Text className="mt-2 text-xl font-extrabold text-ink">Veranstaltungscode</Text>
        </View>

        <Pressable
          accessibilityLabel="Sechsstelligen Veranstaltungscode eingeben"
          accessibilityRole="button"
          className="flex-row gap-2"
          onPress={() => inputRef.current?.focus()}
        >
          {digits.map((digit, index) => (
            <View
              className={[
                'h-14 w-11 items-center justify-center rounded-control border-2 bg-surface',
                digit
                  ? 'border-primary'
                  : index === code.length
                    ? 'border-primary/60 border-dashed'
                    : 'border-line',
              ].join(' ')}
              key={index}
            >
              <Text className="text-xl font-extrabold text-ink">{digit}</Text>
            </View>
          ))}
        </Pressable>
        {error ? <Text className="text-sm font-semibold text-danger">{error}</Text> : null}

        <TextInput
          autoFocus
          className="absolute h-px w-px opacity-0"
          keyboardType="number-pad"
          maxLength={CODE_LENGTH}
          onChangeText={handleChange}
          ref={inputRef}
          value={code}
        />
      </View>

      <Pressable
        accessibilityRole="link"
        className="items-center py-3 active:opacity-60"
        onPress={() => router.replace('/login')}
      >
        <Text className="text-sm font-semibold text-subtle">Backoffice</Text>
      </Pressable>
    </Screen>
  );
}
