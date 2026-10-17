import { useCallback, useRef, useState } from 'react';
import { MAX_ITEMS, isFood, normalizedName, tracksVolume, defaultVolumeTracking, adjustVolume, type Food, type FoodForm, type FoodStatus, type FoodTemplate, type StoragePlace } from '../domain/food';
import { addStockToFoods } from '../domain/stock';
import { selectedFoodIcon, type FoodIconName } from '../domain/food-icons';
import type { AppData } from '../domain/app-data.ts';
import type { DataStore, Snapshot } from '../data/cloud';
import { addShopping, registerPurchase, setBought, shoppingFrom, type ShoppingItem } from '../domain/shopping';
import { useCloudData } from './useCloudData';

export function useAppModel(store: DataStore, initial: Snapshot, mode: 'local' | 'cloud') {
  const [editor, setEditor] = useState<{ item?: Food; purchase?: ShoppingItem; templatesOnly: boolean } | null>(null);
  const foodSaved = useRef(false);
  const noticeSequence = useRef(0);
  const [notice, updateNotice] = useState<{ id: number; message: string; error: boolean } | null>(null);
  const [formError, setFormError] = useState('');
  function setNotice(message: string, error = false) {
    updateNotice({ id: ++noticeSequence.current, message, error });
  }
  const dismissNotice = useCallback((id: number) => {
    updateNotice(current => current?.id === id ? null : current);
  }, []);
  function showError(message: string) {
    setNotice(message, true);
    if (editor) setFormError(message);
  }
  const { data, committed, saving, blocked, commitData, refresh } = useCloudData(store, initial, showError, () => {
    setFormError('');
    setNotice(mode === 'local' ? '端末のデータを再取得しました。' : 'クラウドを再取得しました。入力中の内容は残っています。');
  });
  function openForm(item?: Food, purchase?: ShoppingItem) {
    foodSaved.current = false;
    setFormError(''); setEditor({ item, purchase, templatesOnly: false });
  }
  async function saveTemplates(templates: FoodTemplate[]): Promise<boolean> {
    if (!await commitData({ ...committed.current, templates })) return false;
    setNotice('定番食品を保存しました。'); setFormError('');
    return true;
  }
  async function saveFood(form: FoodForm): Promise<boolean> {
    if (foodSaved.current) return false;
    const current = committed.current;
    const editingId = editor?.item?.id;
    if (!editingId && current.items.length >= MAX_ITEMS) { showError('食品は最大3,000件まで登録できます。'); return false; }
    const original = editingId ? current.items.find(item => item.id === editingId) : undefined;
    if (editingId && !original) { showError('編集する食品が見つかりません。'); return false; }
    const initialQuantity = form.initialQuantity ?? (original ? Math.max(original.initialQuantity, form.quantity) : form.quantity);
    if (!Number.isInteger(initialQuantity) || initialQuantity < form.quantity || initialQuantity > 999) {
      showError('バーの満量は現在の数量以上、999以下の整数で指定してください。');
      return false;
    }
    const trackingMode = form.trackingMode ?? (defaultVolumeTracking(form.name, form.unit) ? 'volume' : 'count');
    const food: Food = {
      ...form, name: form.name.trim(), id: original?.id ?? crypto.randomUUID(), trackingMode,
      ...(trackingMode === 'volume' ? { volumePercent: original && tracksVolume(original) ? original.volumePercent ?? 100 : 100 as const } : {}),
      status: original?.status ?? 'active', lowStock: original?.lowStock ?? false,
      initialQuantity,
    };
    if (!isFood(food)) { showError('食品名、期限の日付、数量と選択項目を確認してください。'); return false; }
    let next: AppData;
    try {
      next = editor?.purchase ? registerPurchase(current, editor.purchase.id, food) : {
        ...current, items: editingId ? current.items.map(item => item.id === editingId ? food : item) : [...current.items, food],
      };
    } catch (error) { showError(error instanceof Error ? error.message : '登録できません。'); return false; }
    if (!await commitData(next)) return false;
    foodSaved.current = true;
    setNotice(editingId ? '食品を更新しました。' : '食品を登録しました。');
    return true;
  }
  async function addStock(base: Food, deadline: string, quantity: number, place: StoragePlace): Promise<boolean> {
    const current = committed.current;
    const source = current.items.find(item => item.id === base.id);
    if (!source) { showError('元の食品が見つかりません。保存データを再取得してください。'); return false; }
    let items: Food[];
    try {
      items = addStockToFoods(current.items, source, { deadline, quantity, place }, crypto.randomUUID());
    } catch (error) { showError(error instanceof Error ? error.message : '在庫を追加できません。'); return false; }
    if (!await commitData({ ...current, items })) return false;
    setNotice('「' + source.name + '」の在庫を追加しました。');
    return true;
  }
  async function changeStatus(item: Food, status: FoodStatus) {
    const current = committed.current;
    if (!await commitData({ ...current, items: current.items.map(value => value.id === item.id ? { ...value, status } : value) })) return;
    const label = status === 'used' ? '完了' : status === 'discarded' ? '廃棄' : '管理中に戻す';
    setNotice(`「${item.name}」を${label}にしました。`);
  }
  async function changeQuantity(item: Food, delta: -1 | 1) {
    const current = committed.current;
    const original = current.items.find(value => value.id === item.id);
    if (!original || original.status !== 'active') {
      showError('変更する在庫が見つかりません。再取得してください。'); return;
    }
    const quantity = original.quantity + delta;
    if (quantity < 0 || quantity > 999) return;
    const items = current.items.map(value => value.id === item.id
      ? quantity === 0 ? { ...value, status: 'used' as const } :
        { ...value, quantity, initialQuantity: Math.max(value.initialQuantity, quantity),
          ...(delta === -1 && tracksVolume(value) ? { volumePercent: 100 as const } : {}) }
      : value);
    if (!await commitData({ ...current, items })) return;
    setNotice(quantity === 0 ? `「${item.name}」の在庫がなくなりました。` :
      `「${item.name}」の数量を${quantity}に変更しました。`);
  }
  async function changeVolume(item: Food, delta: -10 | 10) {
    const current = committed.current;
    const original = current.items.find(value => value.id === item.id);
    if (!original || original.status !== 'active') {
      showError('変更する在庫が見つかりません。再取得してください。'); return;
    }
    let replacement: Food;
    try { replacement = adjustVolume(original, delta); }
    catch (error) { showError(error instanceof Error ? error.message : '残量を変更できません。'); return; }
    if (!isFood(replacement)) { showError('残量が正しくありません。'); return; }
    if (!await commitData({ ...current, items: current.items.map(value => value.id === original.id ? replacement : value) })) return;
    setNotice(replacement.status === 'used'
      ? `「${item.name}」の在庫がなくなりました。`
      : replacement.quantity < original.quantity
        ? `「${item.name}」を1${({ item: '点', piece: '個', pack: 'パック', bag: '袋', bottle: '本' } as const)[item.unit]}使い切りました。`
        : `「${item.name}」の残量を${replacement.volumePercent}%に変更しました。`);
  }

  async function removeFood(item: Food) {
    if (!window.confirm(`「${item.name}」を完全に削除しますか？\nこの操作は取り消せません。`)) return;
    const current = committed.current;
    if (!await commitData({ ...current, items: current.items.filter(value => value.id !== item.id) })) return;
    setNotice('食品を削除しました。');
  }
  async function changeLowStock(item: Food, lowStock: boolean) {
    const current = committed.current;
    if (!await commitData({ ...current, items: current.items.map(value => value.id === item.id ? { ...value, lowStock } : value) })) return;
    setNotice(`「${item.name}」の残りわずかを${lowStock ? '設定' : '解除'}しました。`);
  }
  async function addToShopping(source: string | Food | FoodTemplate): Promise<boolean> {
    const current = committed.current;
    const name = typeof source === 'string' ? source : source.name;
    if (current.shopping.some(item => !item.bought && normalizedName(item.name) === normalizedName(name))) {
      setNotice(`「${name.trim()}」は買い物に追加済みです。`);
      return true;
    }
    try {
      const shopping = addShopping(current.shopping, shoppingFrom(source, crypto.randomUUID()));
      if (!await commitData({ ...current, shopping })) return false;
    } catch (error) { showError(error instanceof Error ? error.message : '追加できません。'); return false; }
    setNotice(`「${name.trim()}」を買い物に追加しました。`);
    return true;
  }
  async function changeBought(item: ShoppingItem, bought: boolean) {
    const current = committed.current;
    try {
      if (!await commitData({ ...current, shopping: setBought(current.shopping, item.id, bought) })) return;
      setNotice(`「${item.name}」を${bought ? '購入済み' : '未購入'}にしました。`);
    } catch (error) { showError(error instanceof Error ? error.message + '両方の項目を保持しました。未購入項目を削除してから解除できます。' : '変更できません。'); }
  }
  async function changeFoodIcon(name: string, icon: FoodIconName | null): Promise<boolean> {
    const current = committed.current;
    const key = normalizedName(name);
    if (selectedFoodIcon(current.icons, name) === (icon ?? undefined)) return true;
    const icons = { ...(current.icons ?? {}) };
    if (icon === null) delete icons[key];
    else icons[key] = icon;
    if (!await commitData({ ...current, icons })) return false;
    setNotice(icon === null ? `「${name}」のアイコンを自動設定に戻しました。` : `「${name}」のアイコンを変更しました。`);
    return true;
  }
  async function removeShopping(item: ShoppingItem) {
    if (!window.confirm(`買い物「${item.name}」を削除しますか？`)) return;
    const current = committed.current;
    if (await commitData({ ...current, shopping: current.shopping.filter(value => value.id !== item.id) })) setNotice('買い物項目を削除しました。');
  }

  return { data, saving, blocked, notice, dismissNotice, formError, setFormError, editor, setEditor, refresh, openForm, saveTemplates, saveFood, addStock, changeStatus, changeQuantity, changeVolume, removeFood, changeLowStock, addToShopping, changeBought, removeShopping, changeFoodIcon };
}
