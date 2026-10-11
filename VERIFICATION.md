# 検証記録

- Foundation 採用元 SHA（2026-10-11確認）: `861a240fc6d344cfab654aaf93a922f1069f97aa`
- 共通CI caller参照SHA: `861a240fc6d344cfab654aaf93a922f1069f97aa`
- 現時点の実装: React + TypeScript + Vite、LocalStorage・JSON入出力
- 元のFoundation生成スクリプト: **未実行**。Chat内環境がGitHubへ接続できないため、固定SHAの配布物を参照して構成した。lockfileは配布元の実lockfileからnameを置換。
- Chat内単体テスト: Node 22.16.0の実験的型削除オプションで6テスト成功。正式Node24と依存検証はCIで行う。
- npm ci／check／typecheck／test／build: CIで検証する。
- Chromium E2Eと画像: CIで検証する。目視・公開版のブラウザは別証拠。
- main SHA／GitHub CI run・checkout SHA: 検証後に追記。
- Vercel Project・Deployment ID／READY・source SHA・alias・公開版操作: 公開後に追記。

Simple方式はGitHub CI成功後にProduction公開する保証を持たない。品質ゲートと配備の成否は別に扱う。
