# セマンティック HTML

> Semantic HTML

意味のある要素を使い、支援技術がページ構造を理解できるようにする

スクリーンリーダーはタグの種類で判断する。`<div>` と `<span>` だけで構築されたページは、見た目は同じでも支援技術にとっては**意味のない箱の集まり**でしかない

```html
<!-- ❌ div スープ -- スクリーンリーダーが構造を理解できない -->
<div class="header">
  <div class="nav">
    <div class="nav-item" onclick="...">ホーム</div>
  </div>
</div>
<div class="main">
  <div class="title">記事タイトル</div>
  <div class="content">本文...</div>
</div>

<!-- ✅ セマンティック HTML -- 構造が明確 -->
<header>
  <nav>
    <a href="/">ホーム</a>
  </nav>
</header>
<main>
  <h1>記事タイトル</h1>
  <p>本文...</p>
</main>
```

## Landmark 要素

ページの大構造を表す要素。スクリーンリーダーは Landmark 間をジャンプできる

| 要素        | 暗黙の ARIA Role         | 用途                          |
| ----------- | -------------------- | ----------------------------- |
| `<header>`  | `banner`             | ページ/セクションのヘッダー   |
| `<nav>`     | `navigation`         | ナビゲーションリンク群        |
| `<main>`    | `main`               | ページの主要コンテンツ（1 ページに 1 つ） |
| `<aside>`   | `complementary`      | 補足情報（サイドバーなど）    |
| `<footer>`  | `contentinfo`        | ページ/セクションのフッター   |
| `<section>` | `region`（見出し必須） | テーマのあるコンテンツグループ |
| `<article>` | `article`            | 自己完結したコンテンツ（記事、コメントなど） |

::: tip
`<header>` と `<footer>` はページ最上位だけでなく、`<article>` や `<section>` 内でも使える。ただし Landmark として認識されるのはページ最上位のもののみ
:::

## 見出し要素

見出しはページの**アウトライン構造**を形成する。多くのスクリーンリーダーユーザーは見出しジャンプでページを閲覧する

```html
<!-- ✅ 正しいレベル -->
<h1>サイトタイトル</h1>
<h2>セクション 1</h2>
<h3>サブセクション 1-1</h3>
<h3>サブセクション 1-2</h3>
<h2>セクション 2</h2>

<!-- ❌ レベルを飛ばしている -->
<h1>タイトル</h1>
<h3>いきなり h3</h3>
<!-- h2 を飛ばしている -->

<!-- ❌ 見た目のためにレベルを変えている -->
<h4>文字を小さくしたいだけ</h4>
<!-- CSS で処理すべき -->
```

::: warning
「見出しはレベルを飛ばさない」「ページに `<h1>` は 1 つだけ」が基本原則。見た目の調整は CSS で行い、HTML の見出しレベルは文書構造に従わなければならない
:::

## インタラクティブ要素

ブラウザネイティブのインタラクティブ要素を使えば、キーボード操作、フォーカス管理、スクリーンリーダーへの通知が**自動的に得られる**

---

### button vs div onclick

```html
<!-- ❌ div にクリックイベント -->
<div class="btn" onclick="submit()">送信</div>
<!--
  問題:
  - Tab でフォーカスできない
  - Enter/Space が反応しない
  - スクリーンリーダーが「ボタン」と読み上げない
-->

<!-- ✅ button 要素 -->
<button type="button" onclick="submit()">送信</button>
<!--
  自動的に得られるもの:
  ✅ Tab フォーカス
  ✅ Enter/Space でトリガー
  ✅ 「送信 ボタン」と読み上げ
-->
```

---

### a vs button

| 要素       | 用途                          | キーボードトリガー |
| ---------- | ----------------------------- | ------------- |
| `<a href>` | ページ遷移、URL のある操作     | Enter         |
| `<button>` | アクション実行、状態変更       | Enter / Space |

```html
<!-- ✅ ページ遷移 → a -->
<a href="/settings">設定へ</a>

<!-- ✅ アクション → button -->
<button type="button" onclick="toggleMenu()">メニューを開く</button>

<!-- ❌ アンチパターン -->
<a href="#" onclick="toggleMenu()">メニューを開く</a>
<!-- href="#" に遷移先がない -->
<button onclick="location.href='/settings'">設定</button>
<!-- button で遷移している -->
```

## 画像要素

```html
<!-- 情報を持つ画像 → 内容を説明する -->
<img src="chart.png" alt="2024 年の売上推移グラフ、Q4 は前年比 30% 増" />

<!-- 装飾的な画像 → 空の alt でスキップ -->
<img src="decorative-line.png" alt="" />

<!-- テキストと重複する画像 → 空の alt -->
<figure>
  <img src="logo.png" alt="" />
  <figcaption>会社ロゴ</figcaption>
</figure>

<!-- 複雑な画像（図表など）→ 別途詳細説明を提供 -->
<img src="architecture.png" alt="システム構成図" aria-describedby="arch-desc" />
<div id="arch-desc">
  <p>フロントエンドは React、API 層は Node.js、データベースは PostgreSQL...</p>
</div>
```

::: warning
「`alt` をいつ空にするか」はよく問われるポイント。装飾的な画像、テキストと重複する画像は `alt=""` にする。注意：`alt` 属性自体を省略するのは NG（スクリーンリーダーがファイル名を読み上げてしまう）
:::

## リスト要素

関連する項目は `<ul>`/`<ol>`/`<dl>` でマークアップする。スクリーンリーダーは「リスト、5 項目」と読み上げる

```html
<!-- ナビゲーション → ul + li -->
<nav>
  <ul>
    <li><a href="/">ホーム</a></li>
    <li><a href="/about">概要</a></li>
    <li><a href="/contact">お問い合わせ</a></li>
  </ul>
</nav>

<!-- 用語と説明 → dl -->
<dl>
  <dt>WAI-ARIA</dt>
  <dd>Web Accessibility Initiative - Accessible Rich Internet Applications</dd>
  <dt>WCAG</dt>
  <dd>Web Content Accessibility Guidelines</dd>
</dl>
```

## テーブル要素

データテーブルは `<caption>`、`<thead>`、`<th scope>` を正しく使う

```html
<table>
  <caption>
    2024 年四半期別売上
  </caption>
  <thead>
    <tr>
      <th scope="col">四半期</th>
      <th scope="col">売上（万円）</th>
      <th scope="col">前年比</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <th scope="row">Q1</th>
      <td>1,200</td>
      <td>+5%</td>
    </tr>
    <tr>
      <th scope="row">Q2</th>
      <td>1,350</td>
      <td>+12%</td>
    </tr>
  </tbody>
</table>
```

::: tip
テーブルをレイアウト目的で使うのは避ける。やむを得ない場合は `role="presentation"` を付けて、支援技術がデータテーブルとして解釈するのを防ぐ
:::
