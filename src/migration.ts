import { decodeStored, STORAGE_KEY, V3_STORAGE_KEY, V2_STORAGE_KEY, LEGACY_STORAGE_KEY, type AppData } from './storage.ts';
type Store = Pick<Storage, 'getItem' | 'setItem'>;
export type LocalSource = { raw: string; data: AppData | null; error: string };
/** Read without upgrading or touching any legacy key, even for v1-v3. */
export function localSource(storage: Pick<Storage, 'getItem'>): LocalSource | null {
  for (const [key, version] of [[STORAGE_KEY, 4], [V3_STORAGE_KEY, 3], [V2_STORAGE_KEY, 2], [LEGACY_STORAGE_KEY, 1]] as const) {
    const raw = storage.getItem(key);
    if (raw !== null) {
      try { return { raw, data: decodeStored(raw, version), error: '' }; }
      catch { return { raw, data: null, error: 'このブラウザの旧データを読み込めません。原文を退避してください。' }; }
    }
  }
  return null;
}
export function migrationKey(project: string): string { return `tabedoki:migration:v1:${project}`; }
export function migrationOwner(storage: Pick<Storage, 'getItem'>, project: string): string | null {
  const raw = storage.getItem(migrationKey(project));
  if (raw === null) return null;
  const claim = JSON.parse(raw);
  if (typeof claim.userId !== 'string' || typeof claim.raw !== 'string') throw new Error('移行記録を確認できません。');
  return claim.userId;
}
/** Bind BEFORE uploading, so failed/ambiguous writes cannot be retried into account B. */
export function claimMigration(storage: Store, project: string, userId: string, source: LocalSource): void {
  const owner = migrationOwner(storage, project);
  if (owner && owner !== userId) throw new Error('旧データは別のアカウントに紐付いています。');
  if (owner) return;
  const claim = JSON.stringify({ userId, raw: source.raw });
  storage.setItem(migrationKey(project), claim);
  if (storage.getItem(migrationKey(project)) !== claim) throw new Error('移行前の退避を確認できません。');
}
