import { useCallback, useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { LocalStore } from '../data/local';
import type { Snapshot } from '../data/cloud';
import { App } from './App';
import { AuthShell } from './AuthShell';

export function LocalData({ onLogin, loginError, authBusy }: {
  onLogin?: () => void;
  loginError: string;
  authBusy: boolean;
}) {
  const store = useMemo(() => new LocalStore(window.localStorage), []);
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [error, setError] = useState('');
  const load = useCallback(async () => {
    try { const result = await store.load(); setSnapshot(result); setError(''); }
    catch (cause) { setError(cause instanceof Error ? cause.message : '端末のデータを読み込めません。'); }
  }, [store]);
  useEffect(() => { void load(); }, [load]);

  if (error) return <AuthShell>
    <h1>保存データを読み込めません</h1>
    <p role="alert">{error}</p>
    <p>既存データは削除していません。ブラウザの保存設定を確認してください。</p>
    <Button type="button" onClick={() => void load()}>再取得</Button>
  </AuthShell>;
  if (!snapshot) return <AuthShell><p role="status">端末のデータを読み込み中…</p></AuthShell>;
  return <App store={store} initial={snapshot} mode="local" onLogin={onLogin} authBusy={authBusy} loginError={loginError} />;
}
