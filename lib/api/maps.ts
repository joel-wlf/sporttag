import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { bakeMapImage } from '@/lib/maps/bake';
import { supabase } from '@/lib/supabase';
import type { Bounds } from '@/components/map/types';

/** Aktiver, gebackener Offline-Kartenstand (Zeile aus `event_maps`). */
export type EventMap = {
  id: string;
  version: number;
  asset_path: string;
  content_hash: string;
  mime_type: string;
  width_px: number;
  height_px: number;
  projection: string;
  north: number;
  south: number;
  east: number;
  west: number;
  source_label: string | null;
  attribution: string | null;
};

const mapKey = (eventId: string) => ['events', eventId, 'offline-map'] as const;

export function useActiveEventMap(eventId: string | null) {
  return useQuery({
    queryKey: eventId ? mapKey(eventId) : ['events', 'none', 'offline-map'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_event_map', { p_event_id: eventId as string });
      if (error) throw error;
      return (data as EventMap | null) ?? null;
    },
    enabled: Boolean(eventId),
  });
}

/** Backt das Kartenbild im Browser, lädt es hoch und macht es zur aktiven Karte. */
export function useBakeEventMap(eventId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ venue, onProgress }: { venue: Bounds; onProgress?: (done: number, total: number) => void }) => {
      const baked = await bakeMapImage(venue, onProgress);
      const path = `${eventId}/${crypto.randomUUID()}.jpg`;
      const upload = await supabase.storage
        .from('event-maps')
        .upload(path, baked.blob, { contentType: baked.mimeType, upsert: false });
      if (upload.error) throw upload.error;

      const { error } = await supabase.rpc('register_event_map', {
        p_event_id: eventId,
        p_asset_path: path,
        p_content_hash: baked.hash,
        p_mime_type: baked.mimeType,
        p_width_px: baked.widthPx,
        p_height_px: baked.heightPx,
        p_north: baked.bounds.north,
        p_south: baked.bounds.south,
        p_east: baked.bounds.east,
        p_west: baked.bounds.west,
        p_source_label: baked.sourceLabel,
        p_attribution: baked.attribution,
      });
      if (error) {
        await supabase.storage.from('event-maps').remove([path]);
        throw error;
      }
      return baked;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: mapKey(eventId) });
      void queryClient.invalidateQueries({ queryKey: ['events', eventId, 'readiness'] });
      void queryClient.invalidateQueries({ queryKey: ['events'] });
    },
  });
}
