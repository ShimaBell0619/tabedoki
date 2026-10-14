import { useEffect, useMemo, useRef, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import { App } from './App';
import { CloudStore, type Snapshot } from './cloud';
import { defaultTemplates } from './food';
import { claimMigration, localSource, migrationOwner } from './migration';
import { projectUrl, supabase } from './supabase';
import { Icon } from './components/Icon';
import { AccountMenu } from './components/AccountMenu';

function AccountData({ user, onLogout }: { user: User; onLogout: () => void }) {
  const store = useMemo(() => new CloudStore(supabase!, user.id), [user.id]);
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const pending = useRef(false);
  const alive = useRef(true);
  const [error, setError] = useState('');
  const [source] = useState(() => {
    try { return localSource(window.localStorage); }
    catch { return { raw: '', data: null, error: '旧データを取得できません。ブラウザの設定を確認してください。' }; }
  });
  const [owner] = useState(() => {
    try { return migrationOwner(window.localStorage, projectUrl); }
    catch { return 'unreadable'; }
  });
  useEffect(() => {
    alive.current = true;
    store.load().then(value => { if (alive.current) { setSnapshot(value); setLoaded(true); } }).catch(cause => { if (alive.current) setError(cause.message); });
    return () => { alive.current = false; };
  }, [store]);
  async function start(migrate: boolean) {
    if (pending.current) return;
    pending.current = true; setBusy(true); setError('');
    try {
      if (migrate) {
        if (!source?.data) throw new Error('旧データを確認できません。');
        claimMigration(window.localStorage, projectUrl, user.id, source);
      }
      const next = migrate ? source!.data! : { items: [], templates: defaultTemplates(), shopping: [] };
      const saved = await store.save(next);
      const verified = await store.load();
      if (!verified || verified.writeId !== saved.writeId || JSON.stringify(verified.data) !== JSON.stringify(saved.data)) throw new Error('移行結果を確認できません。元データを保持しています。再取得してください。');
      if (alive.current) { setSnapshot(verified); setLoaded(true); }
    } catch (cause) { if (alive.current) setError(cause instanceof Error ? cause.message : '保存できません。'); }
    finally { pending.current = false; if (alive.current) setBusy(false); }
  }
  async function reload() {
    if (pending.current) return;
    pending.current = true; setBusy(true); setError('');
    try { const value = await store.load(); if (alive.current) { setSnapshot(value); setLoaded(true); } }
    catch (cause) { if (alive.current) setError(cause instanceof Error ? cause.message : '再取得できません。'); }
    finally { pending.current = false; if (alive.current) setBusy(false); }
  }
  if (snapshot) return <App store={store} initial={snapshot} email={user.email ?? 'Googleアカウント'} onLogout={onLogout} />;
  const allowed = source?.data && (!owner || owner === user.id);
  return <Shell account={<AccountMenu email={user.email ?? 'Googleアカウント'} busy={busy} refreshDisabled={!loaded && !error} onRefresh={reload} onLogout={onLogout} />}>
    <h1>{loaded ? 'クラウドを使い始める' : 'クラウドを読み込み中…'}</h1>
    {error && <p role="alert">{error}</p>}
    {loaded && source && <>
      {(!owner || owner === user.id) && <>
        {source.error ? <p>{source.error}</p> : <p>旧データ：食品{source.data!.items.length}件・定番{source.data!.templates.length}件・買い物{source.data!.shopping.length}件</p>}
      </>}
      {allowed ? <button className="primary" disabled={busy || Boolean(error)} onClick={() => start(true)}>{user.email} に移行</button> : <p>旧データは移行できません。紐付け済みのアカウントでログインしてください。</p>}
    </>}
    {loaded && <button className={source ? 'secondary' : 'primary'} disabled={busy || Boolean(error)} onClick={() => start(false)}>{source ? '旧データを使わず開始' : '開始する'}</button>}
    {error && <button disabled={busy} onClick={reload}>クラウドを再取得</button>}
    {busy && <p role="status">保存・確認中…</p>}
  </Shell>;
}
function Shell({ children, account }: { children: React.ReactNode; account?: React.ReactNode }) {
  return <div className="page"><header className="topbar"><div className="topbar-inner"><a className="brand" href="/"><span className="brand-mark"><Icon name="cooking-pot" /></span>たべどき</a>{account}</div></header><main className="main auth-panel">{children}</main></div>;
}
export function AuthGate() {
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
  if (loading) return <Shell><p role="status">認証を確認中…</p></Shell>;
  if (!supabase) return <Shell><h1>接続設定が必要です</h1><p>クラウド接続設定を確認してください。</p></Shell>;
  if (user) return <>{error && <p role="alert" className="notice notice-error">{error}</p>}<div inert={busy}><AccountData key={user.id} user={user} onLogout={logout} /></div>{busy && <p role="status">ログアウト中…</p>}</>;
  return <Shell><h1>ログイン</h1><p>食品の期限を記録し、同じGoogleアカウントでスマートフォンとPCから利用できます。</p>
    {error && <p role="alert">{error}</p>}
    <button className="primary" disabled={busy} onClick={login}>{busy ? 'Googleへ移動中…' : 'Googleでログイン'}</button>
    <p className="auth-links"><a href="/privacy.html">プライバシー</a><a href="/terms.html">利用条件</a></p>
  </Shell>;
}
