import { Button } from '@/components/ui/button';
import { AccountData } from './AccountData';
import { AuthShell } from './AuthShell';
import { useAuth } from './useAuth';

export function AuthGate() {
  const { user, loading, busy, error, login, logout, configured } = useAuth();
  if (loading) return <AuthShell><p role="status">認証を確認中…</p></AuthShell>;
  if (!configured) return <AuthShell><h1>接続設定が必要です</h1><p>クラウド接続設定を確認してください。</p></AuthShell>;
  if (user) return <>{error && <p role="alert" className="notice notice-error mb-5 flex items-center justify-between gap-3 rounded-[10px] bg-[#fff0ec] py-2.5 pr-3 pl-4 text-[13px] text-[#8e372b] wrap-anywhere">{error}</p>}<div inert={busy}><AccountData key={user.id} user={user} onLogout={logout} /></div>{busy && <p role="status">ログアウト中…</p>}</>;
  return <AuthShell><h1>ログイン</h1><p>食品の期限を記録し、同じGoogleアカウントでスマートフォンとPCから利用できます。</p>
    {error && <p role="alert">{error}</p>}
    <Button variant="default" className="primary" disabled={busy} onClick={login}>{busy ? 'Googleへ移動中…' : 'Googleでログイン'}</Button>
    <p className="auth-links flex gap-4 text-xs text-muted"><a href="/privacy.html">プライバシー</a><a href="/terms.html">利用条件</a></p>
  </AuthShell>;
}
