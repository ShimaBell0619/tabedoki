import { MAX_ITEMS, defaultTemplates, isFood, isLegacyFood, validateTemplates, type Food, type FoodTemplate, type LegacyFood } from './food.ts';

export type FoodData = { items: Food[]; templates: FoodTemplate[] };
export const LEGACY_STORAGE_KEY = 'tabedoki:foods:v1';
export const V2_STORAGE_KEY = 'tabedoki:foods:v2';
export const STORAGE_KEY = 'tabedoki:data:v3';
export const BACKUP_MAX_BYTES = 5 * 1024 * 1024;

export function validateBackup(value: unknown): { items: Food[]; templates?: FoodTemplate[] } {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) throw new Error('バックアップ形式が正しくありません。');
  const backup = value as Record<string, unknown>;
  if ((backup.version !== 1 && backup.version !== 2 && backup.version !== 3) || !Array.isArray(backup.items)) throw new Error('対応していないバックアップ形式です。');
  if (backup.items.length > MAX_ITEMS) throw new Error('食品が多すぎます（最大3,000件）。');
  if (!backup.items.every(backup.version === 1 ? isLegacyFood : isFood)) throw new Error('食品データに不正な項目があります。');
  const ids = new Set(backup.items.map((item: LegacyFood) => item.id));
  if (ids.size !== backup.items.length) throw new Error('重複する食品IDがあります。');
  // Project known fields only; untrusted extra fields never enter persisted data.
  const items = (backup.items as Food[]).map(item => ({
    id: item.id, name: item.name, kind: item.kind, deadline: item.deadline,
    quantity: item.quantity, place: item.place, status: item.status,
    category: backup.version === 1 ? 'other' as const : item.category,
    unit: backup.version === 1 ? 'item' as const : item.unit,
  }));
  return backup.version === 3 ? { items, templates: validateTemplates(backup.templates) } : { items };
}

export function makeBackup(data: FoodData): string {
  const valid = validateBackup({ version: 3, ...data });
  return JSON.stringify({ version: 3, exportedAt: new Date().toISOString(), ...valid }, null, 2);
}

type FoodStorage = Pick<Storage, 'getItem' | 'setItem'>;
export type ReadDataResult = FoodData & { error: string; canExport: boolean };
export const READ_ERROR = '保存済みデータを読み込めません。バックアップから復元するか、確認のうえ空の状態から始めてください。';
export const SAVE_ERROR = '保存できませんでした。ブラウザの空き容量や設定を確認してください。変更は保存されていません。';

export function writeData(storage: Pick<Storage, 'setItem'>, data: FoodData): FoodData {
  const valid = validateBackup({ version: 3, ...data });
  const saved = { items: valid.items, templates: valid.templates! };
  storage.setItem(STORAGE_KEY, JSON.stringify({ version: 3, ...saved }));
  return saved;
}

function readStored(value: string, version: 1 | 2 | 3): FoodData {
  const data: unknown = JSON.parse(value);
  if (typeof data !== 'object' || data === null || (data as Record<string, unknown>).version !== version) {
    throw new Error('対応していない保存形式です。');
  }
  const valid = validateBackup(data);
  return { items: valid.items, templates: valid.templates ?? defaultTemplates() };
}

export function readData(storage: FoodStorage): ReadDataResult {
  try {
    const value = storage.getItem(STORAGE_KEY);
    if (value !== null) return { ...readStored(value, 3), error: '', canExport: true };
    const v2 = storage.getItem(V2_STORAGE_KEY);
    const legacy = v2 === null ? storage.getItem(LEGACY_STORAGE_KEY) : null;
    if (v2 === null && legacy === null) return { items: [], templates: defaultTemplates(), error: '', canExport: true };
    const data = readStored(v2 ?? legacy!, v2 !== null ? 2 : 1);
    try {
      writeData(storage, data);
      const saved = storage.getItem(STORAGE_KEY);
      if (saved === null || JSON.stringify(readStored(saved, 3)) !== JSON.stringify(data)) throw new Error('移行結果が一致しません。');
    } catch {
      return { ...data, error: '新しい形式で保存できませんでした。元のデータは保持されています。JSONを保存し、空き容量や設定を確認して再読み込みしてください。現在は変更できません。', canExport: true };
    }
    return { ...data, error: '', canExport: true };
  } catch {
    return { items: [], templates: [], error: READ_ERROR, canExport: false };
  }
}
