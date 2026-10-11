import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import { createRoot } from 'react-dom/client';
import {
  BACKUP_MAX_BYTES, MAX_ITEMS, READ_ERROR, SAVE_ERROR, applyFoodCandidate, categories,
  deadlineLabel, deadlineState, defaultTemplates, initialFoodForm, isFood, previousFoods, units, writeData,
  localDate, makeBackup, readData, validateBackup,
  type DeadlineKind, type DeadlineState, type Food, type FoodCategory, type FoodForm, type FoodTemplate,
  type FoodStatus, type QuantityUnit, type StoragePlace,
} from './food';
import { TemplateManager } from './TemplateManager';
import { FoodActions } from './FoodActions';
import { Icon } from './Icon';
import './styles.css';

type View = 'active' | 'finished' | 'all';
type DeadlineFilter = 'all' | DeadlineState;
const places: Record<StoragePlace, string> = { chilled: '冷蔵', frozen: '冷凍', pantry: '常温' };
const kinds: Record<DeadlineKind, string> = { 'best-before': '賞味期限', 'use-by': '消費期限' };
// The localStorage getter can throw before readFoods is called.
const initial = (() => {
  try { return readData(window.localStorage); }
  catch { return { items: [], templates: [], error: READ_ERROR, canExport: false }; }
})();

