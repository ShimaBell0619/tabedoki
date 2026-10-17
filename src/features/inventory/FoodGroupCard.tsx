import { cn } from '@/components/ui/utils';
import { Button } from '@/components/ui/button';
import { categories, units, places, kinds, type VolumePercent, type Food, type FoodStatus, type StoragePlace } from '../../domain/food';
import { deadlineState, deadlineLabel } from '../../domain/deadline';
import type { FoodGroup } from '../../domain/stock';
import type { InventoryView, InventorySort } from './selectInventory';
import { FoodActions } from './FoodActions';
import { StockAdder } from './StockAdder';
import { StockProgress } from './StockProgress';
import { StockPreview } from './StockPreview';
import { VolumeControls } from './VolumeControls';
import { Icon } from '../../components/Icon';
import { FoodIcon } from './FoodIcon';
import { selectedFoodIcon, type FoodIconSelections } from '../../domain/food-icons';

export type InventoryActions = {
  iconSelections: FoodIconSelections | undefined;
  onPickIcon: (name: string, category: Food['category']) => void;
  blocked: boolean;
  onEdit: (item: Food) => void;
  onStatus: (item: Food, status: FoodStatus) => void;
  onRemove: (item: Food) => void;
  onLowStock: (item: Food, lowStock: boolean) => void;
  onQuantity: (item: Food, delta: -1 | 1) => void;
  onVolume: (item: Food, percent: VolumePercent | null) => void;
  onAddShopping: (item: Food) => Promise<boolean>;
  onAddStock: (item: Food, deadline: string, quantity: number, place: StoragePlace) => Promise<boolean>;
};

type Props = InventoryActions & {
  group: FoodGroup;
  totalActiveQuantity: number;
  today: string;
  view: InventoryView;
  sort: InventorySort;
  listed: boolean;
  adding: boolean;
  onToggleAdd: () => void;
  onCloseAdd: () => void;
};

export function FoodGroupCard({ group, totalActiveQuantity, today, view, sort, listed, adding, onToggleAdd, onCloseAdd, blocked, onEdit, onStatus, onRemove, onLowStock, onQuantity, onVolume, onAddShopping, onAddStock, iconSelections, onPickIcon }: Props) {
  const main = group.primary;
  const state = main.status === 'active' ? deadlineState(main.deadline, today) : 'later';
  const date = (main.deadline.slice(0, 4) !== today.slice(0, 4) ? main.deadline.slice(0, 4) + '/' : '') +
    Number(main.deadline.slice(5, 7)) + '/' + Number(main.deadline.slice(8));
  const finishedCount = group.items.filter(item => item.status !== 'active').length;
  const amount = finishedCount > 0
    ? (group.activeQuantity > 0 ? '管理中 ' + group.activeQuantity + units[group.unit] + '・' : '') + '完了 ' + finishedCount + '件'
    : group.activeQuantity + units[group.unit];
  return <li className={cn('food-row min-w-0 rounded-[13px] border border-border bg-white shadow-[0_2px_8px_rgb(33_43_56/4%)] has-[.food-details[open]]:border-[#A7B9CF] has-[.food-details[open]]:shadow-[0_4px_16px_rgb(33_43_56/7%)]', group.activeQuantity === 0 && 'completed', group.lowStock && 'border-[#DEB181] bg-[#FFFCF7]')} key={group.key}>
    <details className="food-details overflow-hidden rounded-xl open:[&>summary]:bg-white">
      <summary className="grid min-h-[68px] cursor-pointer list-none grid-cols-[minmax(0,1fr)_auto_auto] grid-rows-[auto_auto_auto] items-center gap-x-2 gap-y-1 px-4 py-2.5 focus-visible:outline-offset-[-3px] mobile:px-3 mobile:py-2.5" aria-label={group.name + 'の詳細、' + amount + '、' + kinds[group.kind] + ' ' + main.deadline + '、' +
        (main.status === 'active' ? deadlineLabel(main.deadline, today) : main.status === 'used' ? '使用完了' : '廃棄済み')}>
        <div className="food-primary col-start-1 row-start-1 flex min-w-0 items-center gap-3 [&_h3]:m-0 [&_h3]:text-[17px] [&_h3]:leading-[1.4] [&_h3]:font-[750] [&_h3]:wrap-anywhere mobile:[&_h3]:text-base">
          <button type="button" className="food-icon food-icon-button" aria-label={group.name + 'のアイコンを変更'}
            disabled={blocked} onClick={event => { event.preventDefault(); event.stopPropagation(); onPickIcon(group.name, group.category); }}
            onKeyDown={event => event.stopPropagation()}>
            <FoodIcon name={group.name} category={group.category} selected={selectedFoodIcon(iconSelections, group.name)} />
          </button>
          <h3 className="min-w-0">{group.name}</h3>
        </div>
        <span className={cn('deadline-chip col-start-2 row-start-1 inline-flex items-center rounded-[5px] text-[13px] font-semibold whitespace-nowrap', 'state-' + state, {
          'bg-expired-surface px-[7px] py-[3px] font-bold text-expired': state === 'expired',
          'bg-today-surface px-[7px] py-[3px] font-bold text-today': state === 'today' || state === 'soon',
          'text-muted': state === 'later',
        })}>
          {main.status === 'active' ? deadlineLabel(main.deadline, today) :
            main.status === 'used' ? '使用完了' : '廃棄済み'}
        </span>
        <div className="food-secondary col-span-3 row-start-2 flex min-w-0 flex-wrap items-center gap-x-2.5 gap-y-1 text-[13px] text-muted mobile:text-xs">
          <span className="quantity whitespace-nowrap">{amount}</span>
          <div className="food-deadline flex flex-wrap items-center gap-x-2 [&_time]:tabular-nums">
            {group.items.length > 1 && <span className="deadline-prefix text-xs">{main.status === 'active' ? '最短期限' : '期限'}</span>}
            <time dateTime={main.deadline} aria-label={kinds[group.kind] + ' ' + main.deadline}>{date}</time>
          </div>
          {group.lowStock && <span className="low-stock rounded-md border border-[#DCA66A] bg-[#FAE9D4] px-2 py-1 text-[11px] font-bold text-[#945119]">残りわずか</span>}
        </div>
        <StockPreview group={group} />
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
              {item.status === 'used' ? '使用完了' : '廃棄済み'}
            </span>}
          </div>
          <StockProgress item={item} />
          <VolumeControls item={item} blocked={blocked} onChange={onVolume} />
          <div className="stock-lot-controls flex flex-wrap items-center justify-between gap-2">
            {item.status === 'active' && <div className="stock-quantity inline-flex min-h-11 items-center gap-2 rounded-lg border border-border bg-panel px-1">
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
              <FoodActions item={item} blocked={blocked} onEdit={() => onEdit(item)} lastInGroup={totalActiveQuantity === 1}
                onConsume={() => onQuantity(item, -1)} onRestore={() => onStatus(item, 'active')}
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
