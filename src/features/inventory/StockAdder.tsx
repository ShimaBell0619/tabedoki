import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { NativeSelect } from '@/components/ui/native-select';
import { useRef, useState, type FormEvent } from 'react';
import { parseDeadline } from '../../domain/deadline';
import { places, type Food, type StoragePlace } from '../../domain/food';
import { DeadlineInput } from './DeadlineInput';

type Props = {
  base: Food;
  blocked: boolean;
  onAdd: (base: Food, deadline: string, quantity: number, place: StoragePlace) => Promise<boolean>;
  onClose: () => void;
};

export function StockAdder({ base, blocked, onAdd, onClose }: Props) {
  const [deadline, setDeadline] = useState('');
  const [quantity, setQuantity] = useState(String(base.initialQuantity));
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

  return <form className={`stock-add-form [&_input]:min-h-11 [&_input]:rounded-lg [&_input]:px-2.5 [&_input]:py-2 flex flex-col gap-3
          rounded-[10px] border border-border bg-panel p-3.5 [&_h4]:m-0 [&_h4]:text-sm [&_h4]:font-bold [&_label]:flex
          [&_label]:flex-col [&_label]:gap-[5px] [&_label]:text-[13px] [&_label]:font-[650]
          [&_.deadline-input_.form-help]:mt-1.5 [&_.deadline-input_.form-help]:mb-0 tiny:p-2.5`} aria-label={base.name + 'の在庫を追加'} onSubmit={submit}>
    <h4>{base.name}の在庫を追加</h4>
    <DeadlineInput value={deadline} onChange={setDeadline} inputRef={input} />
    <div className="stock-add-fields grid grid-cols-2 gap-2.5">
      <label>数量
        <Input className="min-h-11 rounded-lg px-2.5 py-2 mobile:px-2.5" type="number" min="1" max="999" step="1" required value={quantity}
          onChange={event => setQuantity(event.target.value)} />
      </label>
      <label>保存場所
        <NativeSelect className="min-h-11 rounded-lg px-2.5 py-2 mobile:px-2.5" value={place} onChange={event => setPlace(event.target.value as StoragePlace)}>
          {Object.entries(places).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </NativeSelect>
      </label>
    </div>
    {error && <p className="form-error m-0 rounded-lg bg-expired-surface p-3 text-[13px] text-expired wrap-anywhere" role="alert">{error}</p>}
    <div className="stock-add-actions flex flex-wrap justify-end gap-2 [&_button]:min-h-11">
      <Button variant="secondary" type="button" className="secondary" onClick={onClose}>キャンセル</Button>
      <Button variant="default" type="submit" className="primary" disabled={blocked}>追加する</Button>
    </div>
  </form>;
}
