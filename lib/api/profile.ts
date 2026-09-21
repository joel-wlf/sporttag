import { supabase } from '@/lib/supabase';

/**
 * Fallback zum Profil-Trigger auf `auth.users`: stellt sicher, dass für den
 * aktuell angemeldeten, nicht-anonymen Nutzer eine `profiles`-Zeile existiert.
 * Nötig für ältere Sitzungen, deren Konto vor dem Trigger angelegt wurde.
 */
export async function ensureProfile(): Promise<void> {
  const { data: userResult } = await supabase.auth.getUser();
  const user = userResult.user;
  if (!user || user.is_anonymous) return;
  const displayName = user.email?.split('@')[0] || 'Organisator';
  await supabase.from('profiles').upsert({ id: user.id, display_name: displayName }, { onConflict: 'id', ignoreDuplicates: true });
}
