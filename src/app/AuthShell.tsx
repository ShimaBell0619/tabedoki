import { Brand } from '../components/Brand';

export function AuthShell({ children, account }: { children: React.ReactNode; account?: React.ReactNode }) {
  return <div className="page min-h-dvh"><header className="topbar h-[68px] border-b border-border bg-surface mobile:h-[62px]"><div className="topbar-inner mx-auto flex h-full max-w-[1040px] items-center justify-between gap-4 px-8 mobile:px-[18px]"><Brand />{account}</div></header><main className={`main auth-panel mx-auto flex max-w-[620px] flex-col items-start gap-4 px-8 pt-8 pb-10 mobile:px-4 mobile:pt-6
          mobile:pb-[110px] [&_p]:m-0 [&_p]:wrap-anywhere [&_button]:max-w-full [&_button]:whitespace-normal
          [&_button]:wrap-anywhere`}>{children}</main></div>;
}
