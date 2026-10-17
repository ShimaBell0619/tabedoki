import type { AppData } from '../domain/app-data.ts';
import { validateFoodIconSelections } from '../domain/food-icons.ts';
import { MAX_ITEMS, isFood, isV4Food, isV3Food, isLegacyFood, inferConsumption, type Food, type FoodTemplate, type LegacyFood } from '../domain/food.ts';
import { defaultTemplates, validateTemplates } from '../domain/templates.ts';
import { validateShopping, type ShoppingItem } from '../domain/shopping.ts';

export const LEGACY_STORAGE_KEY = 'tabedoki:foods:v1';
export const V2_STORAGE_KEY = 'tabedoki:foods:v2';
// Separate generation keys prevent stale older tabs from overwriting v5 data.
export const V3_STORAGE_KEY = 'tabedoki:data:v3';
export const V4_STORAGE_KEY = 'tabedoki:data:v4';
export const STORAGE_KEY = 'tabedoki:data:v5';
export const RECOVERY_KEY = 'tabedoki:recovery:previous';
export const BACKUP_MAX_BYTES = 5 * 1024 * 1024;
export type BackupData = { items: Food[]; templates?: FoodTemplate[]; shopping?: ShoppingItem[]; icons?: AppData['icons'] };
type DataStorage = Pick<Storage, 'getItem' | 'setItem'>;
export type ReadDataResult = AppData & { error: string; canExport: boolean; raw: string | null };
export const READ_ERROR = '保存済みデータを読み込めません。原文を退避し、バックアップから復元するか再読み込みしてください。';
export const SAVE_ERROR = '保存できませんでした。ブラウザの空き容量や設定を確認してください。変更は保存されていません。';

export function validateBackup(value: unknown): BackupData {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) throw new Error('バックアップ形式が正しくありません。');
  const backup = value as Record<string, unknown>;
  if (![1, 2, 3, 4, 5].includes(backup.version as number) || !Array.isArray(backup.items)) throw new Error('対応していないバックアップ形式です。');
  if (backup.items.length > MAX_ITEMS) throw new Error('食品が多すぎます（最大3,000件）。');
  const validator = backup.version === 1 ? isLegacyFood : backup.version === 5 ? isFood : backup.version === 4 ? isV4Food : isV3Food;
  if (!backup.items.every(validator)) throw new Error('食品データに不正な項目があります。');
  const ids = new Set(backup.items.map((item: LegacyFood) => item.id));
  if (ids.size !== backup.items.length) throw new Error('重複する食品IDがあります。');
  const items = (backup.items as Food[]).map(item => ({
    id: item.id, name: item.name, kind: item.kind, deadline: item.deadline,
    quantity: item.quantity, place: item.place, status: item.status,
    category: backup.version === 1 ? 'other' as const : item.category,
    unit: backup.version === 1 ? 'item' as const : item.unit,
    lowStock: (backup.version === 4 || backup.version === 5) ? item.lowStock : false,
    initialQuantity: backup.version === 5 ? item.initialQuantity : item.quantity,
    consumption: backup.version === 5 ? item.consumption : inferConsumption(item.name, backup.version === 1 ? 'other' : item.category),
  }));
  if (backup.version === 4 || backup.version === 5) {
    const icons = validateFoodIconSelections(backup.icons);
    const upgrade = (value: unknown): unknown => backup.version === 5 ? value :
      (Array.isArray(value) ? value.map(item => ({ ...item, consumption: inferConsumption(item.name, item.category) })) : value);
    return { items, templates: validateTemplates(upgrade(backup.templates)), shopping: validateShopping(upgrade(backup.shopping)), ...(icons === undefined ? {} : { icons }) };
  }
  return backup.version === 3 ? { items, templates: validateTemplates(Array.isArray(backup.templates) ? backup.templates.map(item => ({ ...item, consumption: inferConsumption(item.name, item.category) })) : backup.templates) } : { items };
}

export function validateData(data: AppData): AppData {
  const valid = validateBackup({ ...data, version: 5 });
  return { items: valid.items, templates: valid.templates!, shopping: valid.shopping!, ...(valid.icons === undefined ? {} : { icons: valid.icons }) };
}

export function makeBackup(data: AppData): string {
  return JSON.stringify({ version: 5, exportedAt: new Date().toISOString(), ...validateData(data) }, null, 2);
}

