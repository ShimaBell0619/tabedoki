---
version: alpha
name: たべどき (Tabedoki)
description: 期限と食品の状態を素早く判断できる家庭用食品管理アプリの視覚デザインシステム。
colors:
  primary: "#116b60"
  on-primary: "#ffffff"
  background: "#f6f8f8"
  surface: "#ffffff"
  on-surface: "#233632"
  muted: "#586c66"
  border: "#dce4e1"
  focus: "#ca6a24"
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

本書は視覚デザインの正本。製品の目的・重要な保証・制約は [PRODUCT.md](PRODUCT.md)、具体的な操作は実装とテストを参照する。上記トークンは既存 [src/styles.css](src/styles.css) の代表値と対応するが、すべてのCSS宣言をトークン化するものではない。

## Colors

- **Primary**：落ち着いた深緑。主操作、選択中の条件、重要な強調に使用する。
- **Background / Surface**：淡いグレーグリーンのページと白い一覧・フォーム。情報のまとまりを境界線で示す。
- **On-surface / Muted**：食品名と期限を優先し、カテゴリ・保存場所などの補助情報を控えめにする。
- **Expired / Today**：期限切れの赤と当日の橙。色だけに依存せず、状態は文字でも表示する。
- **Focus**：橙の3pxアウトラインでキーボードフォーカスを明示する。

現時点ではライトテーマのみ。追加の配色や装飾用グラデーションは設けない。

## Typography

日本語システムフォントを基準とし、端末のCJKフォールバックを利用する。ページ見出しは29px、食品名は17pxを中心に、日付・数量・状態を読み取れる階層とする。補助情報は12〜14px、入力欄は16pxを基本とする。長い商品名は切り捨てず折り返す。

## Layout

- 最大幅1040px。画面上部にアプリ名・定番管理、その下に食品一覧の見出し・登録操作、期限の要約、管理状態切替、検索・詳細条件、食品一覧、バックアップを配置する。
- 期限切れ／今日まで／3日以内の要約は3列とし、期限ごとの件数と絞り込みを一体の要素で表現する。
- 一覧の食品行は、月日を示す日付ブロック、食品名・数量、期限区分・場所・カテゴリ、操作を優先順位に沿って配置する。
- 760px以下では登録操作を画面下端に固定し、safe-areaと本文余白を確保する。320px以上で横方向にはみ出さず、狭い画面では食品行の操作を次の行へ折り返す。
- 詳細絞り込みは通常時には畳み、適用中の条件は一覧上に残して現在の状態を把握できるようにする。複数の操作を横並びにできない場合は折り返す。

## Elevation & Depth

白い一覧領域・薄い境界線・適切な余白でまとまりを示す。標準のdialog／Popoverだけを必要な前面レイヤーとして扱う。装飾目的の大きな影、glass効果、浮遊カードは用いない。

## Shapes

操作部は8〜10px、一覧などの面はおおむね13pxの角丸。状態表示の小さなラベルは背景色と文字で読み取れる形状にする。角丸の違いを理由なく増やさない。

## Components

- **食品行**：食品名を最も読み取りやすく示し、数量とカテゴリは補助情報にする。「使い切り」を主操作、編集を副操作、削除等を低頻度メニューに配置する。
- **期限表示**：日付ブロックと状態テキストを組み合わせ、期限切れ・今日までを確実に区別する。
- **検索・絞り込み**：検索欄は常時表示し、詳細条件は必要時のみ開く。選択状態は色だけでなく枠線でも示す。
- **食品登録・定番管理**：標準dialogを用い、候補は文字付きの操作要素で提示する。入力と保存操作を長いフォームでも見失わない配置にする。
- **空状態**：初回・管理中なし・完了なし・条件一致なしを区別する文言と、必要な次の操作を提示する。
- **ブランド・アイコン**：鍋のマークとLucide系の一貫したアイコンを使用する。装飾目的の記号は置かず、曖昧なアイコンには文字ラベルを付ける。

## Do's and Don'ts

- **Do**：食品と期限を先に見せる。日本語を簡潔にし、警告を文字でも表す。44px以上の操作対象と見えるフォーカスを維持する。
- **Do**：320／390／1440pxで長い食品名・空状態・フォーム・絞り込みを確認する。
- **Don't**：無意味な英語見出し・宣伝文・重複した数値・装飾カード・装飾アニメーションを置かない。
- **Don't**：操作・保存形式・移行・データ検証の実装上の詳細を本書に重複記載しない。コードとテストで管理し、重要な製品保証はPRODUCT.md、変更理由と検証証拠はPRに残す。
