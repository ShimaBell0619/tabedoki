import { useState } from 'react';
import {
  categories, units, places, kinds, deadlineState, deadlineLabel, deadlineFilters, matchesDeadline, groupFoods,
  type Food, type FoodGroup, type FoodCategory, type StoragePlace, type FoodStatus, type DeadlineFilter,
  normalizedName,
} from '../food';
import type { ShoppingItem } from '../shopping';
import { FoodActions } from './FoodActions';
import { StockAdder } from './StockAdder';
import { Icon } from './Icon';

type Props = {
  items: Food[];
  today: string;
  blocked: boolean;
  onCreate: () => void;
  onEdit: (item: Food) => void;
  onStatus: (item: Food, status: FoodStatus) => void;
  onRemove: (item: Food) => void;
  shopping: ShoppingItem[];
  onLowStock: (item: Food, lowStock: boolean) => void;
  onAddShopping: (item: Food) => Promise<boolean>;
  onAddStock: (item: Food, deadline: string, quantity: number, place: StoragePlace) => Promise<boolean>;
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
  const matching = items.filter(item =>
    item.name.toLocaleLowerCase('ja').includes(search.trim().toLocaleLowerCase('ja')) &&
    (categoryFilter === 'all' || item.category === categoryFilter) &&
    (placeFilter === 'all' || item.place === placeFilter));
  const active = matching.filter(item => item.status === 'active');
  const displayed = matching.filter(item =>
    (view === 'all' || (view === 'active' ? item.status === 'active' : item.status !== 'active')) &&
    matchesDeadline(item.deadline, today, deadlineFilter)
  ).sort((a, b) => a.deadline.localeCompare(b.deadline) || a.name.localeCompare(b.name, 'ja'));
  const foodGroups = groupFoods(displayed);
  const sections: { name: string | null; items: FoodGroup[] }[] = sort === 'deadline'
    ? [{ name: null, items: foodGroups }]
    : sort === 'category'
      ? (Object.keys(categories) as FoodCategory[]).map(category => ({
        name: categories[category], items: foodGroups.filter(group => group.category === category),
      }))
      : (Object.keys(places) as StoragePlace[]).map(place => ({
        name: places[place], items: foodGroups.filter(group => group.primary.place === place),
      }));
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
        <ul className="food-list">{section.items.map(group => {
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
                    aria-expanded={addingKey === group.key} onClick={() => setAddingKey(addingKey === group.key ? null : group.key)}>
                    <Icon name="plus" />在庫を追加
                  </button>
                  {group.activeQuantity > 0 && (listed.has(normalizedName(group.name))
                    ? <span className="stock-shopping-added" role="status">買い物に追加済み</span>
                    : <button type="button" className="secondary" disabled={blocked}
                        onClick={() => onAddShopping(main)} aria-label={group.name + 'を買い物に追加'}>
                        買い物に追加
                      </button>)}
                </div>}
                {addingKey === group.key && view !== 'finished' && <StockAdder base={main} blocked={blocked}
                  onAdd={onAddStock} onClose={() => setAddingKey(null)} />}
              </div>
            </details>
          </li>;
        })}</ul>
      </div>)}
    </section>
  </>;
}
