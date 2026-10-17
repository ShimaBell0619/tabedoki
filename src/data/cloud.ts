import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from './database.types.ts';
import { validateData, decodeStored } from './storage.ts';
import type { AppData } from '../domain/app-data.ts';

export type CloudRow = { user_id: string; data: unknown; revision: number; write_id: string; previous: unknown | null };
export type Snapshot = { data: AppData; revision: number; previous: AppData | null; writeId: string };
export class CloudError extends Error {
  kind: 'conflict' | 'unavailable' | 'invalid' | 'busy';
  constructor(kind: CloudError['kind'], message: string) { super(message); this.kind = kind; }
}
export const CLOUD_SAVE_ERROR = '保存結果を確認できません。入力を残しています。クラウドを再取得して確認してください。';
export function decodeRow(row: CloudRow, userId: string): Snapshot {
  if (row.user_id !== userId || !Number.isSafeInteger(row.revision) || row.revision < 1) throw new CloudError('invalid', 'クラウドデータを確認できません。');
  const payload = row.data as Record<string, unknown> | null;
  if (!payload || (payload.version !== 4 && payload.version !== 5)) throw new CloudError('invalid', '対応していないクラウド形式です。');
  return { data: decodeStored(JSON.stringify(payload)), revision: row.revision, previous: row.previous === null ? null : decodeStored(JSON.stringify(row.previous)), writeId: row.write_id };
}

/** One account, one serialized writer. RLS is the server-side authorization boundary. */
export class CloudStore {
  snapshot: Snapshot | null = null;
  busy = false;
  private client: SupabaseClient<Database>;
  readonly userId: string;
  constructor(client: SupabaseClient<Database>, userId: string) { this.client = client; this.userId = userId; }
  async load(): Promise<Snapshot | null> {
    const { data, error } = await this.client.from('user_data').select('user_id,data,revision,write_id,previous').eq('user_id', this.userId).retry(false).maybeSingle();
    if (error) throw new CloudError('unavailable', 'クラウドを読み込めません。接続を確認して再取得してください。');
    this.snapshot = data ? decodeRow(data, this.userId) : null;
    return this.snapshot;
  }
  async save(next: AppData, replacement = false): Promise<Snapshot> {
    if (this.busy) throw new CloudError('busy', '保存中です。');
    const valid = validateData(next);
    this.busy = true;
    const base = this.snapshot;
    const writeId = crypto.randomUUID();
    const payload = { data: { version: 5, ...valid }, write_id: writeId };
    try {
      const query = base
        ? this.client.from('user_data').update({ ...payload, ...(replacement ? { previous: { version: 5, ...base.data } } : {}) }).eq('user_id', this.userId).eq('revision', base.revision)
        : this.client.from('user_data').insert({ ...payload, user_id: this.userId });
      const { data, error } = await query.select('user_id,data,revision,write_id,previous').retry(false).maybeSingle();
      if (!error && !data) throw new CloudError('conflict', '別の端末で更新されています。入力を残しています。クラウドを再取得してください。');
      if (error) {
        // A dropped response can follow a committed transaction. Never retry a write blindly.
        const observed = await this.load();
        if (observed?.writeId === writeId && JSON.stringify(observed.data) === JSON.stringify(valid)) return observed;
        if (error.code === '23505' || observed?.revision !== base?.revision) throw new CloudError('conflict', '別の端末で更新されています。クラウドを再取得してください。');
        throw new CloudError('unavailable', CLOUD_SAVE_ERROR);
      }
      if (!data) throw new CloudError('invalid', CLOUD_SAVE_ERROR);
      const saved = decodeRow(data, this.userId);
      if (saved.writeId !== writeId || JSON.stringify(saved.data) !== JSON.stringify(valid) || saved.revision !== (base?.revision ?? 0) + 1) throw new CloudError('invalid', CLOUD_SAVE_ERROR);
      this.snapshot = saved;
      return saved;
    } catch (error) {
      if (error instanceof CloudError) throw error;
      throw new CloudError('unavailable', CLOUD_SAVE_ERROR);
    } finally { this.busy = false; }
  }
}

/** A persistence backend for the shared application model. */
export type DataStore = Pick<CloudStore, 'load' | 'save'>;
