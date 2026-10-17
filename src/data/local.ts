import type { AppData } from '../domain/app-data.ts';
import type { DataStore, Snapshot } from './cloud.ts';
import { STORAGE_KEY, SAVE_ERROR, decodeStored, readData, writeData } from './storage.ts';

/** The guest backend writes only to this browser; cloud data is never copied here. */
export class LocalStore implements DataStore {
  private raw: string | null = null;
  private snapshot: Snapshot | null = null;
  private readonly storage: Pick<Storage, 'getItem' | 'setItem'>;
  constructor(storage: Pick<Storage, 'getItem' | 'setItem'>) { this.storage = storage; }

  async load(): Promise<Snapshot> {
    const result = readData(this.storage);
    if (result.error) throw new Error(result.error);
    const raw = this.storage.getItem(STORAGE_KEY);
    const snapshot: Snapshot = {
      data: { items: result.items, templates: result.templates, shopping: result.shopping,
        ...(result.icons === undefined ? {} : { icons: result.icons }) },
      revision: (this.snapshot?.revision ?? 0) + 1,
      previous: null,
      writeId: '',
    };
    this.raw = raw;
    this.snapshot = snapshot;
    return snapshot;
  }

  async save(next: AppData): Promise<Snapshot> {
    if (!this.snapshot) throw new Error('保存データを先に読み込んでください。');
    // A stale tab must not overwrite another tab's committed data.
    if (this.storage.getItem(STORAGE_KEY) !== this.raw) {
      throw new Error('別のタブでデータが更新されています。再取得して確認してください。');
    }
    let saved: AppData;
    try {
      saved = writeData(this.storage, next);
      const raw = this.storage.getItem(STORAGE_KEY);
      if (raw === null || JSON.stringify(decodeStored(raw, 4)) !== JSON.stringify(saved)) {
        throw new Error(SAVE_ERROR);
      }
      this.raw = raw;
    } catch {
      throw new Error(SAVE_ERROR);
    }
    const snapshot: Snapshot = { data: saved, revision: this.snapshot.revision + 1, previous: null, writeId: '' };
    this.snapshot = snapshot;
    return snapshot;
  }
}
