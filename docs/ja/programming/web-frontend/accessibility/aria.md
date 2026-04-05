# WAI-ARIA

> Web Accessibility Initiative - Accessible Rich Internet Applications

## 基本ルール

::: warning ARIA の第一ルール：「ネイティブ HTML 要素で実現できるなら、ARIA を使わない」。ARIA は HTML のセマンティクスを**上書き**するため、誤用するとアクセシビリティが**かえって悪化**する
:::

```html
<!-- ❌ ARIA で button を再発明 -->
<div
  role="button"
  tabindex="0"
  aria-pressed="false"
  onkeydown="if(event.key==='Enter'||event.key===' ')toggle()"
>
  いいね
</div>

<!-- ✅ ネイティブ HTML で十分 -->
<button type="button" onclick="toggle()">いいね</button>
```

## 三つの柱

### 1. Role（ロール）

要素のロールを定義する。ネイティブ HTML 要素は暗黙のロールを持つ

| カテゴリ    | Role                                                           | 説明                             |
| ----------- | -------------------------------------------------------------- | -------------------------------- |
| Landmark    | `banner`, `navigation`, `main`, `complementary`, `contentinfo` | ページ構造（通常は HTML 要素で代替） |
| Widget      | `tab`, `tabpanel`, `dialog`, `alertdialog`, `menu`, `menuitem` | カスタム UI コンポーネント       |
| Live Region | `alert`, `status`, `log`, `timer`                              | 動的に変化するコンテンツ         |
| 構造        | `list`, `listitem`, `table`, `row`, `cell`                     | コンテンツ構造                   |

```html
<!-- Tab UI -- ネイティブ HTML に Tab 要素はないため、ARIA が必要 -->
<div role="tablist">
  <button role="tab" aria-selected="true" aria-controls="panel-1">
    タブ 1
  </button>
  <button role="tab" aria-selected="false" aria-controls="panel-2">
    タブ 2
  </button>
</div>
<div role="tabpanel" id="panel-1">タブ 1 のコンテンツ</div>
<div role="tabpanel" id="panel-2" hidden>タブ 2 のコンテンツ</div>
```

---

### 2. Properties（プロパティ）

要素の特性を記述する属性。値は比較的静的である

| 属性               | 用途                              | 例                                     |
| ------------------ | --------------------------------- | -------------------------------------- |
| `aria-label`       | 要素にラベルを付与（テキスト非表示時） | `<button aria-label="閉じる">✕</button>` |
| `aria-labelledby`  | 他の要素をラベルとして参照        | `aria-labelledby="heading-1"`          |
| `aria-describedby` | 補足説明を参照                    | `aria-describedby="password-hint"`     |
| `aria-required`    | 必須入力                          | `<input aria-required="true">`         |
| `aria-controls`    | この要素が制御する対象            | `aria-controls="dropdown-menu"`        |
| `aria-owns`        | DOM ツリー外の要素を子として関連付け | ポップアップ層など                     |
| `aria-haspopup`    | ポップアップコンテンツがあることを示す | `aria-haspopup="menu"`                 |

---

### 3. States（ステート）

要素の現在の状態を表す属性。ユーザー操作に応じて動的に変化する

| 属性            | 用途                 | 場面               |
| --------------- | -------------------- | ------------------ |
| `aria-expanded` | 展開/折りたたみ状態  | アコーディオン、ドロップダウン |
| `aria-selected` | 選択状態             | タブ、リストボックス |
| `aria-checked`  | チェック状態         | カスタムチェックボックス |
| `aria-disabled` | 無効状態             | 操作不可の要素     |
| `aria-hidden`   | 支援技術から隠す     | 装飾的なアイコンなど |
| `aria-pressed`  | トグルボタンの押下状態 | いいねボタンなど   |
| `aria-current`  | 現在の項目           | ナビゲーションの現在ページ |
| `aria-busy`     | 読み込み中           | コンテンツ更新中   |

## 実装パターン

### アコーディオン

```html
<h3>
  <button aria-expanded="false" aria-controls="section1-content">セクション 1</button>
</h3>
<div id="section1-content" role="region" hidden>
  <p>セクション 1 のコンテンツ...</p>
</div>
```

```js
button.addEventListener("click", () => {
  const expanded = button.getAttribute("aria-expanded") === "true";
  button.setAttribute("aria-expanded", String(!expanded));
  content.hidden = expanded;
});
```

---

### モーダルダイアログ

```html
<div role="dialog" aria-modal="true" aria-labelledby="dialog-title">
  <h2 id="dialog-title">確認</h2>
  <p>本当に削除しますか？</p>
  <button>キャンセル</button>
  <button>削除</button>
</div>
```

::: warning
`aria-modal="true"` はフォーカストラップを自動的には実装しない。JavaScript でダイアログ外へのフォーカス移動を阻止する必要がある。HTML ネイティブの `<dialog>` 要素を使えばフォーカストラップが自動的に得られる
:::

---

### Live Region（ライブリージョン）

ページの一部が動的に更新されたとき、スクリーンリーダーに通知する

```html
<!-- 重要な通知（即座に読み上げ） -->
<div role="alert">エラー：メールアドレスの形式が不正です</div>

<!-- ステータス更新（現在の読み上げ完了後に通知） -->
<div role="status">検索結果 3 件</div>

<!-- aria-live で細かく制御 -->
<div aria-live="polite" aria-atomic="true">カートに 5 件の商品</div>
```

| 属性値                  | 動作                                     |
| ----------------------- | ---------------------------------------- |
| `aria-live="assertive"` | 即座に読み上げ（`role="alert"` と同等）  |
| `aria-live="polite"`    | 現在の読み上げ完了後に通知（`role="status"` と同等） |
| `aria-live="off"`       | 通知しない（デフォルト）                 |
| `aria-atomic="true"`    | 変化部分だけでなく領域全体を読み上げる   |

::: warning `aria-live="assertive"` と `aria-live="polite"` の違いを説明できること。assertive はユーザーの現在の操作を中断して通知するため、エラーや緊急メッセージにのみ使用する
:::

---

### 装飾的なアイコン

```html
<!-- アイコン + テキスト → アイコンを隠す -->
<button>
  <svg aria-hidden="true" focusable="false">...</svg>
  削除
</button>

<!-- アイコンのみ → aria-label でラベルを付与 -->
<button aria-label="削除">
  <svg aria-hidden="true" focusable="false">...</svg>
</button>
```

## `aria-hidden` の注意事項

```html
<!-- ✅ 装飾要素を隠す -->
<span aria-hidden="true">★</span> お気に入り

<!-- ❌ フォーカス可能な要素に aria-hidden を使わない -->
<button aria-hidden="true">隠しボタン</button>
<!-- スクリーンリーダーには見えないが Tab でフォーカスできる → ユーザーが混乱する -->
```
