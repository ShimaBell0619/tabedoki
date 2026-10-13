import { useRef, useState, type ChangeEvent } from 'react';
import { BACKUP_MAX_BYTES, makeBackup, validateBackup, type AppData, type BackupData } from '../storage';
import { Icon } from './Icon';

type Props = {
  data: AppData;
  today: string;
  blocked: boolean;
  canExport: boolean;
  raw: string | null;
  onNotice: (message: string) => void;
  onRestore: (backup: BackupData) => boolean;
  onRestorePrevious: () => void;
  onReset: () => void;
};

export function BackupPanel({ data, today, blocked, canExport, raw, onNotice, onRestore, onRestorePrevious, onReset }: Props) {
  const upload = useRef<HTMLInputElement>(null);
  const current = useRef(data);
  current.current = data;
  const [reading, setReading] = useState(false);
  const readingRef = useRef(false);
  function download(text: string, filename: string, type = 'application/json') {
    const url = URL.createObjectURL(new Blob([text], { type }));
    const anchor = document.createElement('a');
    anchor.href = url; anchor.download = filename; anchor.click();
    URL.revokeObjectURL(url);
  }
  function exportBackup() {
    try {
      download(makeBackup(current.current), `tabedoki-backup-${today}.json`);
      onNotice(blocked ? 'JSONバックアップを保存しました。保存の問題を解消して再読み込みしてください。' : 'JSONバックアップを保存しました。');
    } catch (error) { onNotice(`退避できません：${error instanceof Error ? error.message : 'データを確認してください。'}`); }
  }
  async function importBackup(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file || readingRef.current) return;
    if (file.size > BACKUP_MAX_BYTES) { onNotice('バックアップファイルは5MB以下にしてください。'); return; }
    readingRef.current = true; setReading(true);
    try {
      const incoming = validateBackup(JSON.parse(await file.text()));
      const now = current.current;
      const templates = incoming.templates !== undefined ? `定番${now.templates.length}件を${incoming.templates.length}件で置き換えます。` : `定番${now.templates.length}件を保持します。`;
      const shopping = incoming.shopping !== undefined ? `買い物${now.shopping.length}件を${incoming.shopping.length}件で置き換えます。` : `買い物${now.shopping.length}件を保持します。残りわずかは解除されます。`;
      if (!window.confirm(`現在の食品${now.items.length}件を、バックアップの${incoming.items.length}件で上書きします。\n${templates}\n${shopping}\n置換前データを1世代退避します。続行しますか？`)) return;
      if (onRestore(incoming)) onNotice(`${incoming.items.length}件を復元しました。`);
    } catch (error) { onNotice(`復元できません：${error instanceof Error ? error.message : 'ファイルが不正です。'}`); }
    finally { readingRef.current = false; setReading(false); }
  }
  return <details className="backup-panel" open={blocked || undefined}>
    <summary><h2 id="data-heading">バックアップ</h2></summary>
    <section className="data-section" aria-labelledby="data-heading">
      <p>このブラウザに保存。端末間の同期はありません。<br />データ削除・機種変更で失われるため、JSONを保存してください。更新時は旧タブを閉じ、再読み込みして1タブで使ってください。</p>
      <div className="backup-buttons">
        <button type="button" className="secondary" disabled={!canExport} onClick={exportBackup}><Icon name="download" />バックアップを保存</button>
        <button type="button" className="secondary outline" disabled={reading} onClick={() => upload.current?.click()}><Icon name="upload" />バックアップから復元</button>
        <button type="button" className="secondary outline" disabled={reading} onClick={onRestorePrevious}>直前の置換前データを復元</button>
        {raw !== null && <button type="button" className="secondary outline" onClick={() => {
          download(raw, `tabedoki-unreadable-${today}.txt`, 'text/plain');
          onNotice('元の文字列を退避しました。通常のバックアップとして復元できるとは限りません。');
        }}>読み込めないデータを退避</button>}
        {blocked && !canExport && <button type="button" className="secondary outline" disabled={reading} onClick={onReset}>空の状態から始める</button>}
        <input className="sr-only" type="file" ref={upload} accept=".json,application/json"
          aria-label="バックアップファイルを選択" onChange={importBackup} />
      </div>
    </section>
  </details>;
}
