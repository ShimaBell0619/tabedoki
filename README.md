# たべどき — Tabedoki

家庭の食品を登録し、賞味期限と消費期限を管理するモバイルファーストのWebアプリです。

## 主な機能
食品の登録・編集・削除、使い切り／廃棄、期限切れ・当日・3日以内の分類、場所・期限状態の絞り込み、名前検索、JSONバックアップ・復元。期限計算は端末のローカル暦日を使用します。

**データはブラウザのLocalStorageだけに保存されます。** ブラウザの履歴・データ削除、端末変更、異なるブラウザでは復元できません。定期的にJSONファイルを保存してください。

## 開発と検証
Node.js 24.20.0以降（`.node-version`参照）で実行します。

```sh
npm ci
npm run check
npm run typecheck
npm test
npm run build
npm run test:e2e
npm run dev
```

仕様: [PRODUCT.md](PRODUCT.md) ／ UI: [DESIGN.md](DESIGN.md) ／ 検証証拠: [VERIFICATION.md](VERIFICATION.md)

Foundation固定SHA: `861a240fc6d344cfab654aaf93a922f1069f97aa`。
