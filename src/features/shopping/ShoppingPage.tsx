import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useState, type FormEvent } from 'react';
import { units, type Food, type FoodTemplate } from '../../domain/food';
import { replenishmentCandidates, type ShoppingItem } from '../../domain/shopping';

type Props = {
  items: ShoppingItem[];
  foods: Food[];
  templates: FoodTemplate[];
  blocked: boolean;
  onAdd: (source: string | Food | FoodTemplate) => Promise<boolean>;
  onBought: (item: ShoppingItem, bought: boolean) => void;
  onRemove: (item: ShoppingItem) => void;
  onRegister: (item: ShoppingItem) => void;
};

export function ShoppingPage({ items, foods, templates, blocked, onAdd, onBought, onRemove, onRegister }: Props) {
  const [name, setName] = useState('');
  const suggestions = replenishmentCandidates(foods, items);
  async function add(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (await onAdd(name)) setName('');
  }
  return <section className="shopping-page [&_h2]:mt-[18px] [&_h2]:mb-2 [&_h2]:text-base [&_h2]:font-bold" aria-labelledby="shopping-heading">
    <div className="page-heading mb-[22px] flex items-center justify-between gap-4 mobile:mb-[18px]"><h1 id="shopping-heading">買い物リスト <span className="total ml-2 align-middle text-sm leading-[1.3] font-medium tracking-normal text-muted mobile:text-[13px]">{items.filter(item => !item.bought).length}件未購入</span></h1></div>
    <form className="shopping-add mb-4 [&_label]:mb-2 [&_label]:block [&_label]:text-[13px] [&_label]:font-[650] [&>div]:flex [&>div]:gap-2" onSubmit={add}>
      <label htmlFor="shopping-name">買うものの名前</label>
      <div><Input className="flex-1 border-border" id="shopping-name" value={name} required maxLength={80} placeholder="例：しょうゆ"
        onChange={event => setName(event.target.value)} /><Button variant="default" className="primary" disabled={blocked} type="submit">追加する</Button></div>
    </form>
    <details className="shopping-templates mb-5 [&_summary]:min-h-11 [&_summary]:cursor-pointer [&_summary]:py-2.5 [&_summary]:text-sm [&_summary]:font-[650] [&_.candidate-list]:mt-3"><summary>定番から追加</summary>
      <div className="candidate-list flex flex-wrap gap-[7px]">{templates.map(item => <Button variant="candidate" key={item.id} type="button" className="candidate-button"
        disabled={blocked} onClick={() => onAdd(item)} aria-label={`定番の${item.name}を買い物に追加`}>{item.name}</Button>)}</div>
      {templates.length === 0 && <p className="form-help mt-[-4px] text-xs leading-[1.7] text-muted">定番食品はありません。</p>}
    </details>
    {items.length === 0 && <p className="shopping-empty py-6 text-muted">買うものはありません。</p>}
    {[false, true].map(bought => {
      const group = items.filter(item => item.bought === bought);
      if (!group.length) return null;
      return <section key={String(bought)} aria-label={bought ? '購入済み' : '未購入'}>
        <h2>{bought ? '購入済み' : '買うもの'}</h2>
        <ul className={`shopping-list m-0 list-none rounded-[13px] border border-border bg-white p-0 [&_li]:flex [&_li]:flex-wrap
          [&_li]:items-center [&_li]:gap-3 [&_li]:border-b [&_li]:border-border [&_li]:p-3 [&_li:last-child]:border-b-0`}>{group.map(item => <li key={item.id}>
          <label className={`shopping-check flex min-h-11 min-w-40 flex-1 cursor-pointer items-center gap-2 [&_input]:m-[11px]
          [&_input]:size-[22px] [&_input]:shrink-0 [&_input]:accent-primary [&_span]:min-w-0 [&_span]:font-[650]
          [&_span]:wrap-anywhere [&_small]:block [&_small]:text-xs [&_small]:font-normal [&_small]:text-muted
          [&_input:checked+span]:text-muted`}><input type="checkbox" checked={item.bought} disabled={blocked}
            onChange={event => onBought(item, event.target.checked)} aria-label={`${item.name}の購入状態`} />
            <span>{item.name}<small>{item.quantity}{units[item.unit]}</small></span>
          </label>
          <div className="shopping-actions ml-auto flex flex-wrap gap-2 mobile:[&_.secondary]:px-2.5 mobile:[&_.secondary]:py-2 mobile:[&_.secondary]:text-xs">
            {item.bought && <Button variant="secondary" className="secondary" type="button" disabled={blocked}
              onClick={() => onRegister(item)} aria-label={`${item.name}を在庫に登録`}>在庫に登録</Button>}
            <Button variant="secondary" className="secondary text-muted" type="button" disabled={blocked} onClick={() => onRemove(item)}
              aria-label={`買い物の${item.name}を削除`}>削除</Button>
          </div>
        </li>)}</ul>
      </section>;
    })}
    {suggestions.length > 0 && <section aria-label="補充候補"><h2>補充候補</h2>
      <ul className={`shopping-list m-0 list-none rounded-[13px] border border-border bg-white p-0 [&_li]:flex [&_li]:flex-wrap
          [&_li]:items-center [&_li]:gap-3 [&_li]:border-b [&_li]:border-border [&_li]:p-3 [&_li:last-child]:border-b-0`}>{suggestions.map(food => <li key={food.id}>
        <span className="shopping-candidate-name min-w-0 flex-1 wrap-anywhere">{food.name}</span>
        <Button variant="secondary" className="secondary" type="button" disabled={blocked} onClick={() => onAdd(food)}
          aria-label={`${food.name}を買い物に追加`}>追加する</Button>
      </li>)}</ul>
    </section>}
  </section>;
}
