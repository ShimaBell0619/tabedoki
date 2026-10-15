import { categories, units, places, kinds, type Food, type FoodStatus, type StoragePlace } from '../../domain/food';
import { deadlineState, deadlineLabel } from '../../domain/deadline';
import type { FoodGroup } from '../../domain/stock';
import type { InventoryView, InventorySort } from './selectInventory';
import { FoodActions } from './FoodActions';
import { StockAdder } from './StockAdder';
import { Icon } from '../../components/Icon';

export type InventoryActions = {
  blocked: boolean;
  onEdit: (item: Food) => void;
  onStatus: (item: Food, status: FoodStatus) => void;
  onRemove: (item: Food) => void;
  onLowStock: (item: Food, lowStock: boolean) => void;
  onAddShopping: (item: Food) => Promise<boolean>;
  onAddStock: (item: Food, deadline: string, quantity: number, place: StoragePlace) => Promise<boolean>;
};

type Props = InventoryActions & {
  group: FoodGroup;
  today: string;
  view: InventoryView;
  sort: InventorySort;
  listed: boolean;
  adding: boolean;
  onToggleAdd: () => void;
  onCloseAdd: () => void;
};

export function FoodGroupCard({ group, today, view, sort, listed, adding, onToggleAdd, onCloseAdd, blocked, onEdit, onStatus, onRemove, onLowStock, onAddShopping, onAddStock }: Props) {
  const main = group.primary;
  const state = main.status === 'active' ? deadlineState(main.deadline, today) : 'later';
  const date = (main.deadline.slice(0, 4) !== today.slice(0, 4) ? main.deadline.slice(0, 4) + '/' : '') +
    Number(main.deadline.slice(5, 7)) + '/' + Number(main.deadline.slice(8));
  const amount = view === 'all' && group.finishedQuantity > 0
    ? (group.activeQuantity > 0 ? '管理中 ' + group.activeQuantity + units[group.unit] + '・' : '') +
      '完了 ' + group.finishedQuantity + units[group.unit]
    : group.quantity + units[group.unit];
  return <li className={'food-row' + (group.activeQuantity === 0 ? ' completed' : '')} key={group.key}>
    <details className="food-details">
      <summary aria-label={group.name + 'の詳細、' + amount + '、' + kinds[group.kind] + ' ' + main.deadline + '、' +
        (main.status === 'active' ? deadlineLabel(main.deadline, today) : main.status === 'used' ? '使い切り済み' : '廃棄済み')}>
        <div className="food-primary">
          <h3>{group.name}</h3>
          <span className="quantity">{amount}</span>
          {group.lowStock && <span className="low-stock">残りわずか</span>}
        </div>
        <div className="food-deadline">
          {group.items.length > 1 && <span className="deadline-prefix">{main.status === 'active' ? '最短期限' : '期限'}</span>}
          <time dateTime={main.deadline} aria-label={kinds[group.kind] + ' ' + main.deadline}>{date}</time>
          <span className={'deadline-chip state-' + state}>
            {main.status === 'active' ? deadlineLabel(main.deadline, today) :
              main.status === 'used' ? '使い切り済み' : '廃棄済み'}
          </span>
        </div>
      </summary>
      <div className="food-expanded">
        <div className="food-meta"><span>{kinds[group.kind]}</span>{sort !== 'category' && <span>{categories[group.category]}</span>}</div>
        {group.items.length > 1 && <h4 className="stock-heading">期限別の在庫</h4>}
        <ul className="stock-lot-list">{group.items.map(item => <li className="stock-lot" key={item.id}>
          <div className="stock-lot-info">
            <time dateTime={item.deadline} aria-label={kinds[item.kind] + ' ' + item.deadline}>
              {item.deadline.replaceAll('-', '/')}
            </time>
            <span>{item.quantity}{units[item.unit]}</span>
            <span>{places[item.place]}</span>
            {item.status !== 'active' && <span className="stock-finished">
              {item.status === 'used' ? '使い切り済み' : '廃棄済み'}
            </span>}
          </div>
          <div className="stock-lot-controls">
            {item.status === 'active' && <label className="stock-lot-low">
              <input type="checkbox" checked={item.lowStock} disabled={blocked}
                onChange={event => onLowStock(item, event.target.checked)}
                aria-label={item.name + 'の残りわずか'} />残りわずか
            </label>}
            <FoodActions item={item} blocked={blocked} onEdit={() => onEdit(item)}
              onFinish={() => onStatus(item, item.status === 'active' ? 'used' : 'active')}
              onDiscard={() => onStatus(item, 'discarded')} onRemove={() => onRemove(item)} />
          </div>
        </li>)}</ul>
        {view !== 'finished' && <div className="stock-group-actions">
          <button type="button" className="secondary" disabled={blocked}
            aria-expanded={adding} onClick={() => onToggleAdd()}>
            <Icon name="plus" />在庫を追加
          </button>
          {group.activeQuantity > 0 && (listed
            ? <span className="stock-shopping-added" role="status">買い物に追加済み</span>
            : <button type="button" className="secondary" disabled={blocked}
                onClick={() => onAddShopping(main)} aria-label={group.name + 'を買い物に追加'}>
                買い物に追加
              </button>)}
        </div>}
        {adding && view !== 'finished' && <StockAdder base={main} blocked={blocked}
          onAdd={onAddStock} onClose={() => onCloseAdd()} />}
      </div>
    </details>
  </li>;
}
