import type { Database } from './database.types.ts';
import { createClient } from '@supabase/supabase-js';
const env = (import.meta as ImportMeta & { env: Record<string, string> }).env;
export const projectUrl = env.VITE_SUPABASE_URL;
const key = env.VITE_SUPABASE_PUBLISHABLE_KEY;
export const supabase = projectUrl && key ? createClient<Database>(projectUrl, key, {
  auth: { flowType: 'pkce', persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
  global: { fetch: (input, init) => fetch(input, { ...init, signal: init?.signal ?? AbortSignal.timeout(15000) }) },
}) : null;
