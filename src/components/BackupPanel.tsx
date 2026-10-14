import { useEffect, useRef, useState, type ChangeEvent } from 'react';
import { BACKUP_MAX_BYTES, makeBackup, validateBackup, type AppData, type BackupData } from '../storage';
import { Icon } from './Icon';

type Props = {
  data: AppData;
  today: string;
  blocked: boolean;
  busy: boolean;
  hasPrevious: boolean;
  onNotice: (message: string) => void;
  onRestore: (backup: BackupData) => Promise<boolean>;
  onRestorePrevious: () => void;
  onReadPreviousRaw: () => string;
  account: string;
};

export function BackupPanel({ data, today, blocked, busy, hasPrevious, onNotice, onRestore, onRestorePrevious, onReadPreviousRaw, account }: Props) {
  const upload = useRef<HTMLInputElement>(null);
  const current = useRef(data);
  current.current = data;
  const [reading, setReading] = useState(false);
  const readingRef = useRef(false);
  const active = useRef(true);
  useEffect(() => { active.current = true; return () => { active.current = false; }; }, []);
  function download(text: string, filename: string, type = 'application/json') {
    const url = URL.createObjectURL(new Blob([text], { type }));
    const anchor = document.createElement('a');
    anchor.href = url; anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click(); anchor.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
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
    if (!file || readingRef.current || blocked || busy) return;
    if (file.size > BACKUP_MAX_BYTES) { onNotice('バックアップファイルは5MB以下にしてください。'); return; }
    readingRef.current = true; setReading(true);
    try {
      const incoming = validateBackup(JSON.parse(await file.text()));
      if (!active.current) return;
      const now = current.current;
      const templates = incoming.templates !== undefined ? `定番${now.templates.length}件を${incoming.templates.length}件で置き換えます。` : `定番${now.templates.length}件を保持します。`;
      const shopping = incoming.shopping !== undefined ? `買い物${now.shopping.length}件を${incoming.shopping.length}件で置き換えます。` : `買い物${now.shopping.length}件を保持します。残りわずかは解除されます。`;
      if (!window.confirm(`${account} の食品${now.items.length}件を、バックアップの${incoming.items.length}件で上書きします。\n${templates}\n${shopping}\n置換前データを1世代退避します。続行しますか？`)) return;
      if (await onRestore(incoming)) onNotice(`${incoming.items.length}件を復元しました。`);
    } catch (error) { onNotice(`復元できません：${error instanceof Error ? error.message : 'ファイルが不正です。'}`); }
    finally { readingRef.current = false; setReading(false); }
  }
  return <details className="backup-panel" open={blocked || undefined}>
    <summary><h2 id="data-heading">バックアップ</h2></summary>
    <section className="data-section" aria-labelledby="data-heading">
      <p>同じGoogleアカウントでクラウドに保存します。定期的にJSONを保存してください。</p>
      <div className="backup-buttons">
        <button type="button" className="secondary" onClick={exportBackup}><Icon name="download" />バックアップを保存</button>
        <button type="button" className="secondary outline" disabled={reading || blocked || busy} onClick={() => upload.current?.click()}><Icon name="upload" />バックアップから復元</button>
        {hasPrevious && <button type="button" className="secondary outline" disabled={reading || blocked || busy} onClick={onRestorePrevious}>直前の置換前データを復元</button>}
        {hasPrevious && <button type="button" className="secondary outline" onClick={() => {
          try {
            download(onReadPreviousRaw(), `tabedoki-previous-${today}.json`);
            onNotice('直前の置換前データをJSONで退避しました。');
          } catch (error) { onNotice(`退避できません：${error instanceof Error ? error.message : '原文を取得できません。'}`); }
        }}>直前の置換前データを退避</button>}
        <input className="sr-only" type="file" ref={upload} disabled={reading || blocked || busy} accept=".json,application/json"
          aria-label="バックアップファイルを選択" onChange={importBackup} />
      </div>
    </section>
  </details>;
}
