import { Icon } from '../components/Icon';

export function AuthShell({ children, account }: { children: React.ReactNode; account?: React.ReactNode }) {
  return <div className="page"><header className="topbar"><div className="topbar-inner"><a className="brand" href="/"><span className="brand-mark"><Icon name="cooking-pot" /></span>たべどき</a>{account}</div></header><main className="main auth-panel">{children}</main></div>;
}
