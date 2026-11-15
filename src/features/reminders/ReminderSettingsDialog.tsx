import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Icon } from '../../components/Icon';
import { readReminderSettings, saveReminderSettings, testReminder, type ReminderSettings } from './reminder-client';

const days = ['月', '火', '水', '木', '金', '土', '日'] as const;
type Props = { userId: string; getAccessToken: () => Promise<string>; onClose: () => void };

export function ReminderSettingsDialog({ userId, getAccessToken, onClose }: Props) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [settings, setSettings] = useState<ReminderSettings>(() => readReminderSettings(userId));
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  useEffect(() => { dialog.current?.showModal(); }, []);

  function update(values: Partial<ReminderSettings>) {
    setSettings(current => ({ ...current, ...values }));
    setMessage(''); setError('');
  }
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true); setError(''); setMessage('');
    try {
      await saveReminderSettings(userId, await getAccessToken(), settings);
      dialog.current?.close();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '通知設定を保存できませんでした。');
    } finally { setBusy(false); }
  }
  async function sendTest() {
    setBusy(true); setError(''); setMessage('');
    try {
      await testReminder(userId, await getAccessToken());
      setMessage('テスト通知を送信しました。Androidの通知欄をご確認ください。');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'テスト通知を送信できませんでした。');
    } finally { setBusy(false); }
  }
  const stored = readReminderSettings(userId);
  const validDays = settings.weekdays.length > 0;
  return <dialog ref={dialog} onClose={onClose} aria-labelledby="reminder-heading"
    className="m-auto max-h-[92dvh] w-[min(94vw,460px)] overflow-auto rounded-[18px] border border-border bg-surface p-0 text-foreground shadow-[0_24px_90px_#212B3840] backdrop:bg-[#1F2937B3] mobile:max-h-[94dvh] mobile:w-[calc(100vw-24px)]">
    <form onSubmit={save} className="flex flex-col gap-4 p-6 mobile:p-4">
      <div className="flex items-center justify-between gap-3">
        <h2 id="reminder-heading" className="m-0 flex items-center gap-2 text-xl font-bold">
          <Icon name="bell" />登録リマインダー
        </h2>
        <Button variant="ghost" size="icon" type="button" aria-label="閉じる" onClick={() => dialog.current?.close()}>
          <Icon name="x" />
        </Button>
      </div>
      <p className="m-0 text-[13px] leading-relaxed text-muted">食品の登録を忘れないよう、選んだ曜日と時刻にお知らせします。</p>
      <label className="flex min-h-11 items-center justify-between gap-3 rounded-lg border border-border px-3 py-2">
        <span className="text-sm font-semibold">通知を有効にする</span>
        <input type="checkbox" className="size-5 accent-action" checked={settings.enabled}
          onChange={event => update({ enabled: event.target.checked })} />
      </label>
      <fieldset disabled={!settings.enabled} className="m-0 flex min-w-0 flex-col gap-4 border-0 p-0 disabled:opacity-50">
        <div className="flex flex-col gap-2">
          <span className="text-[13px] font-semibold">通知する曜日</span>
          <div className="grid grid-cols-7 gap-1" role="group" aria-label="通知する曜日">
            {days.map((day, index) => {
              const selected = settings.weekdays.includes(index + 1);
              return <Button type="button" key={day} variant={selected ? 'default' : 'secondary'}
                aria-pressed={selected} aria-label={day + '曜日'} className="min-h-11 min-w-0 px-0 text-xs"
                onClick={() => update({ weekdays: selected ? settings.weekdays.filter(value => value !== index + 1)
                  : [...settings.weekdays, index + 1].sort() })}>{day}</Button>;
            })}
          </div>
          {!validDays && <p className="m-0 text-xs text-expired">通知する曜日を1つ以上選択してください。</p>}
        </div>
        <fieldset className="m-0 flex flex-col gap-2 border-0 p-0">
          <legend className="mb-2 text-[13px] font-semibold">通知時刻</legend>
          <div className="flex flex-wrap gap-2">
            {([18, 19, 21] as const).map(hour =>
              <label key={hour} className="flex min-h-11 cursor-pointer items-center gap-2 rounded-lg border border-border px-3 text-sm">
                <input name="reminder-hour" type="radio" checked={settings.hour === hour}
                  onChange={() => update({ hour })} />{hour}:00
              </label>)}
          </div>
        </fieldset>
        <label className="flex min-h-11 items-center gap-3 text-[13px]">
          <input type="checkbox" checked={settings.skipRegistered} className="size-5 accent-action"
            onChange={event => update({ skipRegistered: event.target.checked })}/>
          今日すでに食品を登録した場合は通知しない
        </label>
      </fieldset>
      {settings.enabled && <div className="rounded-lg bg-panel p-3 text-xs text-muted">
        {validDays ? days.filter((_,index) => settings.weekdays.includes(index+1)).join('・') + '曜日 ' + settings.hour + ':00' : '曜日未設定'}
        <span className="mt-1 block">Googleログイン中のアカウントで、この端末に通知します。</span>
      </div>}
      {error && <p role="alert" className="m-0 rounded-lg bg-expired-surface p-3 text-[13px] text-expired">{error}</p>}
      {message && <p role="status" className="m-0 text-[13px] text-foreground">{message}</p>}
      <div className="flex flex-col gap-2">
        <Button type="submit" disabled={busy || (settings.enabled && !validDays)}
          className="min-h-11">{busy ? '処理中…' : '設定を保存'}</Button>
        {stored.enabled && <Button type="button" variant="secondary" disabled={busy}
          onClick={sendTest} className="min-h-11">テスト通知を送る</Button>}
      </div>
    </form>
  </dialog>;
}
