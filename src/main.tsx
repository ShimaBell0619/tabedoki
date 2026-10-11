import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import { createRoot } from 'react-dom/client';
import {
  BACKUP_MAX_BYTES, MAX_ITEMS, STORAGE_KEY, daysLeft, deadlineLabel, deadlineState,
  localDate, makeBackup, readFoods, validateBackup,
  type DeadlineKind, type DeadlineState, type Food, type FoodStatus, type StoragePlace,
} from './food';
import './styles.css';

type FormValues = Pick<Food, 'name' | 'kind' | 'deadline' | 'quantity' | 'place'>;
type View = 'active' | 'finished' | 'all';
type DeadlineFilter = 'all' | DeadlineState;
const places: Record<StoragePlace, string> = { chilled: '冷蔵', frozen: '冷凍', pantry: '常温' };
const kinds: Record<DeadlineKind, string> = { 'best-before': '賞味期限', 'use-by': '消費期限' };
const initialValues = (): FormValues => ({ name: '', kind: 'best-before', deadline: localDate(), quantity: 1, place: 'chilled' });
const initial = readFoods(window.localStorage);

function App() {
  const [items, setItems] = useState<Food[]>(initial.items);
  const [blocked, setBlocked] = useState(Boolean(initial.error));
  const [notice, setNotice] = useState(initial.error);
  const [view, setView] = useState<View>('active');
  const [search, setSearch] = useState('');
  const [placeFilter, setPlaceFilter] = useState<'all' | StoragePlace>('all');
  const [deadlineFilter, setDeadlineFilter] = useState<DeadlineFilter>('all');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormValues>(initialValues);
  const dialog = useRef<HTMLDialogElement>(null);
  const upload = useRef<HTMLInputElement>(null);
  const [today, setToday] = useState(localDate);

  // Re-evaluate the calendar date on focus/visibility so a tab left open overnight stays correct.
  useEffect(() => {
    const update = () => setToday(localDate());
    document.addEventListener('visibilitychange', update);
    window.addEventListener('focus', update);
    return () => { document.removeEventListener('visibilitychange', update); window.removeEventListener('focus', update); };
  }, []);
  useEffect(() => {
    if (blocked) return;
    try { window.localStorage.setItem(STORAGE_KEY, makeBackup(items)); }
    catch { setNotice('保存できませんでした。ブラウザの空き容量や設定を確認し、JSONバックアップを取得してください。'); }
  }, [items, blocked]);

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
    if (placeFilter !== 'all' && item.place !== placeFilter) return false;
    if (deadlineFilter !== 'all' && deadlineState(item.deadline, today) !== deadlineFilter) return false;
    return true;
  }).sort((a, b) => a.deadline.localeCompare(b.deadline) || a.name.localeCompare(b.name, 'ja'));

  function openForm(item?: Food) {
    setEditingId(item?.id ?? null);
    setForm(item ? { name: item.name, kind: item.kind, deadline: item.deadline, quantity: item.quantity, place: item.place } : initialValues());
    dialog.current?.showModal();
  }
  function saveFood(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const name = form.name.trim();
    if (blocked) { setNotice('保存済みデータに問題があります。先に復元または初期化をしてください。'); return; }
    if (!name || name.length > 80 || !Number.isInteger(form.quantity) || form.quantity < 1 || form.quantity > 999) {
      setNotice('食品名と数量を確認してください。'); return;
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(form.deadline)) { setNotice('期限の日付を確認してください。'); return; }
    if (!editingId && items.length >= MAX_ITEMS) { setNotice('食品は最大3,000件まで登録できます。'); return; }
    setItems(old => editingId ? old.map(item => item.id === editingId ? { ...item, ...form, name } : item) :
      [...old, { ...form, name, id: crypto.randomUUID(), status: 'active' }]);
    setNotice(editingId ? '食品を更新しました。' : '食品を登録しました。');
    dialog.current?.close();
  }
  function changeStatus(item: Food, status: FoodStatus) {
    const label = status === 'used' ? '使い切り' : status === 'discarded' ? '廃棄' : '管理中に戻す';
    setItems(old => old.map(value => value.id === item.id ? { ...value, status } : value));
    setNotice(`「${item.name}」を${label}にしました。`);
  }
  function removeFood(item: Food) {
    if (!window.confirm(`「${item.name}」を完全に削除しますか？\nこの操作は取り消せません。`)) return;
    setItems(old => old.filter(value => value.id !== item.id));
    setNotice('食品を削除しました。');
  }
  function exportBackup() {
    const blob = new Blob([makeBackup(items)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a'); anchor.href = url;
    anchor.download = `tabedoki-backup-${today}.json`; anchor.click();
    URL.revokeObjectURL(url);
    setNotice('JSONバックアップを保存しました。');
  }
  async function importBackup(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (file.size > BACKUP_MAX_BYTES) { setNotice('バックアップファイルは1MB以下にしてください。'); return; }
    let incoming: Food[];
    try { incoming = validateBackup(JSON.parse(await file.text())); }
    catch (error) { setNotice(`復元できません：${error instanceof Error ? error.message : 'ファイルが不正です。'}`); return; }
    if (!window.confirm(`現在の${items.length}件を、バックアップの${incoming.length}件で上書きします。\n元のデータは失われます。続行しますか？`)) return;
    setItems(incoming); setBlocked(false);
    setNotice(`${incoming.length}件を復元しました。`);
  }
  function clearCorrupt() {
    if (!window.confirm('読み込めなかった保存データを削除し、空の状態から始めますか？\n元に戻せません。')) return;
    setBlocked(false); setItems([]); setNotice('データを初期化しました。');
  }

  return <div className="page">
    <header className="topbar"><div className="topbar-inner"><a href="/" className="brand" aria-label="たべどき ホーム"><span className="brand-mark" aria-hidden="true">葉</span>たべどき<span className="brand-dot">。</span></a><span className="top-note">おうちの食材、ちょうどよく。</span></div></header>
    <main className="main">
      <section className="intro"><div><div className="eyebrow">MY KITCHEN · 食品管理</div><h1>食べどきを、<br className="mobile-only"/>見逃さない。</h1><p>おうちの食品をまとめて、期限が近い順にチェック。</p></div><button className="primary desktop-create" disabled={blocked} onClick={() => openForm()} type="button"><span aria-hidden="true">＋</span> 食品を登録</button></section>
      <section className="summary" aria-label="期限の状況"><button className={`summary-tile danger ${deadlineFilter === 'expired' ? 'chosen' : ''}`} onClick={() => { setView('active'); setDeadlineFilter(deadlineFilter === 'expired' ? 'all' : 'expired'); }}><span className="summary-title"><span className="indicator red"/>期限切れ</span><strong>{counts.expired}<small>件</small></strong><span className="summary-sub">早めに確認</span></button><button className={`summary-tile warning ${deadlineFilter === 'today' ? 'chosen' : ''}`} onClick={() => { setView('active'); setDeadlineFilter(deadlineFilter === 'today' ? 'all' : 'today'); }}><span className="summary-title"><span className="indicator orange"/>今日まで</span><strong>{counts.today}<small>件</small></strong><span className="summary-sub">今日が期限</span></button><button className={`summary-tile gentle ${deadlineFilter === 'soon' ? 'chosen' : ''}`} onClick={() => { setView('active'); setDeadlineFilter(deadlineFilter === 'soon' ? 'all' : 'soon'); }}><span className="summary-title"><span className="indicator yellow"/>3日以内</span><strong>{counts.soon}<small>件</small></strong><span className="summary-sub">あと少し</span></button></section>
      {notice && <div className={`notice ${blocked ? 'notice-error' : ''}`} role="status"><span>{notice}</span>{blocked ? <button type="button" onClick={clearCorrupt}>初期化する</button> : <button type="button" aria-label="通知を閉じる" onClick={() => setNotice('')}>×</button>}</div>}
      <section className="inventory" aria-labelledby="inventory-heading"><div className="section-head"><div><div className="eyebrow">YOUR PANTRY</div><h2 id="inventory-heading">食品一覧 <span className="total">{displayed.length}件</span></h2></div><div className="tabs" role="group" aria-label="表示する食品"><button type="button" aria-pressed={view === 'active'} onClick={() => setView('active')}>管理中</button><button type="button" aria-pressed={view === 'finished'} onClick={() => setView('finished')}>完了</button><button type="button" aria-pressed={view === 'all'} onClick={() => setView('all')}>すべて</button></div></div>
      <div className="filters"><label className="search"><span className="sr-only">食品名で検索</span><span aria-hidden="true">⌕</span><input type="search" placeholder="食品名で検索" value={search} onChange={event => setSearch(event.target.value)}/></label><label className="select-label"><span className="sr-only">保存場所で絞り込み</span><select value={placeFilter} onChange={event => setPlaceFilter(event.target.value as typeof placeFilter)}><option value="all">すべての場所</option><option value="chilled">冷蔵</option><option value="frozen">冷凍</option><option value="pantry">常温</option></select></label><label className="select-label"><span className="sr-only">期限状態で絞り込み</span><select value={deadlineFilter} onChange={event => setDeadlineFilter(event.target.value as DeadlineFilter)}><option value="all">すべての期限</option><option value="expired">期限切れ</option><option value="today">今日まで</option><option value="soon">3日以内</option><option value="later">4日以上</option></select></label></div>
      {displayed.length === 0 ? <div className="empty"><div className="empty-icon" aria-hidden="true">✳</div><h3>{items.length === 0 ? 'まずは食品を登録しましょう' : '該当する食品がありません'}</h3><p>{items.length === 0 ? '期限と保存場所を記録して、食材を無駄なく使いましょう。' : '検索や絞り込みを変更してみてください。'}</p>{items.length === 0 && <button className="secondary" disabled={blocked} onClick={() => openForm()}>食品を登録する</button>}</div> :
      <ul className="food-list">{displayed.map(item => { const delta = daysLeft(item.deadline, today); const state = deadlineState(item.deadline, today); return <li className={`food-row ${item.status !== 'active' ? 'completed' : ''}`} key={item.id}><div className={`date-block state-${state}`} aria-label={`${kinds[item.kind]} ${item.deadline}`}><span className="date-month">{Number(item.deadline.slice(5, 7))}月</span><strong>{Number(item.deadline.slice(8, 10))}</strong></div><div className="food-info"><div className="food-primary"><h3>{item.name}</h3><span className={`deadline-chip state-${item.status === 'active' ? state : 'later'}`}>{item.status !== 'active' ? (item.status === 'used' ? '使い切り済み' : '廃棄済み') : deadlineLabel(item.deadline, today)}</span></div><div className="food-meta"><span>{kinds[item.kind]}</span><span aria-hidden="true">·</span><span>{places[item.place]}</span><span aria-hidden="true">·</span><span>数量 {item.quantity}</span>{item.status === 'active' && delta < 0 && <span className="sr-only">期限切れ</span>}</div></div><div className="food-actions"><button type="button" onClick={() => openForm(item)} aria-label={`${item.name}を編集`}>編集</button>{item.status === 'active' ? <><button type="button" onClick={() => changeStatus(item, 'used')} aria-label={`${item.name}を使い切り`}>使い切り</button><button type="button" onClick={() => changeStatus(item, 'discarded')} aria-label={`${item.name}を廃棄`}>廃棄</button></> : <button type="button" onClick={() => changeStatus(item, 'active')}>戻す</button>}<button type="button" className="delete" onClick={() => removeFood(item)} aria-label={`${item.name}を削除`}>削除</button></div></li>; })}</ul>}
      </section>
      <section className="data-section" aria-labelledby="data-heading"><div><div className="eyebrow">DATA & BACKUP</div><h2 id="data-heading">データのバックアップ</h2><p>データはこのブラウザ内だけに保存されます。ブラウザのデータ削除・機種変更で失われるため、定期的にJSONファイルへバックアップしてください。別の端末とは同期しません。</p></div><div className="backup-buttons"><button type="button" className="secondary" disabled={blocked} onClick={exportBackup}>JSONを保存</button><button type="button" className="secondary outline" onClick={() => upload.current?.click()}>JSONから復元</button><input className="sr-only" type="file" ref={upload} accept=".json,application/json" aria-label="バックアップファイルを選択" onChange={importBackup}/></div></section>
      <footer>たべどき · 家庭の食品管理 <span>保存先：このブラウザ</span></footer>
    </main>
    <button className="primary mobile-create" disabled={blocked} onClick={() => openForm()} type="button"><span aria-hidden="true">＋</span> 食品を登録</button>
    <dialog ref={dialog} className="food-dialog" aria-labelledby="dialog-heading"><form onSubmit={saveFood} className="food-form"><div className="dialog-head"><div><div className="eyebrow">FOOD DETAILS</div><h2 id="dialog-heading">{editingId ? '食品を編集' : '食品を登録'}</h2></div><button className="close" type="button" onClick={() => dialog.current?.close()} aria-label="閉じる">×</button></div><label>食品名 <span className="required">必須</span><input autoFocus required maxLength={80} placeholder="例：牛乳、たまご、食パン" value={form.name} onChange={event => setForm({ ...form, name: event.target.value })}/></label><div className="form-group"><label>期限の種類<select value={form.kind} onChange={event => setForm({ ...form, kind: event.target.value as DeadlineKind })}><option value="best-before">賞味期限</option><option value="use-by">消費期限</option></select></label><label>期限の日付<input type="date" required min="1000-01-01" max="9999-12-31" value={form.deadline} onChange={event => setForm({ ...form, deadline: event.target.value })}/></label></div><div className="form-group"><label>保存場所<select value={form.place} onChange={event => setForm({ ...form, place: event.target.value as StoragePlace })}><option value="chilled">冷蔵</option><option value="frozen">冷凍</option><option value="pantry">常温</option></select></label><label>数量<input type="number" required min="1" max="999" step="1" value={form.quantity} onChange={event => setForm({ ...form, quantity: Number(event.target.value) })}/></label></div><div className="dialog-actions"><button type="button" className="secondary outline" onClick={() => dialog.current?.close()}>キャンセル</button><button type="submit" className="primary">{editingId ? '変更を保存' : '登録する'}</button></div></form></dialog>
  </div>;
}

createRoot(document.getElementById('root')!).render(<App />);