# キーボード操作
## なぜ重要か

- 視覚障害のあるユーザーはスクリーンリーダー + キーボードで操作する
- 運動障害のあるユーザーはマウスを使えない場合がある
- パワーユーザーはキーボードショートカットで効率を上げる
- WCAG 2.1 Level A 達成基準 2.1.1「キーボード」は**最低要件**

## Tab 順序とフォーカス

### 自然な Tab 順序

ネイティブのインタラクティブ要素（`<a>`, `<button>`, `<input>`, `<select>`, `<textarea>`）は自動的に Tab 順序に含まれる。DOM 順序 = Tab 順序

```html
<!-- Tab 順序: 1 → 2 → 3（DOM 順序どおり） -->
<button>最初</button>
<!-- 1 -->
<a href="/about">概要</a>
<!-- 2 -->
<input type="text" />
<!-- 3 -->
```

---

### tabindex の使い方

| 値              | 動作                                          |
| --------------- | --------------------------------------------- |
| `tabindex="0"`  | Tab 順序に追加（DOM 順序の位置に）             |
| `tabindex="-1"` | Tab 順序から除外、JS の `.focus()` でのみフォーカス可能 |
| `tabindex="1+"` | **使用禁止**。数値で Tab 順序を制御 → メンテナンスの悪夢 |

```html
<!-- カスタム要素を Tab 順序に追加 -->
<div role="button" tabindex="0">カスタムボタン</div>

<!-- プログラムでフォーカスする必要があるが Tab では到達しない -->
<div id="error-summary" tabindex="-1">エラーがあります</div>

<script>
  // バリデーション失敗時にフォーカスを移動
  document.getElementById("error-summary").focus();
</script>
```

::: warning `tabindex="0"` と `tabindex="-1"` の違い、および正の `tabindex` を使うべきでない理由を説明できること
:::

## フォーカスインジケータ

フォーカスされた要素には可視の視覚的インジケータが必要である（WCAG 2.4.7 Level AA）

```css
/* ❌ フォーカスインジケータの削除 -- アクセシビリティ違反 */
*:focus {
  outline: none;
}

/* ✅ カスタムフォーカススタイル */
:focus-visible {
  outline: 2px solid #4a90d9;
  outline-offset: 2px;
}

/* :focus-visible はキーボード操作時のみ表示される */
/* マウスクリック時には表示されない → UX と a11y の両立 */
```

::: tip
`:focus-visible` は全てのモダンブラウザでサポート済み。`:focus` はマウスクリック時にもアウトラインを表示するため、`:focus-visible` の使用を推奨する
:::

## キーボード操作パターン

### 標準キー

| キー          | 動作                    |
| ------------- | ----------------------- |
| `Tab`         | 次のフォーカス可能な要素 |
| `Shift + Tab` | 前のフォーカス可能な要素 |
| `Enter`       | リンク、ボタンをトリガー |
| `Space`       | ボタンのトリガー、チェックボックスの切り替え |
| `Escape`      | ダイアログ、ポップアップを閉じる |
| `Arrow keys`  | メニュー、タブ、リスト内の移動 |

---

### カスタムコンポーネント

ネイティブ要素を使わずにカスタムコンポーネントを作る場合、キーボードイベントを自分で実装する必要がある

```html
<!-- カスタムドロップダウン -->
<div
  role="combobox"
  tabindex="0"
  aria-expanded="false"
  aria-haspopup="listbox"
  aria-controls="options-list"
>
  選択してください
</div>
<ul role="listbox" id="options-list" hidden>
  <li role="option" tabindex="-1">オプション 1</li>
  <li role="option" tabindex="-1">オプション 2</li>
  <li role="option" tabindex="-1">オプション 3</li>
</ul>
```

```js
combobox.addEventListener("keydown", (e) => {
  switch (e.key) {
    case "Enter":
    case " ":
    case "ArrowDown":
      e.preventDefault();
      openDropdown();
      options[0].focus();
      break;
    case "Escape":
      closeDropdown();
      combobox.focus(); // フォーカスをトリガー要素に戻す
      break;
  }
});

// リスト内の方向キー操作
optionsList.addEventListener("keydown", (e) => {
  const current = document.activeElement;
  const index = options.indexOf(current);

  switch (e.key) {
    case "ArrowDown":
      e.preventDefault();
      options[Math.min(index + 1, options.length - 1)].focus();
      break;
    case "ArrowUp":
      e.preventDefault();
      options[Math.max(index - 1, 0)].focus();
      break;
    case "Enter":
      selectOption(current);
      closeDropdown();
      combobox.focus();
      break;
    case "Escape":
      closeDropdown();
      combobox.focus();
      break;
  }
});
```

