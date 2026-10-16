import { AccountData } from './AccountData';
import { AuthShell } from './AuthShell';
import { LocalData } from './LocalData';
import { useAuth } from './useAuth';

export function AuthGate() {
  const { user, loading, busy, error, login, logout, configured } = useAuth();
  if (loading) return <AuthShell><p role="status">保存先を確認中…</p></AuthShell>;
  if (user) return <>{error && <p role="alert" className="notice notice-error mb-5 flex items-center justify-between gap-3 rounded-[10px] bg-[#fff0ec] py-2.5 pr-3 pl-4 text-[13px] text-[#8e372b] wrap-anywhere">{error}</p>}<div inert={busy}><AccountData key={user.id} user={user} onLogout={logout} /></div>{busy && <p role="status">ログアウト中…</p>}</>;
  return <LocalData onLogin={configured ? login : undefined} loginError={error} authBusy={busy} />;
}
