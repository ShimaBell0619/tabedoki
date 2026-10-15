import { Input } from '@/components/ui/input';
import { useId, type RefObject } from 'react';
import { parseDeadline } from '../../domain/deadline';

type Props = { value: string; onChange: (value: string) => void; inputRef: RefObject<HTMLInputElement | null> };

export function DeadlineInput({ value, onChange, inputRef }: Props) {
  const id = useId();
  const iso = parseDeadline(value);
  return <div className="deadline-input [&_.form-help]:my-2">
    <label htmlFor={id}>期限の日付 <span className="required ml-1 text-[11px] font-medium text-expired">必須</span></label>
    <div className="mt-[7px] flex gap-2">
      <Input id={id} ref={inputRef} type="text" inputMode="numeric" required maxLength={10}
        className="min-w-0 flex-1" placeholder="YYYYMMDD" autoComplete="off" value={value}
        aria-describedby={`${id}-help`} onChange={event => onChange(event.target.value)} />
      <div className="relative flex size-[46px] shrink-0 items-center justify-center rounded-[9px] border border-input bg-white text-[#28574b]
        focus-within:outline-3 focus-within:outline-offset-2 focus-within:outline-focus">
        <svg className="pointer-events-none size-5" viewBox="0 0 24 24" fill="none" stroke="currentColor"
          strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <rect x="3" y="5" width="18" height="16" rx="2" />
          <path d="M16 3v4M8 3v4M3 10h18" />
        </svg>
        <input type="date" aria-label="カレンダーで期限を選択" min="1000-01-01" max="9999-12-31"
          className="absolute inset-0 size-full cursor-pointer opacity-0" value={iso ?? ''}
          onClick={event => event.currentTarget.showPicker?.()}
          onKeyDown={event => {
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault();
              event.currentTarget.showPicker?.();
            }
          }}
          onChange={event => { if (event.target.value) onChange(event.target.value.replaceAll('-', '')); }} />
      </div>
    </div>
    <p id={`${id}-help`} className="form-help mt-[-4px] text-xs leading-[1.7] text-muted">
      {iso ? `${Number(iso.slice(0, 4))}年${Number(iso.slice(5, 7))}月${Number(iso.slice(8))}日` :
        '8桁で入力、またはカレンダーから選択'}
    </p>
  </div>;
}
