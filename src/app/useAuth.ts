import { useEffect, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import { supabase } from '../data/supabase';

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(() => new URLSearchParams(window.location.search).has('error') || window.location.hash.includes('error=') ? 'ログインできませんでした。もう一度お試しください。' : '');
  useEffect(() => {
    if (!supabase) { setLoading(false); return; }
    let active = true;
    let events = 0;
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      events++;
      if (active) { setUser(session?.user ?? null); setLoading(false); setBusy(false); }
    });
    supabase.auth.getSession().then(({ data, error }) => {
      if (!active || events > 0) return;
      if (error) setError('認証を確認できません。再ログインしてください。');
      setUser(data.session?.user ?? null); setLoading(false);
    }).catch(() => { if (active) { setLoading(false); setError('認証を確認できません。再読み込みしてください。'); } });
    return () => { active = false; listener.subscription.unsubscribe(); };
  }, []);
  async function login() {
    setBusy(true); setError('');
    try {
      const { error } = await supabase!.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: `${window.location.origin}/`, queryParams: { prompt: 'select_account' } } });
      if (error) throw error;
    } catch { setError('Googleログインを開始できません。接続を確認してください。'); setBusy(false); }
  }
  async function logout() {
    setBusy(true); setError('');
    try {
      const { error } = await supabase!.auth.signOut({ scope: 'local' });
      if (error) throw error;
      setUser(null);
    } catch { setError('ログアウトできません。接続を確認して再試行してください。'); }
    finally { setBusy(false); }
  }

  return { user, loading, busy, error, login, logout, configured: Boolean(supabase) };
}
