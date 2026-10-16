import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { NativeSelect } from '@/components/ui/native-select';
import { useState } from 'react';
import { categories, places, normalizedName, type Food, type FoodCategory, type StoragePlace } from '../../domain/food';
import { deadlineFilters, matchesDeadline, type DeadlineFilter } from '../../domain/deadline';
import { groupFoods } from '../../domain/stock';
import type { ShoppingItem } from '../../domain/shopping';
import { FoodGroupCard, type InventoryActions } from './FoodGroupCard';
import { DeadlineTimeline } from './DeadlineTimeline';
import { selectInventory } from './selectInventory';
import { Icon } from '../../components/Icon';

type Props = InventoryActions & {
  items: Food[];
  today: string;
  onCreate: () => void;
  shopping: ShoppingItem[];
};

export function InventoryPage({ items, today, blocked, onCreate, onEdit, onStatus, onRemove, shopping, onLowStock, onAddShopping, onAddStock }: Props) {
  const [addingKey, setAddingKey] = useState<string | null>(null);
  const [displayMode, setDisplayMode] = useState<'list' | 'timeline'>('list');
  const [view, setView] = useState<'active' | 'finished' | 'all'>('active');
  const [search, setSearch] = useState('');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState<'all' | FoodCategory>('all');
  const [placeFilter, setPlaceFilter] = useState<'all' | StoragePlace>('all');
  const [deadlineFilter, setDeadlineFilter] = useState<DeadlineFilter>('all');
  const [sort, setSort] = useState<'category' | 'deadline' | 'place'>('category');
  const { active, displayed, foodGroups, sections } = selectInventory(items, today, { view, search, categoryFilter, placeFilter, deadlineFilter, sort });
  const filterCount = Number(categoryFilter !== 'all') + Number(placeFilter !== 'all') + Number(deadlineFilter !== 'all');
  const hasFilters = filterCount > 0 || Boolean(search.trim());
  const listed = new Set(shopping.filter(item => !item.bought).map(item => normalizedName(item.name)));
  function resetFilters() {
    setSearch(''); setCategoryFilter('all'); setPlaceFilter('all'); setDeadlineFilter('all');
  }

  return <>
    <div className="page-heading mb-[22px] flex items-center justify-between gap-4 mobile:mb-[18px]">
      <h1 id="inventory-heading">食品一覧 <span className="total ml-2 align-middle text-sm leading-[1.3] font-medium tracking-normal text-muted mobile:text-[13px]">{foodGroups.length}件</span></h1>
      <Button variant="default" className="primary desktop-create mobile:hidden" disabled={blocked} onClick={onCreate} type="button">
        <Icon name="plus" />食品を登録
      </Button>
    </div>
    <section className="inventory mb-[30px]" aria-labelledby="inventory-heading">
      <div className="list-toolbar mb-4 flex flex-wrap items-center justify-between gap-3 mobile:mb-3.5">
        <div className={`tabs flex gap-0.5 rounded-[10px] border border-[#e0e8e3] bg-panel p-[3px] [&_button]:min-h-11
          [&_button]:rounded-[7px] [&_button]:border-0 [&_button]:bg-transparent [&_button]:px-[18px] [&_button]:py-2
          [&_button]:text-[13px] [&_button]:font-bold [&_button]:text-muted [&_button[aria-pressed=true]]:bg-white
          [&_button[aria-pressed=true]]:text-[#235749] [&_button[aria-pressed=true]]:shadow-[0_1px_3px_#17372b12]
          mobile:[&_button]:px-3 mobile:[&_button]:text-xs tiny:[&_button]:px-2.5`} role="group" aria-label="表示する食品">
          {(['active', 'finished', 'all'] as const).map(value =>
            <Button variant="plain" key={value} type="button" aria-pressed={view === value} onClick={() => setView(value)}>
              {{ active: '管理中', finished: '完了', all: 'すべて' }[value]}
            </Button>)}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex rounded-[10px] border border-border bg-panel p-[3px]" role="group" aria-label="食品一覧の表示切替">
            {(['list', 'timeline'] as const).map(value =>
              <Button variant="plain" key={value} type="button" aria-pressed={displayMode === value}
                onClick={() => setDisplayMode(value)}
                className="min-h-11 rounded-[7px] px-3 text-xs font-bold text-muted aria-pressed:bg-white aria-pressed:text-primary aria-pressed:shadow-sm">
                {value === 'list' ? '一覧' : 'タイムライン'}
              </Button>)}
          </div>
          {displayMode === 'list' && <label className="sort-control"><span className="sr-only">一覧の表示方法</span>
            <NativeSelect className="min-h-11 w-auto rounded-lg border-border p-1.5 text-xs text-muted mobile:p-1.5" value={sort} onChange={event => setSort(event.target.value as typeof sort)}>
              <option value="category">カテゴリ別</option><option value="deadline">期限順</option><option value="place">保存場所別</option>
            </NativeSelect>
          </label>}
        </div>
      </div>
      {view === 'active' && <div className={`deadline-filters mb-3 flex flex-wrap gap-1.5 [&_button]:min-h-11 [&_button]:rounded-lg [&_button]:border
          [&_button]:border-border [&_button]:bg-white [&_button]:px-2.5 [&_button]:py-2 [&_button]:text-xs
          [&_button]:text-muted [&_button[aria-pressed=true]]:border-primary [&_button[aria-pressed=true]]:text-primary
          [&_button[aria-pressed=true]]:shadow-[inset_0_0_0_1px_var(--color-primary)]`} role="group" aria-label="期限の状況">
        {(['all', 'expired', 'fortnight', 'month'] as const).map(filter =>
          <Button variant="plain" key={filter} type="button" aria-pressed={deadlineFilter === filter}
            onClick={() => setDeadlineFilter(deadlineFilter === filter && filter !== 'all' ? 'all' : filter)}>
            {deadlineFilters[filter]} <span>{groupFoods(active.filter(item => matchesDeadline(item.deadline, today, filter))).length}件</span>
          </Button>)}
      </div>}
      <div className="search-toolbar mb-3 flex gap-2.5 mobile:gap-2">
        <label className={`search relative flex min-w-0 flex-1 items-center rounded-[10px] border border-[#cfdad5] bg-white
          focus-within:outline-[3px] focus-within:outline-solid focus-within:outline-focus focus-within:outline-offset-2
          [&_.icon]:pointer-events-none [&_.icon]:absolute [&_.icon]:left-3.5 [&_.icon]:opacity-55`}><span className="sr-only">食品名で検索</span><Icon name="search" />
          <Input className="h-[46px] min-h-0 rounded-[10px] border-0 bg-transparent py-0 pr-3 pl-11 text-[15px] placeholder:text-[#6b7b74] focus-visible:outline-none mobile:pl-11 mobile:pr-3" type="search" placeholder="食品名で検索" value={search} onChange={event => setSearch(event.target.value)} />
        </label>
        <Button variant="secondary" type="button" className="filter-toggle secondary shrink-0 px-3.5 aria-expanded:border-[#7fa998] aria-expanded:bg-[#eaf4ef] mobile:p-2.5 mobile:text-xs mobile:[&_.icon]:size-[17px] tiny:gap-[5px]" aria-expanded={filtersOpen}
          aria-controls="filter-panel" onClick={() => setFiltersOpen(!filtersOpen)}>
          <Icon name="sliders-horizontal" />絞り込み{filterCount > 0 && <span className="filter-count min-w-5 rounded-full bg-primary text-center text-[11px] leading-5 text-white">{filterCount}</span>}
        </Button>
      </div>
      <div className={`filters mb-3 grid grid-cols-3 gap-3 rounded-[10px] border border-border bg-panel p-4 [&_label]:flex
          [&_label]:min-w-0 [&_label]:flex-col [&_label]:gap-1.5 [&_label]:text-xs [&_label]:font-[650]
          [&_label]:text-muted mobile:grid-cols-2 mobile:p-3 mobile:[&>label:last-child]:col-span-full`} id="filter-panel" hidden={!filtersOpen}>
        <label>カテゴリ<NativeSelect className="min-h-11 rounded-lg border-[#cfdad5] px-2.5 py-2 text-sm text-[#334b40] mobile:px-2.5" aria-label="カテゴリで絞り込み" value={categoryFilter}
          onChange={event => setCategoryFilter(event.target.value as typeof categoryFilter)}>
          <option value="all">すべて</option>
          {Object.entries(categories).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </NativeSelect></label>
        <label>保存場所<NativeSelect className="min-h-11 rounded-lg border-[#cfdad5] px-2.5 py-2 text-sm text-[#334b40] mobile:px-2.5" aria-label="保存場所で絞り込み" value={placeFilter}
          onChange={event => setPlaceFilter(event.target.value as typeof placeFilter)}>
          <option value="all">すべて</option>
          {Object.entries(places).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </NativeSelect></label>
        <label>期限<NativeSelect className="min-h-11 rounded-lg border-[#cfdad5] px-2.5 py-2 text-sm text-[#334b40] mobile:px-2.5" aria-label="期限状態で絞り込み" value={deadlineFilter}
          onChange={event => setDeadlineFilter(event.target.value as DeadlineFilter)}>
          {Object.entries(deadlineFilters).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </NativeSelect></label>
      </div>
      {hasFilters && <div className={`active-filters mt-1 mb-3.5 flex flex-wrap items-center gap-[7px] text-xs wrap-anywhere [&>span]:max-w-full
          [&>span]:rounded-md [&>span]:bg-[#e5eee9] [&>span]:px-[9px] [&>span]:py-1 [&>span]:text-[#315b4a]
          [&_button]:min-h-11 [&_button]:border-0 [&_button]:bg-transparent [&_button]:px-2 [&_button]:py-1
          [&_button]:text-[#385f50] [&_button]:underline`} aria-label="適用中の絞り込み">
        {search.trim() && <span>「{search.trim()}」</span>}
        {categoryFilter !== 'all' && <span>{categories[categoryFilter]}</span>}
        {placeFilter !== 'all' && <span>{places[placeFilter]}</span>}
        {deadlineFilter !== 'all' && <span>{deadlineFilters[deadlineFilter]}</span>}
        <Button variant="plain" type="button" onClick={resetFilters}>条件をクリア</Button>
      </div>}
      {foodGroups.length === 0 ? <div className={`empty flex min-h-[220px] flex-col items-center justify-center gap-4 rounded-[13px] border border-border
          bg-white px-4 py-7 text-center [&_h2]:m-0 [&_h2]:text-base [&_h2]:font-[650]`}>
        <div className="empty-icon grid size-[52px] place-items-center rounded-[14px] bg-[#edf4ef] [&_.icon]:size-7 [&_.icon]:opacity-60"><Icon name={hasFilters ? 'search' : 'cooking-pot'} /></div>
        <h2>{hasFilters ? '該当する食品がありません' : view === 'finished' ? '完了した食品はありません' :
          items.length === 0 ? '食品を登録しましょう' : '管理中の食品はありません'}</h2>
        {!hasFilters && view !== 'finished' && <Button variant="secondary" className="secondary" type="button" disabled={blocked} onClick={onCreate}>
          <Icon name="plus" />食品を登録する
        </Button>}
      </div> : displayMode === 'timeline' ? <DeadlineTimeline items={displayed} today={today} listed={listed}
        onShowList={() => { setDisplayMode('list'); setSort('deadline'); }}
        blocked={blocked} onEdit={onEdit} onStatus={onStatus} onRemove={onRemove}
        onLowStock={onLowStock} onAddShopping={onAddShopping} onAddStock={onAddStock} /> :
        sections.filter(section => section.items.length > 0).map(section => <div key={section.name ?? 'deadline'}>
        {section.name && <h2 className="group-heading mt-[18px] mb-2 text-[15px] font-bold" aria-label={section.name}>
          {section.name}<span className="group-count ml-2 text-xs font-medium text-muted" aria-hidden="true">{section.items.length}件</span>
        </h2>}
        <ul className="food-list m-0 flex list-none flex-col gap-2.5 p-0">{section.items.map(group =>
          <FoodGroupCard key={group.key} group={group} today={today} view={view} sort={sort}
            listed={listed.has(normalizedName(group.name))} adding={addingKey === group.key}
            onToggleAdd={() => setAddingKey(addingKey === group.key ? null : group.key)} onCloseAdd={() => setAddingKey(null)}
            blocked={blocked} onEdit={onEdit} onStatus={onStatus} onRemove={onRemove} onLowStock={onLowStock}
            onAddShopping={onAddShopping} onAddStock={onAddStock} />)}</ul>
      </div>)}
    </section>
  </>;
}