export function writeData(storage: Pick<Storage, 'setItem'>, data: AppData): AppData {
  const saved = validateData(data);
  storage.setItem(STORAGE_KEY, JSON.stringify({ version: 5, ...saved }));
  return saved;
}

/** Replaces only fields present in that backup version. Empty arrays stay empty. */
export function applyBackup(current: AppData, backup: BackupData): AppData {
  return validateData({ items: backup.items, templates: backup.templates ?? current.templates, shopping: backup.shopping ?? current.shopping, ...(backup.icons !== undefined ? { icons: backup.icons } : current.icons !== undefined ? { icons: current.icons } : {}) });
}

export function decodeStored(raw: string, expected?: 1 | 2 | 3 | 4 | 5): AppData {
  const value: unknown = JSON.parse(raw);
  if (typeof value !== 'object' || value === null || (expected !== undefined && (value as Record<string, unknown>).version !== expected)) {
    throw new Error('対応していない保存形式です。');
  }
  const valid = validateBackup(value);
  return { items: valid.items, templates: valid.templates ?? defaultTemplates(), shopping: valid.shopping ?? [], ...(valid.icons === undefined ? {} : { icons: valid.icons }) };
}

/** Preserve one exact source generation before migration/replacement, never normal edits. */
export function replaceData(storage: DataStorage, data: AppData): AppData {
  const valid = validateData(data);
  const current = storage.getItem(STORAGE_KEY);
  const raw = current ?? storage.getItem(V4_STORAGE_KEY) ?? storage.getItem(V3_STORAGE_KEY) ?? storage.getItem(V2_STORAGE_KEY) ?? storage.getItem(LEGACY_STORAGE_KEY);
  // Even a first replacement protects the current empty/starter state.
  storage.setItem(RECOVERY_KEY, raw ?? JSON.stringify({ version: 5, items: [], templates: defaultTemplates(), shopping: [] }));
  return writeData(storage, valid);
}

export function previousData(storage: Pick<Storage, 'getItem'>): AppData {
  return decodeStored(previousRaw(storage));
}

export function previousRaw(storage: Pick<Storage, 'getItem'>): string {
  const raw = storage.getItem(RECOVERY_KEY);
  if (raw === null) throw new Error('直前の置換前データはありません。');
  return raw;
}

export function readData(storage: DataStorage): ReadDataResult {
  let raw: string | null = null;
  try {
    const canonical = storage.getItem(STORAGE_KEY);
    raw = canonical;
    let version: 1 | 2 | 3 | 4 | 5;
    if (canonical !== null) {
      const value = JSON.parse(canonical);
      if (value?.version !== 5) throw new Error('未知の正本形式です。');
      version = 5;
    } else {
      raw = storage.getItem(V4_STORAGE_KEY);
      version = 4;
      if (raw === null) { raw = storage.getItem(V3_STORAGE_KEY); version = 3; }
      if (raw === null) { raw = storage.getItem(V2_STORAGE_KEY); version = 2; }
      if (raw === null) { raw = storage.getItem(LEGACY_STORAGE_KEY); version = 1; }
    }
    if (raw === null) return { items: [], templates: defaultTemplates(), shopping: [], error: '', canExport: true, raw: null };
    const data = decodeStored(raw, version);
    if (version === 5) return { ...data, error: '', canExport: true, raw: null };
    try {
      storage.setItem(RECOVERY_KEY, raw);
      writeData(storage, data);
    } catch {
      return { ...data, error: '移行を保存できませんでした。元のデータを保持しています。JSONを退避して再読み込みしてください。現在は変更できません。', canExport: true, raw };
    }
    try {
      const saved = storage.getItem(STORAGE_KEY);
      if (saved === null || JSON.stringify(decodeStored(saved, 5)) !== JSON.stringify(data)) throw new Error('移行結果が一致しません。');
    } catch {
      return { ...data, error: '保存結果を確認できません。退避を保持しています。再読み込みまで現在は変更できません。', canExport: true, raw };
    }
    return { ...data, error: '', canExport: true, raw: null };
  } catch {
    return { items: [], templates: [], shopping: [], error: READ_ERROR + (raw === null ? '原文も取得できません。' : ''), canExport: false, raw };
  }
}
