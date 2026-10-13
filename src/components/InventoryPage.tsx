import { useState, type ReactNode } from 'react';
import { categories, units, places, kinds, deadlineState, deadlineLabel, type Food, type FoodCategory, type StoragePlace, type FoodStatus, type DeadlineState } from '../food';
import { FoodActions } from './FoodActions';
import { Icon } from './Icon';

type View = 'active' | 'finished' | 'all';
type DeadlineFilter = 'all' | DeadlineState;
type Props = {
  items: Food[];
  today: string;
  blocked: boolean;
  children: ReactNode;
  onCreate: () => void;
  onEdit: (item: Food) => void;
  onStatus: (item: Food, status: FoodStatus) => void;
  onRemove: (item: Food) => void;
};

export function InventoryPage({ items, today, blocked, children, onCreate, onEdit, onStatus, onRemove }: Props) {
  const [view, setView] = useState<View>('active');
  const [search, setSearch] = useState('');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState<'all' | FoodCategory>('all');
  const [placeFilter, setPlaceFilter] = useState<'all' | StoragePlace>('all');
  const [deadlineFilter, setDeadlineFilter] = useState<DeadlineFilter>('all');
  const active = items.filter(item => item.status === 'active');
  const counts = {
    expired: active.filter(item => deadlineState(item.deadline, today) === 'expired').length,
    today: active.filter(item => deadlineState(item.deadline, today) === 'today').length,
    soon: active.filter(item => deadlineState(item.deadline, today) === 'soon').length,
  };
  const displayed = items.filter(item => {
    if (view === 'active' && item.status !== 'active') return false;
    if (view === 'finished' && item.status === 'active') return false;
    if (search && !item.name.toLocaleLowerCase('ja').includes(search.trim().toLocaleLowerCase('ja'))) return false;
    if (categoryFilter !== 'all' && item.category !== categoryFilter) return false;
    if (placeFilter !== 'all' && item.place !== placeFilter) return false;
    if (deadlineFilter !== 'all' && deadlineState(item.deadline, today) !== deadlineFilter) return false;
    return true;
  }).sort((a, b) => a.deadline.localeCompare(b.deadline) || a.name.localeCompare(b.name, 'ja'));

  const filterCount = Number(categoryFilter !== 'all') + Number(placeFilter !== 'all') + Number(deadlineFilter !== 'all');
  const hasFilters = filterCount > 0 || Boolean(search.trim());
  const deadlineNames = { expired: '期限切れ', today: '今日まで', soon: '3日以内', later: '4日以上' };
  function resetFilters() {
    setSearch(''); setCategoryFilter('all'); setPlaceFilter('all'); setDeadlineFilter('all');
  }

  return <>
      <div className="page-heading">
          <h1 id="inventory-heading">食品一覧 <span className="total">{displayed.length}件</span>
          </h1>
        <button className="primary desktop-create" disabled={blocked} onClick={() => onCreate()} type="button">
          <Icon name="plus" />食品を登録</button>
      </div>
      <section className="summary" aria-label="期限の状況">
        {(['expired', 'today', 'soon'] as const).map(state => <button key={state} type="button" className={`summary-tile state-${state}`} aria-pressed={view === 'active' && deadlineFilter === state} onClick={() => { setView('active'); setDeadlineFilter(view === 'active' && deadlineFilter === state ? 'all' : state); }}>
          <span className="summary-title">{deadlineNames[state]}</span>
          <strong>{counts[state]}<small>件</small>
          </strong>
        </button>)}
      </section>
      {children}
      <section className="inventory" aria-labelledby="inventory-heading">
        <div className="list-toolbar">
          <div className="tabs" role="group" aria-label="表示する食品">
            <button type="button" aria-pressed={view === 'active'} onClick={() => setView('active')}>管理中</button>
            <button type="button" aria-pressed={view === 'finished'} onClick={() => setView('finished')}>完了</button>
            <button type="button" aria-pressed={view === 'all'} onClick={() => setView('all')}>すべて</button>
          </div>
          <span className="sort-label">期限が近い順</span>
        </div>
        <div className="search-toolbar">
          <label className="search">
          <span className="sr-only">食品名で検索</span>
          <Icon name="search" />
          <input type="search" placeholder="食品名で検索" value={search} onChange={event => setSearch(event.target.value)}/>
          </label>
          <button type="button" className="filter-toggle secondary" aria-expanded={filtersOpen} aria-controls="filter-panel" onClick={() => setFiltersOpen(!filtersOpen)}>
          <Icon name="sliders-horizontal" />絞り込み{filterCount > 0 && <span className="filter-count">{filterCount}</span>}</button>
        </div>
        <div className="filters" id="filter-panel" hidden={!filtersOpen}>
          <label>
          <span>カテゴリ</span>
          <select aria-label="カテゴリで絞り込み" value={categoryFilter} onChange={event => setCategoryFilter(event.target.value as typeof categoryFilter)}>
          <option value="all">すべて</option>{Object.entries(categories).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
          </label>
          <label>
          <span>保存場所</span>
          <select aria-label="保存場所で絞り込み" value={placeFilter} onChange={event => setPlaceFilter(event.target.value as typeof placeFilter)}>
          <option value="all">すべて</option>{Object.entries(places).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
          </label>
          <label>
          <span>期限</span>
          <select aria-label="期限状態で絞り込み" value={deadlineFilter} onChange={event => setDeadlineFilter(event.target.value as DeadlineFilter)}>
          <option value="all">すべて</option>{Object.entries(deadlineNames).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
          </label>
        </div>
        {hasFilters && <div className="active-filters" aria-label="適用中の絞り込み">
          {search.trim() && <span>「{search.trim()}」</span>}{categoryFilter !== 'all' && <span>{categories[categoryFilter]}</span>}{placeFilter !== 'all' && <span>{places[placeFilter]}</span>}{deadlineFilter !== 'all' && <span>{deadlineNames[deadlineFilter]}</span>}
          <button type="button" onClick={resetFilters}>条件をクリア</button>
        </div>}
        {displayed.length === 0 ? <div className="empty">
          <div className="empty-icon">
          <Icon name={hasFilters ? 'search' : 'cooking-pot'} />
          </div>
          <h2>{hasFilters ? '該当する食品がありません' : view === 'finished' ? '完了した食品はありません' : items.length === 0 ? '食品を登録しましょう' : '管理中の食品はありません'}</h2>
          {!hasFilters && view !== 'finished' && <button className="secondary" type="button" disabled={blocked} onClick={() => onCreate()}>
          <Icon name="plus" />食品を登録する</button>}
        </div> : <ul className="food-list">{displayed.map(item => {
          const state = deadlineState(item.deadline, today);
          return <li className={`food-row ${item.status !== 'active' ? 'completed' : ''}`} key={item.id}>
            <div className={`date-block state-${item.status === 'active' ? state : 'later'}`} aria-label={`${kinds[item.kind]} ${item.deadline}`}>
          <span className="date-month">{Number(item.deadline.slice(5, 7))}月</span>
          <strong>{Number(item.deadline.slice(8, 10))}</strong>
          </div>
            <div className="food-info">
              <div className="food-primary">
          <h3>{item.name}</h3>
          <span className="quantity">{item.quantity}{units[item.unit]}</span>
          </div>
              <div className="food-meta">
          <span className={`deadline-chip state-${item.status === 'active' ? state : 'later'}`}>{item.status !== 'active' ? (item.status === 'used' ? '使い切り済み' : '廃棄済み') : deadlineLabel(item.deadline, today)}</span>
          <span>{kinds[item.kind]}</span>
          <span>{places[item.place]}</span>
          <span>{categories[item.category]}</span>{item.deadline.slice(0, 4) !== today.slice(0, 4) && <time className="date-year" dateTime={item.deadline}>{item.deadline.slice(0, 4)}年</time>}</div>
            </div>
            <FoodActions item={item} blocked={blocked} onEdit={() => onEdit(item)} onFinish={() => onStatus(item, item.status === 'active' ? 'used' : 'active')} onDiscard={() => onStatus(item, 'discarded')} onRemove={() => onRemove(item)} />
          </li>;
        })}</ul>}
      </section>
  </>;
}
