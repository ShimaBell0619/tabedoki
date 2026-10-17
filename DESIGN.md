---
version: alpha
name: たべどき (Tabedoki)
description: 期限と食品の状態を素早く判断できる家庭用食品管理アプリの視覚デザインシステム。
colors:
  primary: "#253B54"
  on-primary: "#ffffff"
  background: "#FFFFFF"
  surface: "#ffffff"
  inset-surface: "#EDF2F7"
  on-surface: "#25354A"
  muted: "#737F8F"
  border: "#E2E7ED"
  focus: "#B7753B"
  expired: "#a13e36"
  expired-surface: "#fcf0ed"
  today: "#965a12"
  today-surface: "#fff4e4"
typography:
  page-title:
    fontFamily: system-ui
    fontSize: 29px
    fontWeight: 800
    lineHeight: 1.3
    letterSpacing: -0.04em
  item-title:
    fontFamily: system-ui
    fontSize: 17px
    fontWeight: 750
    lineHeight: 1.4
  body:
    fontFamily: system-ui
    fontSize: 16px
    fontWeight: 400
    lineHeight: 1.55
  metadata:
    fontFamily: system-ui
    fontSize: 12px
    fontWeight: 400
    lineHeight: 1.55
spacing:
  xs: 4px
  sm: 8px
  md: 12px
  lg: 16px
  xl: 32px
rounded:
  sm: 8px
  md: 10px
  lg: 13px
components:
  primary-button:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.on-primary}"
    rounded: "{rounded.md}"
    height: 46px
  food-list:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.on-surface}"
    rounded: "{rounded.lg}"
  expired-date:
    backgroundColor: "{colors.expired-surface}"
    textColor: "{colors.expired}"
    rounded: "{rounded.md}"
  today-date:
    backgroundColor: "{colors.today-surface}"
    textColor: "{colors.today}"
    rounded: "{rounded.md}"
---

# Design System — たべどき

## Overview

買った食品の期限と状態を、一目で判断できる落ち着いたモバイルファーストの作業画面。食品そのものを主役にし、装飾ではなく情報階層と明確な操作で使いやすさをつくる。

本書は視覚デザインの正本。製品の目的・重要な保証・制約は [PRODUCT.md](PRODUCT.md)、具体的な操作は実装とテストを参照する。上記トークンは既存 [src/styles/globals.css](src/styles/globals.css) の代表値と対応するが、すべてのCSS宣言をトークン化するものではない。

## Colors

- **Primary**：彩度を抑えたスレートネイビー。主操作・選択中の条件に限定して使用する。
- **Background / Surface**：ニュートラルなライトグレー、白い食品カード、淡いブルーグレーの展開面を使い分ける。細い境界線と余白で区切り、影は最小限にする。
- **On-surface / Muted**：食品名と期限を優先し、カテゴリ・保存場所などの補助情報を控えめにする。
- **Expired / Today**：期限切れの赤と当日の橙。色だけに依存せず、状態は文字でも表示する。
- **Focus**：橙の3pxアウトラインでキーボードフォーカスを明示する。

現時点ではライトテーマのみ。追加の配色や装飾用グラデーションは設けない。

## Typography

日本語システムフォントを基準とし、端末のCJKフォールバックを利用する。ページ見出しは29px、食品名は17pxを中心に、日付・数量・状態を読み取れる階層とする。補助情報は12〜14px、入力欄は16pxを基本とする。長い商品名は切り捨てず折り返す。

## Layout

- 最大幅1040px。画面上部にアプリ名とアカウントメニューを置き、一覧・カレンダー・買い物・設定を切り替える。食品一覧は登録・期限条件・管理状態・詳細条件・食品一覧を優先する。
- 管理中の期限条件は小さな件数付きの操作として折り返し、一覧の縦占有を抑える。
- 一覧は食品単位の独立カードとし、上段の左側に食品名、右側に残り日数（完了時は完了状態）、下段に数量・期限日・在庫状態を表示する。期限が十分先の場合は残り日数を控えめにし、期限間近・期限切れを強調する。数量の「合計」や単一在庫の「最短期限」は省略し、複数期限では最短であることを示す。開閉表示には矢印を使う。展開した期限別在庫は背景色と内側の小カードで区切り、情報と操作の行を分離する。長い食品名は行を増やして表示する。
- 760px以下では「一覧／カレンダー／買い物／設定」の線アイコン付き4タブを画面下端に固定し、食品追加は独立した主操作とする。safe-areaと本文余白を確保する。期限カレンダーは日付を横スクロールで選び、その日の食品と操作を表示する。320px以上で横方向にはみ出さず、狭い画面では食品名や展開後の操作を折り返す。
- 詳細絞り込みは通常時には畳み、適用中の条件は一覧上に残して現在の状態を把握できるようにする。複数の操作を横並びにできない場合は折り返す。

## Elevation & Depth

食品単位の白いカードに8〜12pxの間隔と控えめな影（通常時は2px/8px・低不透明度）を設ける。展開時は枠と影をわずかに強調し、淡いブルーグレーの内側領域に期限別在庫の白い小カードを置き、親子関係を示す。標準dialog／Popoverだけを必要な前面レイヤーとして扱い、大きな影、glass効果、装飾アニメーションは用いない。

## Shapes

操作部は8〜10px、一覧などの面はおおむね13pxの角丸。状態表示の小さなラベルは背景色と文字で読み取れる形状にする。角丸の違いを理由なく増やさない。

## Components

- **食品行**：食品名を最も読み取りやすく示し、数量とカテゴリは補助情報にする。詳細展開内に「使い切り」と編集を配置し、削除等は低頻度メニューに保つ。
- **期限表示**：日付と状態テキストを組み合わせ、期限切れ・今日までを確実に区別する。
- **絞り込み**：カテゴリ・保存場所・期限の詳細条件は必要時のみ開く。初期画面に検索欄は置かない。選択状態は色だけでなく枠線でも示す。
- **食品登録・定番管理**：標準dialogを用い、候補は文字付きの操作要素で提示する。入力と保存操作を長いフォームでも見失わない配置にする。
- **空状態**：初回・管理中なし・完了なし・条件一致なしを区別する文言と、必要な次の操作を提示する。
- **ブランド・アイコン**：鍋のマークとLucideの単色線アイコン（ISCライセンス）を使用する。食品は識別に役立つ個別アイコンまたはカテゴリ単位の汎用アイコンを使い、アイコンを押すと選択一覧を開く。明示選択はシックな単色のまま枠線で選択状態を示し、操作対象は44px程度以上とする。装飾目的の記号は置かず、曖昧なアイコンには文字ラベルを付ける。

## Do's and Don'ts

- **Do**：食品と期限を先に見せる。日本語を簡潔にし、警告を文字でも表す。44px以上の操作対象と見えるフォーカスを維持する。
- **Do**：320／390／1440pxで長い食品名・空状態・フォーム・絞り込みを確認する。
- **Don't**：無意味な英語見出し・宣伝文・重複した数値・装飾カード・装飾アニメーションを置かない。
- **Don't**：操作・保存形式・移行・データ検証の実装上の詳細を本書に重複記載しない。コードとテストで管理し、重要な製品保証はPRODUCT.md、変更理由と検証証拠はPRに残す。
