import { Icon, type IconName } from '../components/Icon';
import { cn } from '@/components/ui/utils';
export type Screen = 'inventory' | 'calendar' | 'shopping' | 'settings';
type Props = { screen: Screen; onChange: (screen: Screen) => void; className?: string };
const screens: { value: Screen; label: string; icon: IconName }[] = [
  { value: 'inventory', label: '一覧', icon: 'layout-list' },
  { value: 'calendar', label: 'カレンダー', icon: 'calendar-days' },
  { value: 'shopping', label: '買い物', icon: 'shopping-basket' },
  { value: 'settings', label: '設定', icon: 'settings' },
];
export function ScreenNavigation({ screen, onChange, className }: Props) {
  return <nav className={cn('screen-navigation', className)} aria-label="画面選択">
    {screens.map(({ value, label, icon }) => <button key={value} type="button"
      className="screen-navigation-item" aria-current={screen === value ? 'page' : undefined}
      onClick={() => onChange(value)}><Icon name={icon} /><span>{label}</span></button>)}
  </nav>;
}