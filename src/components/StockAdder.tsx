import { useRef, useState, type FormEvent } from 'react';
import { parseDeadline, places, type Food, type StoragePlace } from '../food';
import { DeadlineInput } from './DeadlineInput';

type Props = {
  base: Food;
  blocked: boolean;
  onAdd: (base: Food, deadline: string, quantity: number, place: StoragePlace) => Promise<boolean>;
  onClose: () => void;
};

export function StockAdder({ base, blocked, onAdd, onClose }: Props) {
  const [deadline, setDeadline] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [place, setPlace] = useState<StoragePlace>(base.place);
  const [error, setError] = useState('');
  const saving = useRef(false);
  const input = useRef<HTMLInputElement>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving.current || blocked) return;
    const date = parseDeadline(deadline);
    const count = Number(quantity);
    if (!date) { setError('実在する期限の日付を入力してください。'); input.current?.focus(); return; }
    if (!/^[0-9]+$/.test(quantity) || count < 1 || count > 999) {
      setError('数量は1〜999の整数で入力してください。'); return;
    }
    setError('');
    saving.current = true;
    try {
      if (await onAdd(base, date, count, place)) onClose();
    } finally { saving.current = false; }
  }

  return <form className="stock-add-form" aria-label={base.name + 'の在庫を追加'} onSubmit={submit}>
    <h4>{base.name}の在庫を追加</h4>
    <DeadlineInput value={deadline} onChange={setDeadline} inputRef={input} />
    <div className="stock-add-fields">
      <label>数量
        <input type="number" min="1" max="999" step="1" required value={quantity}
          onChange={event => setQuantity(event.target.value)} />
      </label>
      <label>保存場所
        <select value={place} onChange={event => setPlace(event.target.value as StoragePlace)}>
          {Object.entries(places).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
      </label>
    </div>
    {error && <p className="form-error" role="alert">{error}</p>}
    <div className="stock-add-actions">
      <button type="button" className="secondary" onClick={onClose}>キャンセル</button>
      <button type="submit" className="primary" disabled={blocked}>追加する</button>
    </div>
  </form>;
}
