import { Button } from '@/components/ui/button';
import { Icon } from '../components/Icon';
type Props = { mode: 'local' | 'cloud'; email?: string; blocked: boolean; onTemplates: () => void; onRefresh: () => void };
export function SettingsPage({ mode, email, blocked, onTemplates, onRefresh }: Props) {
  return <section aria-labelledby="settings-heading" className="settings-page">
    <h1 id="settings-heading">設定</h1>
    <div className="settings-section">
      <button type="button" className="settings-row" disabled={blocked} onClick={onTemplates}>
        <Icon name="bookmark" /><span><strong>定番食品</strong><small>登録候補を追加・編集</small></span><Icon name="chevron-right" />
      </button>
    </div>
    <h2>データ</h2>
    <div className="settings-section">
      <div className="settings-row"><Icon name={mode === 'cloud' ? 'cloud' : 'package'} />
        <span><strong>{mode === 'cloud' ? 'クラウド保存' : '端末内に保存'}</strong>
          <small>{mode === 'cloud' ? email || 'ログイン中' : 'アカウント操作は右上のメニューから行えます'}</small></span>
      </div>
      <div className="settings-row"><Icon name="refresh-cw" /><span><strong>データを再取得</strong></span>
        <Button variant="secondary" type="button" disabled={blocked} onClick={onRefresh}>再取得</Button></div>
    </div>
    <h2>サービス情報</h2>
    <div className="settings-section">
      <a className="settings-row" href="/terms.html"><Icon name="file-text" /><span>利用規約</span><Icon name="chevron-right" /></a>
      <a className="settings-row" href="/privacy.html"><Icon name="file-text" /><span>プライバシーポリシー</span><Icon name="chevron-right" /></a>
    </div>
  </section>;
}