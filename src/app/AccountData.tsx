import { useEffect, useMemo, useRef, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import { App } from './App';
import { CloudStore, type Snapshot } from '../data/cloud';
import { defaultTemplates } from '../domain/templates';
import { claimMigration, localSource, migrationOwner } from '../data/migration';
import { projectUrl, supabase } from '../data/supabase';
import { AccountMenu } from '../features/auth/AccountMenu';

import { AuthShell } from './AuthShell';
export function AccountData({ user, onLogout }: { user: User; onLogout: () => void }) {
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
  return <AuthShell account={<AccountMenu email={user.email ?? 'Googleアカウント'} busy={busy} refreshDisabled={!loaded && !error} onRefresh={reload} onLogout={onLogout} />}>
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
  </AuthShell>;
}
