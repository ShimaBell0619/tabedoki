import { cn } from '@/components/ui/utils';
import { Button } from '@/components/ui/button';
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
  onQuantity: (item: Food, delta: -1 | 1) => void;
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

export function FoodGroupCard({ group, today, view, sort, listed, adding, onToggleAdd, onCloseAdd, blocked, onEdit, onStatus, onRemove, onLowStock, onQuantity, onAddShopping, onAddStock }: Props) {
  const main = group.primary;
  const state = main.status === 'active' ? deadlineState(main.deadline, today) : 'later';
  const date = (main.deadline.slice(0, 4) !== today.slice(0, 4) ? main.deadline.slice(0, 4) + '/' : '') +
    Number(main.deadline.slice(5, 7)) + '/' + Number(main.deadline.slice(8));
  const amount = view === 'all' && group.finishedQuantity > 0
    ? (group.activeQuantity > 0 ? '管理中 ' + group.activeQuantity + units[group.unit] + '・' : '') +
      '完了 ' + group.finishedQuantity + units[group.unit]
    : group.quantity + units[group.unit];
  return <li className={cn('food-row min-w-0 rounded-[13px] border border-border bg-white shadow-[0_2px_8px_rgb(33_43_56/4%)] has-[.food-details[open]]:border-[#A7B9CF] has-[.food-details[open]]:shadow-[0_4px_16px_rgb(33_43_56/7%)]', group.activeQuantity === 0 && 'completed')} key={group.key}>
    <details className="food-details overflow-hidden rounded-xl open:[&>summary]:bg-white">
      <summary className="grid min-h-[68px] cursor-pointer list-none grid-cols-[minmax(0,1fr)_auto_auto] grid-rows-[auto_auto] items-center gap-x-2 gap-y-1 px-4 py-2.5 focus-visible:outline-offset-[-3px] mobile:px-3 mobile:py-2.5" aria-label={group.name + 'の詳細、' + amount + '、' + kinds[group.kind] + ' ' + main.deadline + '、' +
        (main.status === 'active' ? deadlineLabel(main.deadline, today) : main.status === 'used' ? '使い切り済み' : '廃棄済み')}>
        <div className="food-primary col-start-1 row-start-1 min-w-0 [&_h3]:m-0 [&_h3]:text-[17px] [&_h3]:leading-[1.4] [&_h3]:font-[750] [&_h3]:wrap-anywhere mobile:[&_h3]:text-base">
          <h3>{group.name}</h3>
        </div>
        <span className={cn('deadline-chip col-start-2 row-start-1 inline-flex items-center rounded-[5px] text-[13px] font-semibold whitespace-nowrap', 'state-' + state, {
          'bg-expired-surface px-[7px] py-[3px] font-bold text-expired': state === 'expired',
          'bg-today-surface px-[7px] py-[3px] font-bold text-today': state === 'today' || state === 'soon',
          'text-muted': state === 'later',
        })}>
          {main.status === 'active' ? deadlineLabel(main.deadline, today) :
            main.status === 'used' ? '使い切り済み' : '廃棄済み'}
        </span>
        <div className="food-secondary col-span-3 row-start-2 flex min-w-0 flex-wrap items-center gap-x-2.5 gap-y-1 text-[13px] text-muted mobile:text-xs">
          <span className="quantity whitespace-nowrap">{amount}</span>
          <div className="food-deadline flex flex-wrap items-center gap-x-2 [&_time]:tabular-nums">
            {group.items.length > 1 && <span className="deadline-prefix text-xs">{main.status === 'active' ? '最短期限' : '期限'}</span>}
            <time dateTime={main.deadline} aria-label={kinds[group.kind] + ' ' + main.deadline}>{date}</time>
          </div>
          {group.lowStock && <span className="low-stock text-[11px] font-[650] text-primary">残りわずか</span>}
        </div>
      </summary>
      <div className="food-expanded flex flex-col gap-3 border-t border-border bg-panel p-4 mobile:p-3">
        <div className="food-meta flex flex-wrap items-center gap-x-2.5 gap-y-[7px] text-xs text-muted mobile:gap-x-2 mobile:gap-y-1.5"><span>{kinds[group.kind]}</span>{sort !== 'category' && <span>{categories[group.category]}</span>}</div>
        {group.items.length > 1 && <h4 className="stock-heading m-0 text-[13px] font-bold text-[#354F70]">期限別の在庫</h4>}
        <ul className="stock-lot-list m-0 flex list-none flex-col gap-2 p-0">{group.items.map(item => <li className="stock-lot flex min-w-0 flex-col gap-2 rounded-[10px] border border-border bg-white p-3 shadow-[0_1px_3px_rgb(36_50_70/3%)]" key={item.id}>
          <div className={`stock-lot-info flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1.5 text-[13px] [&_time]:font-bold
          [&_time]:whitespace-nowrap [&_time]:tabular-nums [&>span:not(.stock-finished)]:text-muted mobile:mb-1.5`}>
            <time dateTime={item.deadline} aria-label={kinds[item.kind] + ' ' + item.deadline}>
              {item.deadline.replaceAll('-', '/')}
            </time>
            {item.status !== 'active' && <span>{item.quantity}{units[item.unit]}</span>}
            <span>{places[item.place]}</span>
            {item.status !== 'active' && <span className="stock-finished text-[#965C4F]">
              {item.status === 'used' ? '使い切り済み' : '廃棄済み'}
            </span>}
          </div>
          <div className="stock-lot-controls flex flex-wrap items-center justify-between gap-2">
            {item.status === 'active' && <div className="stock-quantity inline-flex min-h-11 items-center gap-2 rounded-lg border border-border bg-panel px-1">
              <Button variant="plain" type="button" className="flex size-11 items-center justify-center rounded-md text-primary hover:bg-white"
                disabled={blocked} onClick={() => onQuantity(item, -1)} aria-label={item.name.trim() + 'の数量を1減らす'}>−</Button>
              <span className="min-w-10 text-center text-[13px] font-bold tabular-nums whitespace-nowrap" aria-live="polite">{item.quantity}{units[item.unit]}</span>
              <Button variant="plain" type="button" className="flex size-11 items-center justify-center rounded-md text-primary hover:bg-white"
                disabled={blocked || item.quantity >= 999} onClick={() => onQuantity(item, 1)} aria-label={item.name.trim() + 'の数量を1増やす'}>＋</Button>
            </div>}
            <div className="flex min-w-0 flex-1 flex-wrap items-center justify-end gap-2">
              {item.status === 'active' && <label className="stock-lot-low inline-flex min-h-11 cursor-pointer items-center gap-[5px] text-xs whitespace-nowrap text-muted [&_input]:size-5 [&_input]:accent-primary">
                <input type="checkbox" checked={item.lowStock} disabled={blocked}
                  onChange={event => onLowStock(item, event.target.checked)}
                  aria-label={item.name + 'の残りわずか'} />残りわずか
              </label>}
              <FoodActions item={item} blocked={blocked} onEdit={() => onEdit(item)}
                onFinish={() => onStatus(item, item.status === 'active' ? 'used' : 'active')}
                onDiscard={() => onStatus(item, 'discarded')} onRemove={() => onRemove(item)} />
            </div>
          </div>
        </li>)}</ul>
        {view !== 'finished' && <div className={`stock-group-actions flex flex-wrap items-center justify-between gap-2 [&_.secondary]:min-h-11
          [&_.secondary]:text-[13px] [&_.icon]:size-4 mobile:[&_.secondary]:px-3 mobile:[&_.secondary]:py-[9px]`}>
          <Button variant="secondary" type="button" className="secondary" disabled={blocked}
            aria-expanded={adding} onClick={() => onToggleAdd()}>
            <Icon name="plus" />在庫を追加
          </Button>
          {group.activeQuantity > 0 && (listed
            ? <span className="stock-shopping-added text-xs font-[650] text-muted wrap-anywhere" role="status">買い物に追加済み</span>
            : <Button variant="secondary" type="button" className="secondary" disabled={blocked}
                onClick={() => onAddShopping(main)} aria-label={group.name + 'を買い物に追加'}>
                買い物に追加
              </Button>)}
        </div>}
        {adding && view !== 'finished' && <StockAdder base={main} blocked={blocked}
          onAdd={onAddStock} onClose={() => onCloseAdd()} />}
      </div>
    </details>
  </li>;
}
