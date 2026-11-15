import { supabase } from '../data/supabase';

export async function reminderAccessToken(): Promise<string> {
  if (!supabase) throw new Error('Googleログインが必要です。');
  const { data: { session }, error } = await supabase.auth.getSession();
  if (error || !session) throw new Error('Googleログインが必要です。');
  return session.access_token;
}