## フォーカストラップ（Focus Trap）

モーダルダイアログ内では、Tab キーがダイアログ内でのみ循環する

```js
function trapFocus(dialog) {
  const focusableElements = dialog.querySelectorAll(
    'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
  );
  const first = focusableElements[0];
  const last = focusableElements[focusableElements.length - 1];

  dialog.addEventListener("keydown", (e) => {
    if (e.key !== "Tab") return;

    if (e.shiftKey) {
      // Shift + Tab: 最初の要素 → 最後にジャンプ
      if (document.activeElement === first) {
        e.preventDefault();
        last.focus();
      }
    } else {
      // Tab: 最後の要素 → 最初にジャンプ
      if (document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
  });

  first.focus();
}
```

::: tip
HTML の `<dialog>` 要素は `.showModal()` メソッドと組み合わせると、フォーカストラップと Escape での閉じるが**ネイティブサポート**される。カスタム実装よりも `<dialog>` を優先する
:::

## スキップリンク（Skip Link）

キーボードユーザーが繰り返しのナビゲーション領域をスキップし、メインコンテンツに直接移動できるようにする

```html
<body>
  <a href="#main-content" class="skip-link">メインコンテンツへスキップ</a>
  <nav><!-- 大量のナビゲーションリンク --></nav>
  <main id="main-content" tabindex="-1">
    <!-- メインコンテンツ -->
  </main>
</body>
```

```css
.skip-link {
  position: absolute;
  top: -40px;
  left: 0;
  padding: 8px 16px;
  background: #000;
  color: #fff;
  z-index: 100;
}

.skip-link:focus {
  top: 0;
}
```

## Roving tabindex

コンポーネント内部は方向キーでナビゲーションし、コンポーネント全体で Tab 順序の 1 つの位置のみを占める。タブパネル、ツールバー、メニューなどでよく使われる

```html
<div role="tablist">
  <button role="tab" tabindex="0" aria-selected="true">タブ 1</button>
  <button role="tab" tabindex="-1" aria-selected="false">タブ 2</button>
  <button role="tab" tabindex="-1" aria-selected="false">タブ 3</button>
</div>
```

```js
tabs.forEach((tab, index) => {
  tab.addEventListener("keydown", (e) => {
    let newIndex;
    if (e.key === "ArrowRight") newIndex = (index + 1) % tabs.length;
    if (e.key === "ArrowLeft")
      newIndex = (index - 1 + tabs.length) % tabs.length;

    if (newIndex !== undefined) {
      tabs[index].setAttribute("tabindex", "-1");
      tabs[newIndex].setAttribute("tabindex", "0");
      tabs[newIndex].focus();
    }
  });
});
```

::: warning Roving tabindex はカスタムコンポーネントのキーボードナビゲーションの核心パターンである。コンポーネント全体で Tab Stop は 1 つだけで、内部は方向キーで切り替える
:::

## フォーカス管理

| 場面              | フォーカス移動先                  |
| ----------------- | --------------------------------- |
| ダイアログを開く  | ダイアログ内の最初のフォーカス可能な要素 |
| ダイアログを閉じる | ダイアログを開いたトリガー要素     |
| 要素を削除        | 次の要素、またはリストの見出し     |
| ページ内遷移（SPA） | 新しいページの `<h1>` または `<main>` |
| エラー発生        | エラーサマリー、または最初のエラーフィールド |
| Toast/通知        | フォーカスを移動しない（`aria-live` で通知） |

```js
// SPA のルート切り替え時
function onRouteChange() {
  const main = document.querySelector("main");
  main.setAttribute("tabindex", "-1");
  main.focus();
  // フォーカス後に tabindex を削除（Tab 順序に影響させない）
  main.addEventListener("blur", () => main.removeAttribute("tabindex"), {
    once: true,
  });
}
```
