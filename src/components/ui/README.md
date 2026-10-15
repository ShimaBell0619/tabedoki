# 共通UI部品

shadcn/uiの公式 `new-york-v4` registry（Button / Input / NativeSelect / DropdownMenu）を基に、DESIGN.mdの色・寸法・余白に合わせています。原文のMITライセンスは [LICENSE](LICENSE) に保持しています。

- [Viteへの導入](https://ui.shadcn.com/docs/installation/vite)：Tailwind v4のViteプラグイン、components.json、`@/` aliasを使用。
- [Button](https://ui.shadcn.com/r/styles/new-york-v4/button.json)：CVAによるvariantとRadix Slot。`plain`は画面固有の切替操作に使います。
- [Input](https://ui.shadcn.com/r/styles/new-york-v4/input.json)・[NativeSelect](https://ui.shadcn.com/r/styles/new-york-v4/native-select.json)：ネイティブ入力、React 19のref、aria属性をそのまま渡します。選択欄の既存の矢印を維持します。
- [DropdownMenu](https://ui.shadcn.com/r/styles/new-york-v4/dropdown-menu.json)：Radixによるフォーカス管理、矢印、Enter、Escape、外側クリック、画面端の衝突回避。必要なRoot / Trigger / Content / Itemだけを採用。

未使用のvariant、ダークテーマ、装飾アニメーション、別のアイコンパッケージは追加していません。既存の標準dialog・details・checkbox・date入力は維持しています。フォーカス色と全体のトークンは `src/styles/globals.css`、機能の構成と余白は各featureに置きます。ここからapp・features・domain・dataへは依存しません。
