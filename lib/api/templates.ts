import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import type { Tables, TablesInsert, TablesUpdate } from '@/lib/database.types';

export type GameTemplateRow = Tables<'game_templates'>;

const templatesKey = ['game-templates'] as const;

export function useGameTemplates() {
  return useQuery({
    queryKey: templatesKey,
    queryFn: async () => {
      const { data, error } = await supabase.from('game_templates').select('*').order('name');
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useUpsertGameTemplate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (template: { id?: string } & Omit<TablesInsert<'game_templates'>, 'owner_id'>) => {
      const { data: userResult, error: userError } = await supabase.auth.getUser();
      if (userError) throw userError;
      const ownerId = userResult.user?.id;
      if (!ownerId) throw new Error('Nicht angemeldet.');
      if (template.id) {
        const { id, ...patch } = template;
        const { data, error } = await supabase.from('game_templates').update(patch as TablesUpdate<'game_templates'>).eq('id', id).select().single();
        if (error) throw error;
        return data;
      }
      const { data, error } = await supabase.from('game_templates').insert({ ...template, owner_id: ownerId }).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: templatesKey });
    },
  });
}

export function useDeleteGameTemplate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (templateId: string) => {
      const { error } = await supabase.from('game_templates').delete().eq('id', templateId);
      if (error) throw error;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: templatesKey });
    },
  });
}
