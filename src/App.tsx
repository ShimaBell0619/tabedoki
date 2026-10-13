import { useEffect, useState } from 'react';
import { MAX_ITEMS, defaultTemplates, initialFoodForm, isFood, localDate, type Food, type FoodForm, type FoodStatus, type FoodTemplate } from './food';
import { READ_ERROR, SAVE_ERROR, readData, writeData, type FoodData } from './storage';
import { InventoryPage } from './components/InventoryPage';
import { FoodEditor } from './components/FoodEditor';
import { BackupPanel } from './components/BackupPanel';
import { Icon } from './components/Icon';

const initial = (() => {
  try { return readData(window.localStorage); }
  catch { return { items: [], templates: [], error: READ_ERROR, canExport: false }; }
})();

export function App() {
  const [data, setData] = useState<FoodData>({ items: initial.items, templates: initial.templates });
  const { items, templates } = data;
  const [editor, setEditor] = useState<{ item?: Food; templatesOnly: boolean } | null>(null);
  const [blocked, setBlocked] = useState(Boolean(initial.error));
  const [notice, setNotice] = useState(initial.error);
  const [formError, setFormError] = useState('');
  const [today, setToday] = useState(localDate);
  useEffect(() => {
    const update = () => setToday(localDate());
    document.addEventListener('visibilitychange', update);
    window.addEventListener('focus', update);
    return () => {
      document.removeEventListener('visibilitychange', update);
      window.removeEventListener('focus', update);
    };
  }, []);
  function showError(message: string) {
    setNotice(message);
    if (editor) setFormError(message);
  }
  function commitData(next: FoodData, allowRecovery = false): boolean {
    if (blocked && !allowRecovery) {
      showError('保存済みデータに問題があります。先に復元または再読み込みをしてください。');
      return false;
    }
    try {
      const saved = writeData(window.localStorage, next);
      setData(saved);
      setBlocked(false);
      return true;
    } catch { showError(SAVE_ERROR); return false; }
  }
  function openForm(item?: Food) {
    setFormError('');
    setEditor({ item, templatesOnly: false });
  }
  function saveTemplates(next: FoodTemplate[]): boolean {
    if (!commitData({ items, templates: next })) return false;
    setNotice('定番食品を保存しました。');
    setFormError('');
    return true;
  }
  function saveFood(form: FoodForm): boolean {
    const editingId = editor?.item?.id;
    if (!editingId && items.length >= MAX_ITEMS) { showError('食品は最大3,000件まで登録できます。'); return false; }
    const original = editingId ? items.find(item => item.id === editingId) : undefined;
    if (editingId && !original) { showError('編集する食品が見つかりません。'); return false; }
    const nextFood: Food = {
      ...form, name: form.name.trim(), id: original?.id ?? crypto.randomUUID(),
      status: original?.status ?? 'active',
    };
    if (!isFood(nextFood)) { showError('食品名、期限の日付、数量と選択項目を確認してください。'); return false; }
    const next = editingId ? items.map(item => item.id === editingId ? nextFood : item) : [...items, nextFood];
    if (!commitData({ items: next, templates })) return false;
    setNotice(editingId ? '食品を更新しました。' : '食品を登録しました。');
    return true;
  }
  function changeStatus(item: Food, status: FoodStatus) {
    const label = status === 'used' ? '使い切り' : status === 'discarded' ? '廃棄' : '管理中に戻す';
    if (!commitData({ ...data, items: items.map(value => value.id === item.id ? { ...value, status } : value) })) return;
    setNotice(`「${item.name}」を${label}にしました。`);
  }
  function removeFood(item: Food) {
    if (!window.confirm(`「${item.name}」を完全に削除しますか？\nこの操作は取り消せません。`)) return;
    if (!commitData({ ...data, items: items.filter(value => value.id !== item.id) })) return;
    setNotice('食品を削除しました。');
  }
  function restore(items: Food[], templates: FoodTemplate[]) {
    return commitData({ items, templates }, true);
  }
  function clearCorrupt() {
    if (!window.confirm('読み込めなかったデータを置き換え、食品を空にして定番食品を初期8件に戻しますか？\n元に戻せません。')) return;
    if (!commitData({ items: [], templates: defaultTemplates() }, true)) return;
    setNotice('空の状態から開始しました。');
  }

  return <div className="page">
    <header className="topbar">
      <div className="topbar-inner">
        <a href="/" className="brand" aria-label="たべどき ホーム">
          <span className="brand-mark"><Icon name="cooking-pot" /></span>たべどき
        </a>
        <button className="header-action" type="button" aria-label="定番食品を管理"
          onClick={() => { setFormError(''); setEditor({ templatesOnly: true }); }}>
          <Icon name="bookmark" />定番食品
        </button>
      </div>
    </header>
    <main className="main">
      <InventoryPage items={items} today={today} blocked={blocked} onCreate={() => openForm()}
        onEdit={openForm} onStatus={changeStatus} onRemove={removeFood}>
        {notice && <div className={`notice ${blocked ? 'notice-error' : ''}`} role="status">
          <span>{notice}</span>
          {blocked ? (!initial.canExport && <button type="button" onClick={clearCorrupt}>空の状態から始める</button>) :
            <button className="icon-button" type="button" aria-label="通知を閉じる" onClick={() => setNotice('')}><Icon name="x" /></button>}
        </div>}
      </InventoryPage>
      <BackupPanel items={items} templates={templates} today={today} blocked={blocked}
        canExport={initial.canExport} onNotice={setNotice} onRestore={restore} />
    </main>
    <div className="mobile-create-bar">
      <button className="primary mobile-create" disabled={blocked} onClick={() => openForm()} type="button"><Icon name="plus" />食品を登録</button>
    </div>
    {editor && <FoodEditor item={editor.item} templatesOnly={editor.templatesOnly} items={items}
      templates={templates} blocked={blocked} formError={formError} setFormError={setFormError} onClose={() => setEditor(null)}
      onSave={saveFood} onSaveTemplates={saveTemplates} />}
  </div>;
}
