import { useState } from 'react';
import { categories, places, normalizedName, type Food, type FoodCategory, type StoragePlace } from '../../domain/food';
import { deadlineFilters, matchesDeadline, type DeadlineFilter } from '../../domain/deadline';
import { groupFoods } from '../../domain/stock';
import type { ShoppingItem } from '../../domain/shopping';
import { FoodGroupCard, type InventoryActions } from './FoodGroupCard';
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
  const [view, setView] = useState<'active' | 'finished' | 'all'>('active');
  const [search, setSearch] = useState('');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState<'all' | FoodCategory>('all');
  const [placeFilter, setPlaceFilter] = useState<'all' | StoragePlace>('all');
  const [deadlineFilter, setDeadlineFilter] = useState<DeadlineFilter>('all');
  const [sort, setSort] = useState<'category' | 'deadline' | 'place'>('category');
  const { active, foodGroups, sections } = selectInventory(items, today, { view, search, categoryFilter, placeFilter, deadlineFilter, sort });
  const filterCount = Number(categoryFilter !== 'all') + Number(placeFilter !== 'all') + Number(deadlineFilter !== 'all');
  const hasFilters = filterCount > 0 || Boolean(search.trim());
  const listed = new Set(shopping.filter(item => !item.bought).map(item => normalizedName(item.name)));
  function resetFilters() {
    setSearch(''); setCategoryFilter('all'); setPlaceFilter('all'); setDeadlineFilter('all');
  }

  return <>
    <div className="page-heading">
      <h1 id="inventory-heading">食品一覧 <span className="total">{foodGroups.length}件</span></h1>
      <button className="primary desktop-create" disabled={blocked} onClick={onCreate} type="button">
        <Icon name="plus" />食品を登録
      </button>
    </div>
    <section className="inventory" aria-labelledby="inventory-heading">
      <div className="list-toolbar">
        <div className="tabs" role="group" aria-label="表示する食品">
          {(['active', 'finished', 'all'] as const).map(value =>
            <button key={value} type="button" aria-pressed={view === value} onClick={() => setView(value)}>
              {{ active: '管理中', finished: '完了', all: 'すべて' }[value]}
            </button>)}
        </div>
        <label className="sort-control"><span className="sr-only">一覧の表示方法</span>
          <select value={sort} onChange={event => setSort(event.target.value as typeof sort)}>
            <option value="category">カテゴリ別</option><option value="deadline">期限順</option><option value="place">保存場所別</option>
          </select>
        </label>
      </div>
      {view === 'active' && <div className="deadline-filters" role="group" aria-label="期限の状況">
        {(['all', 'expired', 'fortnight', 'month'] as const).map(filter =>
          <button key={filter} type="button" aria-pressed={deadlineFilter === filter}
            onClick={() => setDeadlineFilter(deadlineFilter === filter && filter !== 'all' ? 'all' : filter)}>
            {deadlineFilters[filter]} <span>{groupFoods(active.filter(item => matchesDeadline(item.deadline, today, filter))).length}件</span>
          </button>)}
      </div>}
      <div className="search-toolbar">
        <label className="search"><span className="sr-only">食品名で検索</span><Icon name="search" />
          <input type="search" placeholder="食品名で検索" value={search} onChange={event => setSearch(event.target.value)} />
        </label>
        <button type="button" className="filter-toggle secondary" aria-expanded={filtersOpen}
          aria-controls="filter-panel" onClick={() => setFiltersOpen(!filtersOpen)}>
          <Icon name="sliders-horizontal" />絞り込み{filterCount > 0 && <span className="filter-count">{filterCount}</span>}
        </button>
      </div>
      <div className="filters" id="filter-panel" hidden={!filtersOpen}>
        <label>カテゴリ<select aria-label="カテゴリで絞り込み" value={categoryFilter}
          onChange={event => setCategoryFilter(event.target.value as typeof categoryFilter)}>
          <option value="all">すべて</option>
          {Object.entries(categories).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select></label>
        <label>保存場所<select aria-label="保存場所で絞り込み" value={placeFilter}
          onChange={event => setPlaceFilter(event.target.value as typeof placeFilter)}>
          <option value="all">すべて</option>
          {Object.entries(places).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select></label>
        <label>期限<select aria-label="期限状態で絞り込み" value={deadlineFilter}
          onChange={event => setDeadlineFilter(event.target.value as DeadlineFilter)}>
          {Object.entries(deadlineFilters).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select></label>
      </div>
      {hasFilters && <div className="active-filters" aria-label="適用中の絞り込み">
        {search.trim() && <span>「{search.trim()}」</span>}
        {categoryFilter !== 'all' && <span>{categories[categoryFilter]}</span>}
        {placeFilter !== 'all' && <span>{places[placeFilter]}</span>}
        {deadlineFilter !== 'all' && <span>{deadlineFilters[deadlineFilter]}</span>}
        <button type="button" onClick={resetFilters}>条件をクリア</button>
      </div>}
      {foodGroups.length === 0 ? <div className="empty">
        <div className="empty-icon"><Icon name={hasFilters ? 'search' : 'cooking-pot'} /></div>
        <h2>{hasFilters ? '該当する食品がありません' : view === 'finished' ? '完了した食品はありません' :
          items.length === 0 ? '食品を登録しましょう' : '管理中の食品はありません'}</h2>
        {!hasFilters && view !== 'finished' && <button className="secondary" type="button" disabled={blocked} onClick={onCreate}>
          <Icon name="plus" />食品を登録する
        </button>}
      </div> : sections.filter(section => section.items.length > 0).map(section => <div key={section.name ?? 'deadline'}>
        {section.name && <h2 className="group-heading" aria-label={section.name}>
          {section.name}<span className="group-count" aria-hidden="true">{section.items.length}件</span>
        </h2>}
        <ul className="food-list">{section.items.map(group =>
          <FoodGroupCard key={group.key} group={group} today={today} view={view} sort={sort}
            listed={listed.has(normalizedName(group.name))} adding={addingKey === group.key}
            onToggleAdd={() => setAddingKey(addingKey === group.key ? null : group.key)} onCloseAdd={() => setAddingKey(null)}
            blocked={blocked} onEdit={onEdit} onStatus={onStatus} onRemove={onRemove} onLowStock={onLowStock}
            onAddShopping={onAddShopping} onAddStock={onAddStock} />)}</ul>
      </div>)}
    </section>
  </>;
}
