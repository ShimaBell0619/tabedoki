import { useState } from 'react';
import type { CloudStore, Snapshot } from '../data/cloud';
import { InventoryPage } from '../features/inventory/InventoryPage';
import { FoodEditor } from '../features/inventory/FoodEditor';
import { ShoppingPage } from '../features/shopping/ShoppingPage';
import { AccountMenu } from '../features/auth/AccountMenu';
import { Icon } from '../components/Icon';

import { useAppModel } from './useAppModel';
import { useToday } from './useToday';

type Props = { store: CloudStore; initial: Snapshot; email: string; onLogout: () => void };
export function App({ store, initial, email, onLogout }: Props) {
  const [screen, setScreen] = useState<'inventory' | 'shopping'>('inventory');
  const today = useToday();
  const { data, saving, blocked, notice, setNotice, formError, setFormError, editor, setEditor, refresh, openForm, saveTemplates, saveFood, addStock, changeStatus, removeFood, changeLowStock, addToShopping, changeBought, removeShopping } = useAppModel(store, initial);
  const navigation = <>
    <button type="button" aria-pressed={screen === 'inventory'} onClick={() => setScreen('inventory')}>在庫</button>
    <button type="button" aria-pressed={screen === 'shopping'} onClick={() => setScreen('shopping')}>買い物</button>
  </>;

  return <div className="page">
    <header className="topbar"><div className="topbar-inner">
      <a href="/" className="brand" aria-label="たべどき ホーム"><span className="brand-mark"><Icon name="cooking-pot" /></span>たべどき</a>
      <nav className="screen-navigation desktop-navigation" aria-label="画面選択">{navigation}</nav>
      <div className="header-actions">
        <button className="header-action" type="button" disabled={blocked || saving} aria-label="定番食品を管理"
          onClick={() => { setFormError(''); setEditor({ templatesOnly: true }); }}><Icon name="bookmark" />定番食品</button>
        <AccountMenu email={email} busy={saving} onRefresh={refresh} onLogout={onLogout} />
      </div>
    </div></header>
    <main className="main">
      {saving && <p className="cloud-pending" role="status" aria-label="保存状態">保存・読み込み中…</p>}
      {notice && <div className={`notice ${blocked ? 'notice-error' : ''}`} role="status">
        <span>{notice}</span>
        {blocked ? <button type="button" disabled={saving} onClick={refresh}>クラウドを再取得</button> :
          <button className="icon-button" type="button" aria-label="通知を閉じる" onClick={() => setNotice('')}><Icon name="x" /></button>}
      </div>}
      <>
      <div hidden={screen !== 'inventory'}>
        <InventoryPage items={data.items} today={today} blocked={blocked || saving} onCreate={() => openForm()}
          onEdit={openForm} onStatus={changeStatus} onRemove={removeFood} shopping={data.shopping}
          onLowStock={changeLowStock} onAddShopping={addToShopping} onAddStock={addStock} />
      </div>
      <div hidden={screen !== 'shopping'}>
        <ShoppingPage items={data.shopping} foods={data.items} templates={data.templates} blocked={blocked || saving}
          onAdd={addToShopping} onBought={changeBought} onRemove={removeShopping} onRegister={item => openForm(undefined, item)} />
      </div>
      </>
    </main>
    <div className="mobile-create-bar mobile-navigation">
      <nav className="screen-navigation" aria-label="画面選択">{navigation}</nav>
      {screen === 'inventory' ? <button className="primary" disabled={blocked || saving} onClick={() => openForm()} type="button"><Icon name="plus" />食品を登録</button> :
        <button className="primary" disabled={blocked} type="button" onClick={() => document.getElementById('shopping-name')?.focus()}><Icon name="plus" />買うものを追加</button>}
    </div>
    {editor && <FoodEditor item={editor.item} purchase={editor.purchase} templatesOnly={editor.templatesOnly} items={data.items}
      templates={data.templates} blocked={blocked || saving} canRefresh={blocked && !saving} onRefresh={refresh} formError={formError} setFormError={setFormError} onClose={() => setEditor(null)}
      onSave={saveFood} onSaveTemplates={saveTemplates} />}
  </div>;
}
