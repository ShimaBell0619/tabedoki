import { useState, type FormEvent } from 'react';
import { units, type Food, type FoodTemplate } from '../food';
import { replenishmentCandidates, type ShoppingItem } from '../shopping';

type Props = {
  items: ShoppingItem[];
  foods: Food[];
  templates: FoodTemplate[];
  blocked: boolean;
  onAdd: (source: string | Food | FoodTemplate) => boolean;
  onBought: (item: ShoppingItem, bought: boolean) => void;
  onRemove: (item: ShoppingItem) => void;
  onRegister: (item: ShoppingItem) => void;
};

export function ShoppingPage({ items, foods, templates, blocked, onAdd, onBought, onRemove, onRegister }: Props) {
  const [name, setName] = useState('');
  const suggestions = replenishmentCandidates(foods, items);
  function add(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (onAdd(name)) setName('');
  }
  return <section className="shopping-page" aria-labelledby="shopping-heading">
    <div className="page-heading"><h1 id="shopping-heading">買い物リスト <span className="total">{items.filter(item => !item.bought).length}件未購入</span></h1></div>
    <form className="shopping-add" onSubmit={add}>
      <label htmlFor="shopping-name">買うものの名前</label>
      <div><input id="shopping-name" value={name} required maxLength={80} placeholder="例：しょうゆ"
        onChange={event => setName(event.target.value)} /><button className="primary" disabled={blocked} type="submit">追加する</button></div>
    </form>
    <details className="shopping-templates"><summary>定番から追加</summary>
      <div className="candidate-list">{templates.map(item => <button key={item.id} type="button" className="candidate-button"
        disabled={blocked} onClick={() => onAdd(item)} aria-label={`定番の${item.name}を買い物に追加`}>{item.name}</button>)}</div>
      {templates.length === 0 && <p className="form-help">定番食品はありません。</p>}
    </details>
    {items.length === 0 && <p className="shopping-empty">買うものはありません。</p>}
    {[false, true].map(bought => {
      const group = items.filter(item => item.bought === bought);
      if (!group.length) return null;
      return <section key={String(bought)} aria-label={bought ? '購入済み' : '未購入'}>
        <h2>{bought ? '購入済み' : '買うもの'}</h2>
        <ul className="shopping-list">{group.map(item => <li key={item.id}>
          <label className="shopping-check"><input type="checkbox" checked={item.bought} disabled={blocked}
            onChange={event => onBought(item, event.target.checked)} aria-label={`${item.name}を購入済みにする`} />
            <span>{item.name}<small>{item.quantity}{units[item.unit]}</small></span>
          </label>
          <div className="shopping-actions">
            {item.bought && <button className="secondary" type="button" disabled={blocked}
              onClick={() => onRegister(item)} aria-label={`${item.name}を在庫に登録`}>在庫に登録</button>}
            <button className="secondary outline" type="button" disabled={blocked} onClick={() => onRemove(item)}
              aria-label={`買い物の${item.name}を削除`}>削除</button>
          </div>
        </li>)}</ul>
      </section>;
    })}
    {suggestions.length > 0 && <section aria-label="補充候補"><h2>補充候補</h2>
      <ul className="shopping-list">{suggestions.map(food => <li key={food.id}>
        <span className="shopping-candidate-name">{food.name}</span>
        <button className="secondary" type="button" disabled={blocked} onClick={() => onAdd(food)}
          aria-label={`${food.name}を買い物に追加`}>追加する</button>
      </li>)}</ul>
    </section>}
    <p className="form-help">購入済みから「在庫に登録」を選び、今回の期限を入力してください。</p>
  </section>;
}
