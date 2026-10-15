import { Button } from '@/components/ui/button';
import { cn } from '@/components/ui/utils';

type Screen = 'inventory' | 'shopping';
type Props = { screen: Screen; onChange: (screen: Screen) => void; className?: string };

export function ScreenNavigation({ screen, onChange, className }: Props) {
  return <nav className={cn('screen-navigation flex gap-1', className)} aria-label="画面選択">
    {(['inventory', 'shopping'] as const).map(value =>
      <Button key={value} variant="plain" type="button" aria-pressed={screen === value} onClick={() => onChange(value)}
        className={`min-h-11 min-w-[54px] rounded-lg border border-transparent bg-transparent px-3 py-2 text-[13px] font-bold
          text-muted aria-pressed:border-primary aria-pressed:bg-panel aria-pressed:text-primary mobile:px-2
          mobile:text-xs`}>
        {value === 'inventory' ? '在庫' : '買い物'}
      </Button>)}
  </nav>;
}
