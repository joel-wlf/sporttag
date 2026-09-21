import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Button } from '@/components/ui/Button';
import { Input, InputField } from '@/components/ui/Input';
import { useTokens } from '@/components/ui/theme';
import { geocodePlace, getMapboxAccessToken, type GeocodeResult } from './mapStyle';

export function PlaceSearch({ onSelect }: { onSelect: (result: GeocodeResult) => void }) {
  const tokens = useTokens();
  const token = getMapboxAccessToken();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<GeocodeResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!token) return null;

  const search = async () => {
    if (!query.trim()) return;
    setLoading(true);
    setError(null);
    try {
      setResults(await geocodePlace(token, query));
    } catch {
      setError('Suche fehlgeschlagen. Bitte erneut versuchen.');
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View className="gap-2">
      <View className="flex-row gap-2">
        <Input className="h-[42px] flex-1 rounded-[12px] border border-line bg-canvas px-1">
          <InputField
            className="h-full px-3 text-[14px] text-ink outline-none"
            onChangeText={setQuery}
            onSubmitEditing={search}
            placeholder="Ort oder Adresse suchen…"
            placeholderTextColor={tokens.subtle}
            returnKeyType="search"
            value={query}
          />
        </Input>
        <Button isLoading={loading} label="Suchen" onPress={search} size="sm" variant="outline" />
      </View>
      {error ? <Text className="text-[12px] font-semibold text-danger">{error}</Text> : null}
      {results.length > 0 ? (
        <View className="gap-0.5 rounded-2xl border border-line bg-surface p-1">
          {results.map((result) => (
            <Pressable
              className="rounded-xl px-3 py-2 active:bg-surface-muted"
              key={result.id}
              onPress={() => {
                onSelect(result);
                setResults([]);
                setQuery(result.name);
              }}
            >
              <Text className="text-[13px] text-ink" numberOfLines={1}>
                {result.name}
              </Text>
            </Pressable>
          ))}
        </View>
      ) : null}
    </View>
  );
}