function App() {
  const [items, setItems] = useState<Food[]>(initial.items);
  const [templates, setTemplates] = useState<FoodTemplate[]>(initial.templates);
  const [managingTemplates, setManagingTemplates] = useState(false);
  const returnToFood = useRef(false);
  const [blocked, setBlocked] = useState(Boolean(initial.error));
  const [notice, setNotice] = useState(initial.error);
  const [view, setView] = useState<View>('active');
  const [search, setSearch] = useState('');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [selectedCandidate, setSelectedCandidate] = useState<string | null>(null);
  const [categoryFilter, setCategoryFilter] = useState<'all' | FoodCategory>('all');
  const [placeFilter, setPlaceFilter] = useState<'all' | StoragePlace>('all');
  const [deadlineFilter, setDeadlineFilter] = useState<DeadlineFilter>('all');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FoodForm>(initialFoodForm);
  const [formError, setFormError] = useState('');
  const dialog = useRef<HTMLDialogElement>(null);
  const upload = useRef<HTMLInputElement>(null);
  const [today, setToday] = useState(localDate);

  useEffect(() => {
    if (dialog.current?.open) {
      dialog.current.querySelector<HTMLButtonElement>('button')?.focus();
      dialog.current.scrollTop = 0;
    }
  }, [managingTemplates]);

  // Re-evaluate the calendar date on focus/visibility so a tab left open overnight stays correct.
  useEffect(() => {
    const update = () => setToday(localDate());
    document.addEventListener('visibilitychange', update);
    window.addEventListener('focus', update);
    return () => { document.removeEventListener('visibilitychange', update); window.removeEventListener('focus', update); };
  }, []);


  const active = items.filter(item => item.status === 'active');
  const counts = {
    expired: active.filter(item => deadlineState(item.deadline, today) === 'expired').length,
    today: active.filter(item => deadlineState(item.deadline, today) === 'today').length,
    soon: active.filter(item => deadlineState(item.deadline, today) === 'soon').length,
  };
  const previous = previousFoods(items);
  const displayed = items.filter(item => {
    if (view === 'active' && item.status !== 'active') return false;
    if (view === 'finished' && item.status === 'active') return false;
    if (search && !item.name.toLocaleLowerCase('ja').includes(search.trim().toLocaleLowerCase('ja'))) return false;
    if (categoryFilter !== 'all' && item.category !== categoryFilter) return false;
    if (placeFilter !== 'all' && item.place !== placeFilter) return false;
    if (deadlineFilter !== 'all' && deadlineState(item.deadline, today) !== deadlineFilter) return false;
    return true;
  }).sort((a, b) => a.deadline.localeCompare(b.deadline) || a.name.localeCompare(b.name, 'ja'));

  function showError(message: string) {
    setNotice(message);
    if (dialog.current?.open) setFormError(message);
  }
  function commitData(next: Food[], nextTemplates = templates, allowRecovery = false): boolean {
    if (blocked && !allowRecovery) {
      showError('保存済みデータに問題があります。先に復元または再読み込みをしてください。');
      return false;
    }
    try {
      const saved = writeData(window.localStorage, { items: next, templates: nextTemplates });
      setItems(saved.items); setTemplates(saved.templates); setBlocked(false);
      return true;
    } catch { showError(SAVE_ERROR); return false; }
  }
  function openForm(item?: Food) {
    setManagingTemplates(false);
    setEditingId(item?.id ?? null);
    setForm(item ? {
      name: item.name, category: item.category, kind: item.kind, deadline: item.deadline,
      quantity: item.quantity, unit: item.unit, place: item.place,
    } : initialFoodForm());
    setFormError('');
    setSelectedCandidate(null);
    dialog.current?.showModal();
  }
  function openTemplates(fromFood = false) {
    returnToFood.current = fromFood;
    setFormError(''); setSelectedCandidate(null); setManagingTemplates(true);
    if (!dialog.current?.open) dialog.current?.showModal();
  }
  function closeTemplates() {
    setFormError('');
    if (returnToFood.current) setManagingTemplates(false);
    else dialog.current?.close();
  }
  function saveTemplates(next: FoodTemplate[]): boolean {
    if (!commitData(items, next)) return false;
    setNotice('定番食品を保存しました。'); setFormError('');
    return true;
  }
  function chooseCandidate(candidate: FoodTemplate | Food, source: 'template' | 'food') {
    setSelectedCandidate(`${source}:${candidate.id}`);
    setForm(current => applyFoodCandidate(current, candidate));
    setFormError('');
  }
  function saveFood(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editingId && items.length >= MAX_ITEMS) { showError('食品は最大3,000件まで登録できます。'); return; }
    const original = editingId ? items.find(item => item.id === editingId) : undefined;
    if (editingId && !original) { showError('編集する食品が見つかりません。'); return; }
    const nextFood: Food = {
      ...form, name: form.name.trim(), id: original?.id ?? crypto.randomUUID(),
      status: original?.status ?? 'active',
    };
    if (!isFood(nextFood)) { showError('食品名、期限の日付、数量と選択項目を確認してください。'); return; }
    const next = editingId ? items.map(item => item.id === editingId ? nextFood : item) : [...items, nextFood];
    if (!commitData(next)) return;
    setNotice(editingId ? '食品を更新しました。' : '食品を登録しました。');
    dialog.current?.close();
  }
  function changeStatus(item: Food, status: FoodStatus) {
    const label = status === 'used' ? '使い切り' : status === 'discarded' ? '廃棄' : '管理中に戻す';
    if (!commitData(items.map(value => value.id === item.id ? { ...value, status } : value))) return;
    setNotice(`「${item.name}」を${label}にしました。`);
  }
  function removeFood(item: Food) {
    if (!window.confirm(`「${item.name}」を完全に削除しますか？\nこの操作は取り消せません。`)) return;
    if (!commitData(items.filter(value => value.id !== item.id))) return;
    setNotice('食品を削除しました。');
  }
  function exportBackup() {
    const blob = new Blob([makeBackup({ items, templates })], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a'); anchor.href = url;
    anchor.download = `tabedoki-backup-${today}.json`; anchor.click();
    URL.revokeObjectURL(url);
    setNotice(blocked ? 'JSONバックアップを保存しました。保存の問題を解消して再読み込みしてください。' : 'JSONバックアップを保存しました。');
  }
  async function importBackup(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (file.size > BACKUP_MAX_BYTES) { setNotice('バックアップファイルは5MB以下にしてください。'); return; }
    let incoming: ReturnType<typeof validateBackup>;
    try { incoming = validateBackup(JSON.parse(await file.text())); }
    catch (error) { setNotice(`復元できません：${error instanceof Error ? error.message : 'ファイルが不正です。'}`); return; }
    if (!window.confirm(`現在の食品${items.length}件を、バックアップの${incoming.items.length}件で上書きします。\n${incoming.templates !== undefined ? '定番食品もバックアップの内容に置き換えます。' : '現在の定番食品は保持します。'}\n元の食品データは失われます。続行しますか？`)) return;
    if (!commitData(incoming.items, incoming.templates ?? templates, true)) return;
    setNotice(`${incoming.items.length}件を復元しました。`);
  }
  function clearCorrupt() {
    if (!window.confirm('読み込めなかったデータを置き換え、食品を空にして定番食品を初期8件に戻しますか？\n元に戻せません。')) return;
    if (!commitData([], defaultTemplates(), true)) return;
    setNotice('空の状態から開始しました。');
  }

  const filterCount = Number(categoryFilter !== 'all') + Number(placeFilter !== 'all') + Number(deadlineFilter !== 'all');
  const hasFilters = filterCount > 0 || Boolean(search.trim());
  const deadlineNames = { expired: '期限切れ', today: '今日まで', soon: '3日以内', later: '4日以上' };
  function resetFilters() {
    setSearch(''); setCategoryFilter('all'); setPlaceFilter('all'); setDeadlineFilter('all');
  }

  return <div className="page">
    <header className="topbar"><div className="topbar-inner">
      <a href="/" className="brand" aria-label="たべどき ホーム"><span className="brand-mark"><Icon name="cooking-pot" /></span>たべどき</a>
      <button className="header-action" type="button" aria-label="定番食品を管理" onClick={() => openTemplates()}><Icon name="bookmark" />定番食品</button>
    </div></header>
    <main className="main">
      <div className="page-heading"><h1 id="inventory-heading">食品一覧 <span className="total">{displayed.length}件</span></h1>
        <button className="primary desktop-create" disabled={blocked} onClick={() => openForm()} type="button"><Icon name="plus" />食品を登録</button>
      </div>
      <section className="summary" aria-label="期限の状況">
        {(['expired', 'today', 'soon'] as const).map(state => <button key={state} type="button" className={`summary-tile state-${state}`} aria-pressed={view === 'active' && deadlineFilter === state} onClick={() => { setView('active'); setDeadlineFilter(view === 'active' && deadlineFilter === state ? 'all' : state); }}>
          <span className="summary-title">{deadlineNames[state]}</span><strong>{counts[state]}<small>件</small></strong>
        </button>)}
      </section>
      {notice && <div className={`notice ${blocked ? 'notice-error' : ''}`} role="status"><span>{notice}</span>{blocked ? (!initial.canExport && <button type="button" onClick={clearCorrupt}>空の状態から始める</button>) : <button className="icon-button" type="button" aria-label="通知を閉じる" onClick={() => setNotice('')}><Icon name="x" /></button>}</div>}
      <section className="inventory" aria-labelledby="inventory-heading">
        <div className="list-toolbar">
          <div className="tabs" role="group" aria-label="表示する食品">
            <button type="button" aria-pressed={view === 'active'} onClick={() => setView('active')}>管理中</button>
            <button type="button" aria-pressed={view === 'finished'} onClick={() => setView('finished')}>完了</button>
            <button type="button" aria-pressed={view === 'all'} onClick={() => setView('all')}>すべて</button>
          </div><span className="sort-label">期限が近い順</span>
        </div>
        <div className="search-toolbar">
          <label className="search"><span className="sr-only">食品名で検索</span><Icon name="search" /><input type="search" placeholder="食品名で検索" value={search} onChange={event => setSearch(event.target.value)}/></label>
          <button type="button" className="filter-toggle secondary" aria-expanded={filtersOpen} aria-controls="filter-panel" onClick={() => setFiltersOpen(!filtersOpen)}><Icon name="sliders-horizontal" />絞り込み{filterCount > 0 && <span className="filter-count">{filterCount}</span>}</button>
        </div>
        <div className="filters" id="filter-panel" hidden={!filtersOpen}>
          <label><span>カテゴリ</span><select aria-label="カテゴリで絞り込み" value={categoryFilter} onChange={event => setCategoryFilter(event.target.value as typeof categoryFilter)}><option value="all">すべて</option>{Object.entries(categories).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
          <label><span>保存場所</span><select aria-label="保存場所で絞り込み" value={placeFilter} onChange={event => setPlaceFilter(event.target.value as typeof placeFilter)}><option value="all">すべて</option>{Object.entries(places).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
          <label><span>期限</span><select aria-label="期限状態で絞り込み" value={deadlineFilter} onChange={event => setDeadlineFilter(event.target.value as DeadlineFilter)}><option value="all">すべて</option>{Object.entries(deadlineNames).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
        </div>
        {hasFilters && <div className="active-filters" aria-label="適用中の絞り込み">
          {search.trim() && <span>「{search.trim()}」</span>}{categoryFilter !== 'all' && <span>{categories[categoryFilter]}</span>}{placeFilter !== 'all' && <span>{places[placeFilter]}</span>}{deadlineFilter !== 'all' && <span>{deadlineNames[deadlineFilter]}</span>}
          <button type="button" onClick={resetFilters}>条件をクリア</button>
        </div>}
        {displayed.length === 0 ? <div className="empty">
          <div className="empty-icon"><Icon name={hasFilters ? 'search' : 'cooking-pot'} /></div>
          <h2>{hasFilters ? '該当する食品がありません' : view === 'finished' ? '完了した食品はありません' : items.length === 0 ? '食品を登録しましょう' : '管理中の食品はありません'}</h2>
          {!hasFilters && view !== 'finished' && <button className="secondary" type="button" disabled={blocked} onClick={() => openForm()}><Icon name="plus" />食品を登録する</button>}
        </div> : <ul className="food-list">{displayed.map(item => {
          const state = deadlineState(item.deadline, today);
          return <li className={`food-row ${item.status !== 'active' ? 'completed' : ''}`} key={item.id}>
            <div className={`date-block state-${item.status === 'active' ? state : 'later'}`} aria-label={`${kinds[item.kind]} ${item.deadline}`}><span className="date-month">{Number(item.deadline.slice(5, 7))}月</span><strong>{Number(item.deadline.slice(8, 10))}</strong></div>
            <div className="food-info">
              <div className="food-primary"><h3>{item.name}</h3><span className="quantity">{item.quantity}{units[item.unit]}</span></div>
              <div className="food-meta"><span className={`deadline-chip state-${item.status === 'active' ? state : 'later'}`}>{item.status !== 'active' ? (item.status === 'used' ? '使い切り済み' : '廃棄済み') : deadlineLabel(item.deadline, today)}</span><span>{kinds[item.kind]}</span><span>{places[item.place]}</span><span>{categories[item.category]}</span><time className="date-year" dateTime={item.deadline}>{item.deadline.slice(0, 4)}年</time></div>
            </div>
            <FoodActions item={item} blocked={blocked} onEdit={() => openForm(item)} onFinish={() => changeStatus(item, item.status === 'active' ? 'used' : 'active')} onDiscard={() => changeStatus(item, 'discarded')} onRemove={() => removeFood(item)} />
          </li>;
        })}</ul>}
      </section>
      <section className="data-section" aria-labelledby="data-heading">
        <div><h2 id="data-heading">バックアップ</h2><p>このブラウザに保存されます。端末間の同期はありません。<br/>データ削除・機種変更で失われるため、バックアップを保存してください。</p></div>
        <div className="backup-buttons">
          <button type="button" className="secondary" disabled={blocked && !initial.canExport} onClick={exportBackup}><Icon name="download" />バックアップを保存</button>
          <button type="button" className="secondary outline" onClick={() => upload.current?.click()}><Icon name="upload" />バックアップから復元</button>
          <input className="sr-only" type="file" ref={upload} accept=".json,application/json" aria-label="バックアップファイルを選択" onChange={importBackup}/>
        </div>
      </section>
    </main>
    <div className="mobile-create-bar"><button className="primary mobile-create" disabled={blocked} onClick={() => openForm()} type="button"><Icon name="plus" />食品を登録</button></div>
    <dialog ref={dialog} className="food-dialog" aria-labelledby="dialog-heading" onClose={() => setManagingTemplates(false)} onCancel={event => { if (managingTemplates && returnToFood.current) { event.preventDefault(); closeTemplates(); } }}>
      {managingTemplates ? <TemplateManager templates={templates} blocked={blocked} error={formError} onError={setFormError} onSave={saveTemplates} onDone={closeTemplates} returning={returnToFood.current}/> : <form onSubmit={saveFood} className="food-form">
        <div className="dialog-head"><h2 id="dialog-heading">{editingId ? '食品を編集' : '食品を登録'}</h2><button className="close icon-button" type="button" onClick={() => dialog.current?.close()} aria-label="閉じる"><Icon name="x" /></button></div>
        {!editingId && <div className="candidates">
          <section aria-label="定番食品"><div className="candidate-heading"><h3>定番食品</h3><button type="button" className="manage-link" onClick={() => openTemplates(true)}>定番を編集</button></div>
            {templates.length === 0 && <p className="form-help">よく買う食品を追加できます。</p>}
            <div className="candidate-list">{templates.map(candidate => <button key={candidate.id} type="button" className="candidate-button" aria-pressed={selectedCandidate === `template:${candidate.id}`} aria-label={`定番の${candidate.name}`} onClick={() => chooseCandidate(candidate, 'template')}>{candidate.name}</button>)}</div>
          </section>
          {previous.length > 0 && <section aria-label="前に登録した食品"><h3>前に登録した食品</h3><div className="candidate-list">{previous.map(candidate => <button key={candidate.id} type="button" className="candidate-button" aria-pressed={selectedCandidate === `food:${candidate.id}`} aria-label={`以前の${candidate.name}`} onClick={() => chooseCandidate(candidate, 'food')}>{candidate.name}</button>)}</div></section>}
        </div>}
        <label><span>食品名 <span className="required">必須</span></span><input required maxLength={80} placeholder="例：牛乳" value={form.name} onChange={event => { setForm({ ...form, name: event.target.value }); setSelectedCandidate(null); }}/></label>
        <div className="form-group"><label>期限の種類<select value={form.kind} onChange={event => setForm({ ...form, kind: event.target.value as DeadlineKind })}>{Object.entries(kinds).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><label><span>期限の日付 <span className="required">必須</span></span><input type="date" required min="1000-01-01" max="9999-12-31" value={form.deadline} onChange={event => setForm({ ...form, deadline: event.target.value })}/></label></div>
        <p className="form-help">期限は未開封・指定の保存方法が前提です。商品の表示を確認してください。</p>
        <div className="form-group"><label>数量<input type="number" required min="1" max="999" step="1" value={form.quantity || ''} onChange={event => setForm({ ...form, quantity: Number(event.target.value) })}/></label><label>数量の単位<select value={form.unit} onChange={event => setForm({ ...form, unit: event.target.value as QuantityUnit })}>{Object.entries(units).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label></div>
        {form.unit === 'pack' && <p className="form-help">3個組の納豆なら1パック。個別に数える場合は「個」に変更してください。</p>}
        <div className="form-group"><label>保存場所<select value={form.place} onChange={event => setForm({ ...form, place: event.target.value as StoragePlace })}>{Object.entries(places).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><label>食品カテゴリ<select value={form.category} onChange={event => setForm({ ...form, category: event.target.value as FoodCategory })}>{Object.entries(categories).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label></div>
        {formError && <p className="form-error" role="alert">{formError}</p>}
        <div className="dialog-actions"><button type="button" className="secondary outline" onClick={() => dialog.current?.close()}>キャンセル</button><button type="submit" className="primary" disabled={blocked}>{editingId ? '変更を保存' : '登録する'}</button></div>
      </form>}
    </dialog>
  </div>;
}

createRoot(document.getElementById('root')!).render(<App />);
