import { useEffect, useState } from 'react';
import { Button } from '../components/ui/button';
import { cn } from '../components/ui/utils';
import { Icon } from '../components/Icon';

type Props = {
  id: number;
  message: string;
  error: boolean;
  blocked: boolean;
  saving: boolean;
  refreshLabel: string;
  onRefresh: () => void;
  onDismiss: (id: number) => void;
};

export function AppNotice({ id, message, error, blocked, saving, refreshLabel, onRefresh, onDismiss }: Props) {
  const [focused, setFocused] = useState(false);
  useEffect(() => {
    if (error || focused || !window.matchMedia('(max-width: 760px)').matches) return;
    const timer = window.setTimeout(() => onDismiss(id), 10000);
    return () => window.clearTimeout(timer);
  }, [id, error, focused, onDismiss]);

  return <div className={cn('notice mb-5 flex items-center justify-between gap-3 rounded-[10px] bg-panel py-2.5 pr-3 pl-4 text-[13px] text-[#354F70] wrap-anywhere',
    error ? 'notice-error bg-[#fff0ec] text-[#8e372b]' : 'notice-toast')}
    role={error ? 'alert' : 'status'}
    onFocusCapture={() => setFocused(true)}
    onBlurCapture={event => { if (!event.currentTarget.contains(event.relatedTarget)) setFocused(false); }}>
    <span>{message}</span>
    {blocked ? <Button variant="ghost" className="min-h-11 shrink-0 text-inherit" type="button" disabled={saving} onClick={onRefresh}>{refreshLabel}</Button> :
      <Button variant="ghost" size="icon" className="icon-button border-0 bg-transparent text-inherit" type="button" aria-label="通知を閉じる" onClick={() => onDismiss(id)}><Icon name="x" /></Button>}
  </div>;
}
