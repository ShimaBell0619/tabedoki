import { useId, useRef } from 'react';
import { Icon } from '../../components/Icon';

type Props = { email: string; busy: boolean; refreshDisabled?: boolean; onRefresh: () => void; onLogout: () => void };
export function AccountMenu({ email, busy, refreshDisabled = false, onRefresh, onLogout }: Props) {
  const id = useId();
  const menu = useRef<HTMLDivElement>(null);
  function act(action: () => void) {
    menu.current?.hidePopover();
    action();
  }
  return <>
    <button type="button" className="header-action icon-button" aria-label="アカウント" title="アカウント"
      popoverTarget={id} disabled={busy}><Icon name="ellipsis" /></button>
    <div id={id} ref={menu} popover="auto" className="account-menu" aria-label="アカウント操作">
      <p>{email}</p>
      <button type="button" disabled={busy || refreshDisabled} onClick={() => act(onRefresh)}>再取得</button>
      <button type="button" disabled={busy} onClick={() => act(onLogout)}>ログアウト</button>
    </div>
  </>;
}
