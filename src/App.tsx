import { useEffect, useRef, useState } from 'react';
import { MAX_ITEMS, defaultTemplates, isFood, localDate, normalizedName, type Food, type FoodForm, type FoodStatus, type FoodTemplate } from './food';
import { READ_ERROR, SAVE_ERROR, RECOVERY_KEY, applyBackup, previousData, previousRaw, readData, replaceData, writeData, type AppData, type BackupData } from './storage';
import { addShopping, registerPurchase, setBought, shoppingFrom, type ShoppingItem } from './shopping';
import { InventoryPage } from './components/InventoryPage';
import { FoodEditor } from './components/FoodEditor';
import { ShoppingPage } from './components/ShoppingPage';
import { BackupPanel } from './components/BackupPanel';
import { Icon } from './components/Icon';

const initial = (() => {
  try { return readData(window.localStorage); }
  catch { return { items: [], templates: [], shopping: [], error: READ_ERROR + '原文も取得できません。', canExport: false, raw: null }; }
})();

export function App() {
  const [data, setData] = useState<AppData>({ items: initial.items, templates: initial.templates, shopping: initial.shopping });
  // Synchronous operations and asynchronous file imports always start from the last successful commit.
  const committed = useRef(data);
  const [screen, setScreen] = useState<'inventory' | 'shopping'>('inventory');
  const [editor, setEditor] = useState<{ item?: Food; purchase?: ShoppingItem; templatesOnly: boolean } | null>(null);
  const foodSaved = useRef(false);
  const [blocked, setBlocked] = useState(Boolean(initial.error));
  const [notice, setNotice] = useState(initial.error);
  const [formError, setFormError] = useState('');
  const [today, setToday] = useState(localDate);
  const unreadable = blocked && !initial.canExport;
  let hasPrevious = false;
  try { hasPrevious = window.localStorage.getItem(RECOVERY_KEY) !== null; } catch { /* Recovery storage unavailable. */ }
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const update = () => {
      setToday(localDate());
      clearTimeout(timer);
      const now = new Date();
      const midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
      timer = setTimeout(update, midnight.getTime() - now.getTime());
    };
    update();
    document.addEventListener('visibilitychange', update);
    window.addEventListener('focus', update);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('visibilitychange', update);
      window.removeEventListener('focus', update);
    };
  }, []);

  function showError(message: string) {
    setNotice(message);
    if (editor) setFormError(message);
  }
  function commitData(next: AppData, replacement = false): boolean {
    if (blocked && !replacement) {
      showError('保存済みデータに問題があります。先に復元または再読み込みをしてください。');
      return false;
    }
    try {
      const saved = replacement ? replaceData(window.localStorage, next) : writeData(window.localStorage, next);
      committed.current = saved;
      setData(saved); setBlocked(false);
      return true;
    } catch { showError(replacement ? '置換前データの退避または保存に失敗しました。' + SAVE_ERROR : SAVE_ERROR); return false; }
  }
  function openForm(item?: Food, purchase?: ShoppingItem) {
    foodSaved.current = false;
    setFormError(''); setEditor({ item, purchase, templatesOnly: false });
  }
  function saveTemplates(templates: FoodTemplate[]): boolean {
    if (!commitData({ ...committed.current, templates })) return false;
    setNotice('定番食品を保存しました。'); setFormError('');
    return true;
  }
  function saveFood(form: FoodForm): boolean {
    if (foodSaved.current) return false;
    const current = committed.current;
    const editingId = editor?.item?.id;
    if (!editingId && current.items.length >= MAX_ITEMS) { showError('食品は最大3,000件まで登録できます。'); return false; }
    const original = editingId ? current.items.find(item => item.id === editingId) : undefined;
    if (editingId && !original) { showError('編集する食品が見つかりません。'); return false; }
    const food: Food = {
      ...form, name: form.name.trim(), id: original?.id ?? crypto.randomUUID(),
      status: original?.status ?? 'active', lowStock: original?.lowStock ?? false,
    };
    if (!isFood(food)) { showError('食品名、期限の日付、数量と選択項目を確認してください。'); return false; }
    let next: AppData;
    try {
      next = editor?.purchase ? registerPurchase(current, editor.purchase.id, food) : {
        ...current, items: editingId ? current.items.map(item => item.id === editingId ? food : item) : [...current.items, food],
      };
    } catch (error) { showError(error instanceof Error ? error.message : '登録できません。'); return false; }
    if (!commitData(next)) return false;
    foodSaved.current = true;
    setNotice(editingId ? '食品を更新しました。' : '食品を登録しました。');
    return true;
  }
  function changeStatus(item: Food, status: FoodStatus) {
    const current = committed.current;
    if (!commitData({ ...current, items: current.items.map(value => value.id === item.id ? { ...value, status } : value) })) return;
    const label = status === 'used' ? '使い切り' : status === 'discarded' ? '廃棄' : '管理中に戻す';
    setNotice(`「${item.name}」を${label}にしました。`);
  }
  function removeFood(item: Food) {
    if (!window.confirm(`「${item.name}」を完全に削除しますか？\nこの操作は取り消せません。`)) return;
    const current = committed.current;
    if (!commitData({ ...current, items: current.items.filter(value => value.id !== item.id) })) return;
    setNotice('食品を削除しました。');
  }
  function changeLowStock(item: Food, lowStock: boolean) {
    const current = committed.current;
    if (!commitData({ ...current, items: current.items.map(value => value.id === item.id ? { ...value, lowStock } : value) })) return;
    setNotice(`「${item.name}」の残りわずかを${lowStock ? '設定' : '解除'}しました。`);
  }
  function addToShopping(source: string | Food | FoodTemplate): boolean {
    const current = committed.current;
    const name = typeof source === 'string' ? source : source.name;
    if (current.shopping.some(item => !item.bought && normalizedName(item.name) === normalizedName(name))) {
      setNotice(`「${name.trim()}」は買い物に追加済みです。`);
      return true;
    }
    try {
      const shopping = addShopping(current.shopping, shoppingFrom(source, crypto.randomUUID()));
      if (!commitData({ ...current, shopping })) return false;
    } catch (error) { showError(error instanceof Error ? error.message : '追加できません。'); return false; }
    setNotice(`「${name.trim()}」を買い物に追加しました。`);
    return true;
  }
  function changeBought(item: ShoppingItem, bought: boolean) {
    const current = committed.current;
    try {
      if (!commitData({ ...current, shopping: setBought(current.shopping, item.id, bought) })) return;
      setNotice(`「${item.name}」を${bought ? '購入済み' : '未購入'}にしました。`);
    } catch (error) { showError(error instanceof Error ? error.message + '両方の項目を保持しました。未購入項目を削除してから解除できます。' : '変更できません。'); }
  }
  function removeShopping(item: ShoppingItem) {
    if (!window.confirm(`買い物「${item.name}」を削除しますか？`)) return;
    const current = committed.current;
    if (commitData({ ...current, shopping: current.shopping.filter(value => value.id !== item.id) })) setNotice('買い物項目を削除しました。');
  }
  function restore(backup: BackupData): boolean {
    return commitData(applyBackup(committed.current, backup), true);
  }
  function restorePrevious() {
    try {
      const previous = previousData(window.localStorage);
      if (!window.confirm(`直前の置換前データ（食品${previous.items.length}件・定番${previous.templates.length}件・買い物${previous.shopping.length}件）で現在のデータを置き換えますか？\n退避後の変更はこの復元に含まれません。`)) return;
      if (commitData(previous, true)) setNotice('直前の置換前データを復元しました。');
    } catch (error) { showError(`復元できません：${error instanceof Error ? error.message : '退避が不正です。'}`); }
  }
  function clearCorrupt() {
    if (!window.confirm('読み込めなかった原文を退避し、食品と買い物を空にして定番食品を初期8件に戻しますか？')) return;
    if (commitData({ items: [], templates: defaultTemplates(), shopping: [] }, true)) setNotice('空の状態から開始しました。');
  }
  const navigation = <>
    <button type="button" disabled={unreadable} aria-pressed={screen === 'inventory'} onClick={() => setScreen('inventory')}>在庫</button>
    <button type="button" disabled={unreadable} aria-pressed={screen === 'shopping'} onClick={() => setScreen('shopping')}>買い物</button>
  </>;

  return <div className="page">
    <header className="topbar"><div className="topbar-inner">
      <a href="/" className="brand" aria-label="たべどき ホーム"><span className="brand-mark"><Icon name="cooking-pot" /></span>たべどき</a>
      <nav className="screen-navigation desktop-navigation" aria-label="画面選択">{navigation}</nav>
      <button className="header-action" type="button" disabled={unreadable} aria-label="定番食品を管理"
        onClick={() => { setFormError(''); setEditor({ templatesOnly: true }); }}><Icon name="bookmark" />定番食品</button>
    </div></header>
    <main className="main">
      {notice && <div className={`notice ${blocked ? 'notice-error' : ''}`} role="status">
        <span>{notice}</span>
        {blocked ? <button type="button" onClick={() => window.location.reload()}>再読み込み</button> :
          <button className="icon-button" type="button" aria-label="通知を閉じる" onClick={() => setNotice('')}><Icon name="x" /></button>}
      </div>}
      {unreadable ? <h1>データの復旧</h1> : <>
      <div hidden={screen !== 'inventory'}>
        <InventoryPage items={data.items} today={today} blocked={blocked} onCreate={() => openForm()}
          onEdit={openForm} onStatus={changeStatus} onRemove={removeFood} shopping={data.shopping}
          onLowStock={changeLowStock} onAddShopping={addToShopping} />
      </div>
      <div hidden={screen !== 'shopping'}>
        <ShoppingPage items={data.shopping} foods={data.items} templates={data.templates} blocked={blocked}
          onAdd={addToShopping} onBought={changeBought} onRemove={removeShopping} onRegister={item => openForm(undefined, item)} />
      </div>
      </>}
      <BackupPanel data={data} today={today} blocked={blocked} canExport={!blocked || initial.canExport}
        raw={blocked ? initial.raw : null} hasPrevious={hasPrevious} onNotice={setNotice} onRestore={restore}
        onRestorePrevious={restorePrevious} onReadPreviousRaw={() => previousRaw(window.localStorage)} onReset={clearCorrupt} />
    </main>
    <div className="mobile-create-bar mobile-navigation">
      <nav className="screen-navigation" aria-label="画面選択">{navigation}</nav>
      {screen === 'inventory' ? <button className="primary" disabled={blocked} onClick={() => openForm()} type="button"><Icon name="plus" />食品を登録</button> :
        <button className="primary" disabled={blocked} type="button" onClick={() => document.getElementById('shopping-name')?.focus()}><Icon name="plus" />買うものを追加</button>}
    </div>
    {editor && <FoodEditor item={editor.item} purchase={editor.purchase} templatesOnly={editor.templatesOnly} items={data.items}
      templates={data.templates} blocked={blocked} formError={formError} setFormError={setFormError} onClose={() => setEditor(null)}
      onSave={saveFood} onSaveTemplates={saveTemplates} />}
  </div>;
}
