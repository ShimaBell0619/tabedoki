import { useRef, type ChangeEvent } from 'react';
import { BACKUP_MAX_BYTES, makeBackup, validateBackup } from '../storage';
import type { Food, FoodTemplate } from '../food';
import { Icon } from './Icon';

type Props = {
  items: Food[];
  templates: FoodTemplate[];
  today: string;
  blocked: boolean;
  canExport: boolean;
  onNotice: (message: string) => void;
  onRestore: (items: Food[], templates: FoodTemplate[]) => boolean;
};
export function BackupPanel({ items, templates, today, blocked, canExport, onNotice, onRestore }: Props) {
  const upload = useRef<HTMLInputElement>(null);
  function exportBackup() {
    const blob = new Blob([makeBackup({ items, templates })], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a'); anchor.href = url;
    anchor.download = `tabedoki-backup-${today}.json`; anchor.click();
    URL.revokeObjectURL(url);
    onNotice(blocked ? 'JSONバックアップを保存しました。保存の問題を解消して再読み込みしてください。' : 'JSONバックアップを保存しました。');
  }
  async function importBackup(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (file.size > BACKUP_MAX_BYTES) { onNotice('バックアップファイルは5MB以下にしてください。'); return; }
    let incoming: ReturnType<typeof validateBackup>;
    try { incoming = validateBackup(JSON.parse(await file.text())); }
    catch (error) { onNotice(`復元できません：${error instanceof Error ? error.message : 'ファイルが不正です。'}`); return; }
    if (!window.confirm(`現在の食品${items.length}件を、バックアップの${incoming.items.length}件で上書きします。\n${incoming.templates !== undefined ? '定番食品もバックアップの内容に置き換えます。' : '現在の定番食品は保持します。'}\n元の食品データは失われます。続行しますか？`)) return;
    if (!onRestore(incoming.items, incoming.templates ?? templates)) return;
    onNotice(`${incoming.items.length}件を復元しました。`);
  }
  return (
      <section className="data-section" aria-labelledby="data-heading">
        <div>
          <h2 id="data-heading">バックアップ</h2>
          <p>このブラウザに保存されます。端末間の同期はありません。<br/>データ削除・機種変更で失われるため、バックアップを保存してください。</p>
          </div>
        <div className="backup-buttons">
          <button type="button" className="secondary" disabled={blocked && !canExport} onClick={exportBackup}>
          <Icon name="download" />バックアップを保存</button>
          <button type="button" className="secondary outline" onClick={() => upload.current?.click()}>
          <Icon name="upload" />バックアップから復元</button>
          <input className="sr-only" type="file" ref={upload} accept=".json,application/json" aria-label="バックアップファイルを選択" onChange={importBackup}/>
        </div>
      </section>
  );
}
