import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Icon } from '../../components/Icon';

type Props = {
  email?: string;
  busy: boolean;
  refreshDisabled?: boolean;
  onRefresh?: () => void;
  onLogout?: () => void;
  onLogin?: () => void;
};
export function AccountMenu({ email, busy, refreshDisabled = false, onRefresh, onLogout, onLogin }: Props) {
  return <DropdownMenu modal={false}>
    <DropdownMenuTrigger asChild>
      <Button variant="ghost" size="icon" className="header-action rounded-lg text-muted hover:bg-[#edf3f1] [&_.icon]:size-[18px] [&_.icon]:opacity-70"
        type="button" aria-label="アカウント" title={email ? 'クラウドに保存中' : 'この端末に保存中'} disabled={busy}><Icon name="ellipsis" /></Button>
    </DropdownMenuTrigger>
    <DropdownMenuContent align="end" className="account-menu w-[min(280px,calc(100vw-32px))] p-2" aria-label="アカウント操作">
      <p className="mx-2 mt-1 mb-2 border-b border-border pb-3 text-[13px] text-muted wrap-anywhere">{email ? <>クラウドに保存中<br />{email}</> : 'この端末に保存中'}</p>
      {onRefresh && <DropdownMenuItem disabled={busy || refreshDisabled} onSelect={onRefresh}>再取得</DropdownMenuItem>}
      {onLogin && <DropdownMenuItem disabled={busy} onSelect={onLogin}>Googleでログインしてクラウド保存</DropdownMenuItem>}
      {onLogout && <DropdownMenuItem disabled={busy} onSelect={onLogout}>ログアウト</DropdownMenuItem>}
    </DropdownMenuContent>
  </DropdownMenu>;
}
