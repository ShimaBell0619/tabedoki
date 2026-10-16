import { Brand } from '../components/Brand';
import { ScreenNavigation } from './ScreenNavigation';
import { cn } from '@/components/ui/utils';
import { Button } from '@/components/ui/button';
import { useState } from 'react';
import type { DataStore, Snapshot } from '../data/cloud';
import { InventoryPage } from '../features/inventory/InventoryPage';
import { FoodEditor } from '../features/inventory/FoodEditor';
import { ShoppingPage } from '../features/shopping/ShoppingPage';
import { AccountMenu } from '../features/auth/AccountMenu';
import { Icon } from '../components/Icon';

import { useAppModel } from './useAppModel';
import { useToday } from './useToday';

type Props = {
  store: DataStore;
  initial: Snapshot;
  mode?: 'local' | 'cloud';
  email?: string;
  onLogout?: () => void;
  onLogin?: () => void;
  authBusy?: boolean;
  loginError?: string;
};
export function App({ store, initial, mode = 'cloud', email, onLogout, onLogin, authBusy = false, loginError = '' }: Props) {
  const [screen, setScreen] = useState<'inventory' | 'shopping'>('inventory');
  const today = useToday();
  const { data, saving, blocked, notice, setNotice, formError, setFormError, editor, setEditor, refresh, openForm, saveTemplates, saveFood, addStock, changeStatus, removeFood, changeLowStock, addToShopping, changeBought, removeShopping } = useAppModel(store, initial, mode);

  return <div className="page min-h-dvh">
    <header className="topbar h-[68px] border-b border-border bg-white mobile:h-[62px]"><div className="topbar-inner mx-auto flex h-full max-w-[1040px] items-center justify-between gap-4 px-8 mobile:px-[18px]">
      <Brand />
      <ScreenNavigation className="desktop-navigation mobile:hidden" screen={screen} onChange={setScreen} />
      <div className="header-actions flex items-center gap-1">
        <Button variant="plain" className={`header-action flex min-h-11 items-center gap-[7px] rounded-lg border-0 bg-transparent p-2 text-[13px]
          font-[650] text-muted hover:bg-[#edf3f1] [&_.icon]:size-[18px] [&_.icon]:opacity-70 tiny:text-xs`} type="button" disabled={blocked || saving} aria-label="定番食品を管理"
          onClick={() => { setFormError(''); setEditor({ templatesOnly: true }); }}><Icon name="bookmark" />定番食品</Button>
        <AccountMenu email={email} busy={saving || authBusy} onRefresh={refresh} onLogout={onLogout} onLogin={onLogin} />
      </div>
    </div></header>
    <main className="main mx-auto max-w-[1040px] px-8 pt-8 pb-10 mobile:px-4 mobile:pt-6 mobile:pb-[110px]">
      {loginError && <p role="alert" className="notice notice-error mb-5 rounded-[10px] bg-[#fff0ec] p-3 text-[13px] text-[#8e372b]">{loginError}</p>}
      {saving && <p className="cloud-pending mb-4 text-[13px] text-muted" role="status" aria-label="保存状態">保存・読み込み中…</p>}
      {notice && <div className={cn('notice mb-5 flex items-center justify-between gap-3 rounded-[10px] bg-panel py-2.5 pr-3 pl-4 text-[13px] text-[#265944] wrap-anywhere', blocked && 'notice-error bg-[#fff0ec] text-[#8e372b]')} role="status">
        <span>{notice}</span>
        {blocked ? <Button variant="ghost" className="min-h-11 text-inherit" type="button" disabled={saving} onClick={refresh}>{mode === 'local' ? '端末のデータを再取得' : 'クラウドを再取得'}</Button> :
          <Button variant="ghost" size="icon" className="icon-button border-0 bg-transparent text-inherit" type="button" aria-label="通知を閉じる" onClick={() => setNotice('')}><Icon name="x" /></Button>}
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
    <div className={`mobile-create-bar mobile-navigation fixed inset-x-0 bottom-0 z-4 hidden items-center justify-between gap-2
          border-t border-border bg-[#fffffff2] px-3 pt-2 pb-[calc(8px+env(safe-area-inset-bottom))] mobile:flex
          [&>.primary]:min-h-11 [&>.primary]:px-2.5 [&>.primary]:py-2 [&>.primary]:text-xs`}>
      <ScreenNavigation screen={screen} onChange={setScreen} />
      {screen === 'inventory' ? <Button variant="default" className="primary" disabled={blocked || saving} onClick={() => openForm()} type="button"><Icon name="plus" />食品を登録</Button> :
        <Button variant="default" className="primary" disabled={blocked} type="button" onClick={() => document.getElementById('shopping-name')?.focus()}><Icon name="plus" />買うものを追加</Button>}
    </div>
    {editor && <FoodEditor item={editor.item} purchase={editor.purchase} templatesOnly={editor.templatesOnly} items={data.items}
      templates={data.templates} blocked={blocked || saving} canRefresh={blocked && !saving} onRefresh={refresh} formError={formError} setFormError={setFormError} onClose={() => setEditor(null)}
      onSave={saveFood} onSaveTemplates={saveTemplates} />}
  </div>;
}
