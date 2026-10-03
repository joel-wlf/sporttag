import { useState } from 'react';
import { Text, View } from 'react-native';
import type { Bounds } from '@/components/map/types';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { friendlyErrorMessage } from '@/lib/api/errors';
import { useActiveEventMap, useBakeEventMap } from '@/lib/api/maps';
import { canBakeMap } from '@/lib/maps/bake';

/**
 * Backt aus dem Gelände-Rechteck das Kartenbild, das Stationsgeräte für den
 * Betrieb ohne Internet laden. Das Backen läuft im Browser (Web-Backoffice).
 */
export function OfflineMapCard({ eventId, bounds }: { eventId: string; bounds: Bounds | null }) {
  const { data: map, isLoading } = useActiveEventMap(eventId);
  const bake = useBakeEventMap(eventId);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const run = () => {
    setError(null);
    setProgress(null);
    bake.mutate(
      { venue: bounds as Bounds, onProgress: (done, total) => setProgress({ done, total }) },
      { onError: (err) => setError(friendlyErrorMessage(err)), onSettled: () => setProgress(null) },
    );
  };

  const disabled = !bounds || !canBakeMap;
  const megapixels = map ? ((map.width_px * map.height_px) / 1_000_000).toFixed(1) : null;

  return (
    <Card>
      <View className="flex-row flex-wrap items-center justify-between gap-3">
        <View className="min-w-0 flex-1 gap-1">
          <Text className="text-base font-extrabold text-ink">Offline-Karte</Text>
          <Text className="text-[13px] leading-5 text-subtle">
            {map
              ? `Version ${map.version} · ${map.width_px} × ${map.height_px} px (${megapixels} MP)`
              : isLoading
                ? 'Wird geladen …'
                : 'Noch kein Kartenbild. Stationsgeräte nutzen ohne Bild die Online-Karte.'}
          </Text>
          {!bounds ? <Text className="text-[13px] text-subtle">Zuerst das Gelände-Rechteck zeichnen.</Text> : null}
          {!canBakeMap ? <Text className="text-[13px] text-subtle">Das Kartenbild wird im Web-Backoffice erstellt.</Text> : null}
        </View>
        <View className="flex-row items-center gap-2">
          {map ? <Badge tone="success">Aktiv</Badge> : null}
          <Button
            isDisabled={disabled}
            isLoading={bake.isPending}
            label={
              bake.isPending && progress
                ? `Kacheln ${progress.done}/${progress.total}`
                : map
                  ? 'Neu erstellen'
                  : 'Kartenbild erstellen'
            }
            leftIcon="map-pin"
            onPress={run}
            size="sm"
            variant={map ? 'outline' : 'primary'}
          />
        </View>
      </View>
      {error ? <Badge tone="danger">{error}</Badge> : null}
    </Card>
  );
}
