import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useId, useState, type RefObject } from 'react';
import { parseDeadline } from '../../domain/deadline';

type Props = { value: string; onChange: (value: string) => void; inputRef: RefObject<HTMLInputElement | null> };

export function DeadlineInput({ value, onChange, inputRef }: Props) {
  const id = useId();
  const [calendarOpen, setCalendarOpen] = useState(false);
  const iso = parseDeadline(value);
  return <div className="deadline-input [&_.form-help]:my-2">
    <label htmlFor={id}>期限の日付 <span className="required ml-1 text-[11px] font-medium text-expired">必須</span></label>
    <div className="deadline-entry mt-[7px] flex gap-2 [&_input]:w-0 [&_input]:flex-1">
      <Input id={id} ref={inputRef} type="text" inputMode="numeric" required maxLength={10}
        placeholder="YYYYMMDD" autoComplete="off" value={value} aria-describedby={`${id}-help`}
        onChange={event => onChange(event.target.value)} />
      <Button variant="secondary" type="button" className="secondary" aria-expanded={calendarOpen}
        aria-controls={`${id}-calendar`} onClick={() => setCalendarOpen(!calendarOpen)}>カレンダー</Button>
    </div>
    <p id={`${id}-help`} className="form-help mt-[-4px] text-xs leading-[1.7] text-muted">
      {iso ? `${Number(iso.slice(0, 4))}年${Number(iso.slice(5, 7))}月${Number(iso.slice(8))}日` :
        '8桁の数字（例：20271231）またはYYYY-MM-DDを入力してください。'}
    </p>
    <label id={`${id}-calendar`} hidden={!calendarOpen}>カレンダーで期限を選択
      <Input type="date" min="1000-01-01" max="9999-12-31" value={iso ?? ''}
        onChange={event => { if (event.target.value) onChange(event.target.value.replaceAll('-', '')); }} />
    </label>
  </div>;
}
