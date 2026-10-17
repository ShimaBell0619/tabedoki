import { cn } from '@/components/ui/utils';
import { Button } from '@/components/ui/button';
import { categories, consumptionAction, units, places, kinds, tracksVolume, volumeLabel, type Food, type FoodStatus, type StoragePlace } from '../../domain/food';
import { deadlineState, deadlineLabel } from '../../domain/deadline';
import type { FoodGroup } from '../../domain/stock';
import type { InventoryView, InventorySort } from './selectInventory';
import { FoodActions } from './FoodActions';
import { StockAdder } from './StockAdder';
import { StockProgress } from './StockProgress';
import { StockPreview } from './StockPreview';
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
  onVolume: (item: Food, delta: -10 | 10) => void;
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
  const finishedCount = group.items.filter(item => item.status !== 'active').length;
  const amount = finishedCount > 0
    ? (group.activeQuantity > 0 ? '管理中 ' + group.activeQuantity + units[group.unit] + '・' : '') + '完了 ' + finishedCount + '件'
    : group.activeQuantity + units[group.unit];
  const partlyUsed = group.items.filter(item =>
    item.status === 'active' && tracksVolume(item) && (item.volumePercent ?? 100) < 100);
  const compactAmount = group.lowStock ? '残りわずか' :
    finishedCount > 0 ? amount :
    group.activeQuantity === 1 && partlyUsed.length === 1 ? '開封中 ' + volumeLabel(partlyUsed[0].volumePercent ?? 100) : amount;
  return <li className={cn('food-row min-w-0 rounded-[13px] border border-border bg-white shadow-[0_2px_8px_rgb(33_43_56/4%)] has-[.food-details[open]]:border-[#A7B9CF] has-[.food-details[open]]:shadow-[0_4px_16px_rgb(33_43_56/7%)]', group.items.length === 1 && 'single-stock', group.activeQuantity === 0 && 'completed')} key={group.key}>
    <details className="food-details overflow-hidden rounded-xl open:[&>summary]:bg-white">
      <summary className="relative flex min-h-[68px] cursor-pointer list-none items-center gap-2 px-3 py-2.5 pr-3.5 focus-visible:outline-offset-[-3px]" aria-label={group.name + 'の詳細、' + compactAmount + '、' + kinds[group.kind] + ' ' + main.deadline + '、' +
        (main.status === 'active' ? deadlineLabel(main.deadline, today) : main.status === 'used' ? '使用完了' : '廃棄済み')}>
        {(state === 'expired' || state === 'today') && main.status === 'active' &&
          <span className={cn('deadline-accent h-9 w-[3px] shrink-0 rounded-full', state === 'expired' ? 'bg-expired' : 'bg-[#B98545]')} aria-hidden="true" />}
        <div className="food-primary flex min-w-0 flex-1 items-center gap-2.5">
          <button type="button" className="food-icon food-icon-button" aria-label={group.name + 'のアイコンを変更'}
            disabled={blocked} onClick={event => { event.preventDefault(); event.stopPropagation(); onPickIcon(group.name, group.category); }}
            onKeyDown={event => event.stopPropagation()}>
            <FoodIcon name={group.name} category={group.category} selected={selectedFoodIcon(iconSelections, group.name)} />
          </button>
          <div className="food-caption flex min-w-0 flex-1 flex-col gap-0.5">
            <h3 className="m-0 line-clamp-2 min-w-0 wrap-anywhere text-base leading-[1.35] font-[750]" title={group.name}>{group.name}</h3>
            <span className={cn('quantity min-w-0 text-xs leading-[1.4] wrap-anywhere', group.lowStock ? 'font-semibold text-[#986125]' : 'text-muted')}>{compactAmount}</span>
          </div>
        </div>
        <span className={cn('deadline-chip inline-flex shrink-0 items-center text-[13px] font-semibold whitespace-nowrap', 'state-' + state, {
          'font-bold text-expired': state === 'expired',
          'font-bold text-today': state === 'today' || state === 'soon',
          'text-muted': state === 'later',
        })}>
          {main.status === 'active' ? deadlineLabel(main.deadline, today) :
            main.status === 'used' ? '使用完了' : '廃棄済み'}
        </span>
        <StockPreview group={group} />
      </summary>
      <div className="food-expanded flex flex-col gap-3 border-t border-border bg-panel p-3.5 mobile:p-3">
        {group.items.length > 1 && <h4 className="stock-heading m-0 text-[13px] font-bold text-[#354F70]">期限別の在庫</h4>}
        <ul className="stock-lot-list m-0 flex list-none flex-col gap-2 p-0">{group.items.map(item => {
          const volume = tracksVolume(item);
          const action = volume ? '10%使った' : consumptionAction(item.consumption, units[item.unit], totalActiveQuantity === 1);
          return <li className="stock-lot flex min-w-0 flex-col gap-3 rounded-[10px] border border-border bg-white p-3 shadow-[0_1px_3px_rgb(36_50_70/3%)]" key={item.id}>
            <div className="stock-lot-info flex min-w-0 items-center gap-1.5">
              <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[13px]">
                <time className="font-bold tabular-nums whitespace-nowrap" dateTime={item.deadline} aria-label={kinds[item.kind] + ' ' + item.deadline}>
                  {item.deadline.replaceAll('-', '/')}
                </time>
                <span className="text-muted">· {places[item.place]}</span>
                {sort !== 'category' && <span className="text-xs text-muted">· {categories[group.category]}</span>}
                {item.status !== 'active' && <span className="stock-finished text-xs text-[#965C4F]">{item.status === 'used' ? '使用完了' : '廃棄済み'}</span>}
              </div>
              <FoodActions item={item} blocked={blocked} onEdit={() => onEdit(item)}
                onConsume={() => onQuantity(item, -1)} onDiscard={() => onStatus(item, 'discarded')} onRemove={() => onRemove(item)} />
            </div>
            {item.status === 'active' ? <>
              <div className="stock-lot-balance flex min-w-0 items-start justify-between gap-2">
                <StockProgress item={item} />
                <label className="stock-lot-low inline-flex min-h-11 shrink-0 cursor-pointer items-center gap-1 text-xs whitespace-nowrap text-muted [&_input]:size-5 [&_input]:accent-primary">
                  <input type="checkbox" checked={item.lowStock} disabled={blocked}
                    onChange={event => onLowStock(item, event.target.checked)}
                    aria-label={item.name + 'の残りわずか'} />残りわずか
                </label>
              </div>
              <div className="stock-lot-controls flex min-w-0 gap-2">
                <Button variant="action" type="button" className="finish-food flex min-h-11 min-w-0 flex-1 items-center justify-center gap-1.5 border-primary bg-primary px-3 text-white hover:bg-[#293F5C] [&_.icon]:size-4 [&_.icon]:brightness-0 [&_.icon]:invert"
                  disabled={blocked} onClick={() => volume ? onVolume(item, -10) : onQuantity(item, -1)}
                  aria-label={`${item.name.trim()}を${action}`}>
                  <Icon name="check" />{action}
                </Button>
                <Button variant="secondary" type="button" className="stock-quantity flex size-11 shrink-0 items-center justify-center px-0"
                  disabled={blocked || (volume ? (item.volumePercent ?? 100) >= 100 : item.quantity >= 999)}
                  onClick={() => volume ? onVolume(item, 10) : onQuantity(item, 1)}
                  aria-label={volume ? item.name.trim() + 'の残量を10%増やす' : item.name.trim() + 'の数量を1増やす'}>
                  <Icon name="plus" />
                </Button>
              </div>
            </> : <div className="flex items-center justify-between gap-3">
              <span className="text-xs text-muted">{item.quantity}{units[item.unit]}</span>
              <Button variant="secondary" type="button" className="secondary min-h-11 text-xs" disabled={blocked}
                onClick={() => onStatus(item, 'active')} aria-label={item.name.trim() + 'を管理中に戻す'}>
                <Icon name="refresh-cw" />管理中に戻す
              </Button>
            </div>}
          </li>;
        })}</ul>
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
