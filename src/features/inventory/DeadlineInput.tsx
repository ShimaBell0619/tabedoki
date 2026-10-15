import { useId, useState, type RefObject } from 'react';
import { parseDeadline } from '../../domain/food';

type Props = { value: string; onChange: (value: string) => void; inputRef: RefObject<HTMLInputElement | null> };

export function DeadlineInput({ value, onChange, inputRef }: Props) {
  const id = useId();
  const [calendarOpen, setCalendarOpen] = useState(false);
  const iso = parseDeadline(value);
  return <div className="deadline-input">
    <label htmlFor={id}>期限の日付 <span className="required">必須</span></label>
    <div className="deadline-entry">
      <input id={id} ref={inputRef} type="text" inputMode="numeric" required maxLength={10}
        placeholder="YYYYMMDD" autoComplete="off" value={value} aria-describedby={`${id}-help`}
        onChange={event => onChange(event.target.value)} />
      <button type="button" className="secondary" aria-expanded={calendarOpen}
        aria-controls={`${id}-calendar`} onClick={() => setCalendarOpen(!calendarOpen)}>カレンダー</button>
    </div>
    <p id={`${id}-help`} className="form-help">
      {iso ? `${Number(iso.slice(0, 4))}年${Number(iso.slice(5, 7))}月${Number(iso.slice(8))}日` :
        '8桁の数字（例：20271231）またはYYYY-MM-DDを入力してください。'}
    </p>
    <label id={`${id}-calendar`} hidden={!calendarOpen}>カレンダーで期限を選択
      <input type="date" min="1000-01-01" max="9999-12-31" value={iso ?? ''}
        onChange={event => { if (event.target.value) onChange(event.target.value.replaceAll('-', '')); }} />
    </label>
  </div>;
}
