import { Brand } from '../components/Brand';
import { ScreenNavigation, type Screen } from './ScreenNavigation';
import { DeadlineCalendar } from '../features/inventory/DeadlineCalendar';
import { FoodIconPicker } from '../features/inventory/FoodIconPicker';
import { selectedFoodIcon } from '../domain/food-icons';
import type { FoodCategory } from '../domain/food';
import { AppNotice } from './AppNotice';
import { Button } from '@/components/ui/button';
import { useState } from 'react';
import type { DataStore, Snapshot } from '../data/cloud';
import { InventoryPage } from '../features/inventory/InventoryPage';
import { FoodEditor } from '../features/inventory/FoodEditor';
import { ShoppingPage } from '../features/shopping/ShoppingPage';
import { AccountMenu } from '../features/auth/AccountMenu';
import { Icon } from '../components/Icon';
import { normalizedName } from '../domain/food';

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
  const [screen, setScreen] = useState<Screen>('inventory');
  const [iconTarget, setIconTarget] = useState<{ name: string; category: FoodCategory } | null>(null);
  const today = useToday();
  const { data, saving, showSaving, blocked, notice, dismissNotice, formError, setFormError, editor, setEditor, refresh, openForm, saveTemplates, saveFood, addStock, changeStatus, changeQuantity, changeVolume, removeFood, changeLowStock, addToShopping, changeBought, removeShopping, changeFoodIcon } = useAppModel(store, initial, mode);

  return <div className="page min-h-dvh" data-saving={saving ? "true" : undefined}>
    <header className="topbar h-[68px] border-b border-border bg-white mobile:h-[62px]"><div className="topbar-inner mx-auto flex h-full max-w-[1040px] items-center justify-between gap-4 px-8 mobile:px-[18px]">
      <Brand />
      <ScreenNavigation className="desktop-navigation mobile:hidden" screen={screen} onChange={setScreen} />
      <div className="header-actions flex items-center gap-1">
        <AccountMenu email={email} busy={saving || authBusy} onRefresh={refresh} onLogout={onLogout} onLogin={onLogin}
          onTemplates={() => { setFormError(''); setEditor({ templatesOnly: true }); }} />
      </div>
    </div></header>
    <main className="main mx-auto max-w-[1040px] px-8 pt-8 pb-10 mobile:px-4 mobile:pt-6 mobile:pb-[calc(110px+env(safe-area-inset-bottom))]">
      {loginError && <p role="alert" className="notice notice-error mb-5 rounded-[10px] bg-[#fff0ec] p-3 text-[13px] text-[#8e372b]">{loginError}</p>}
      {showSaving && <p className="cloud-pending mb-4 text-[13px] text-muted" role="status" aria-label="保存状態">保存・読み込み中…</p>}
      {notice && <AppNotice key={notice.id} id={notice.id} message={notice.message} error={notice.error || blocked}
        blocked={blocked} saving={saving} refreshLabel={mode === 'local' ? '端末のデータを再取得' : 'クラウドを再取得'}
        onRefresh={refresh} onDismiss={dismissNotice} />}
      <>
      <div hidden={screen !== 'inventory'}>
        <InventoryPage items={data.items} today={today} blocked={blocked || saving} onCreate={() => openForm()}
          onEdit={openForm} onStatus={changeStatus} onRemove={removeFood} shopping={data.shopping}
          onLowStock={changeLowStock} onVolume={changeVolume} onAddShopping={addToShopping} onAddStock={addStock} onQuantity={changeQuantity}
          iconSelections={data.icons} onPickIcon={(name, category) => setIconTarget({ name, category })} />
      </div>
      <div hidden={screen !== 'calendar'}>
        <DeadlineCalendar items={data.items.filter(item => item.status === 'active')} today={today}
          listed={new Set(data.shopping.filter(item => !item.bought).map(item => normalizedName(item.name)))}
          blocked={blocked || saving} onEdit={openForm} onStatus={changeStatus} onRemove={removeFood}
          onLowStock={changeLowStock} onVolume={changeVolume} onQuantity={changeQuantity} onAddShopping={addToShopping} onAddStock={addStock}
          onShowList={() => setScreen('inventory')}
          iconSelections={data.icons} onPickIcon={(name, category) => setIconTarget({ name, category })} />
      </div>
      <div hidden={screen !== 'shopping'}>
        <ShoppingPage items={data.shopping} foods={data.items} templates={data.templates} blocked={blocked || saving}
          onAdd={addToShopping} onBought={changeBought} onRemove={removeShopping} onRegister={item => openForm(undefined, item)} />
      </div>
      </>
    </main>
    {/* The same lightweight, translucent glass remains visible whether scrolling or idle. */}
    <div className="mobile-navigation-glass" aria-hidden="true" />
    <ScreenNavigation className="mobile-navigation" screen={screen} onChange={setScreen} />
    {(screen === 'inventory' || screen === 'calendar') && <>
      <div className="mobile-add-glass" aria-hidden="true" />
      <Button variant="default" className="mobile-add-button"
        type="button" disabled={blocked || saving} aria-label="食品を登録" onClick={() => openForm()}>
        <Icon name="plus" />
      </Button>
    </>}
    {iconTarget && <FoodIconPicker foodName={iconTarget.name} category={iconTarget.category}
      selected={selectedFoodIcon(data.icons, iconTarget.name)} blocked={blocked || saving} error={blocked ? notice?.message : undefined}
      onSelect={async icon => { if (await changeFoodIcon(iconTarget.name, icon)) setIconTarget(null); }}
      onClose={() => setIconTarget(null)} />}
    {editor && <FoodEditor item={editor.item} purchase={editor.purchase} templatesOnly={editor.templatesOnly} items={data.items}
      templates={data.templates} blocked={blocked || saving} canRefresh={blocked && !saving} onRefresh={refresh} formError={formError} setFormError={setFormError} onClose={() => setEditor(null)}
      onSave={saveFood} onSaveTemplates={saveTemplates} />}
  </div>;
}
