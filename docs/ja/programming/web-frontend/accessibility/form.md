# フォームのアクセシビリティ

## ラベルの関連付け

全てのフォーム入力には、プログラム的に関連付けられたラベルが**必須**

---

### label の関連付け方法

```html
<!-- 方法 1: for + id（推奨） -->
<label for="email">メールアドレス</label>
<input type="email" id="email" name="email" />

<!-- 方法 2: label で包む -->
<label>
  メールアドレス
  <input type="email" name="email" />
</label>

<!-- ❌ ラベルがない -- スクリーンリーダーは「テキスト入力」としか読み上げない -->
<div class="label">メールアドレス</div>
<input type="email" name="email" />

<!-- ❌ placeholder はラベルの代わりにならない -->
<input type="email" placeholder="メールアドレス" />
<!--
  問題:
  - 入力を始めると消える → 何を入力すべきか忘れる
  - コントラストが通常不足している
  - 一部のスクリーンリーダーが読み上げない
-->
```

---

### 視覚的に隠すラベル

```html
<!-- 検索ボックスなど、アイコンで意味が明白な場面 -->
<label for="search" class="visually-hidden">検索</label>
<input type="search" id="search" />

<!-- または aria-label を使用 -->
<input type="search" aria-label="サイト内検索" />
```

```css
/* visually-hidden: 視覚的には隠すがスクリーンリーダーは読み取れる */
.visually-hidden {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}
```

::: warning
`display: none` と `visibility: hidden` はスクリーンリーダーからも隠してしまう。視覚的にのみラベルを隠したい場合は `visually-hidden` パターンを使う
:::

## 補足説明

```html
<label for="password">パスワード</label>
<input type="password" id="password" aria-describedby="password-hint" />
<p id="password-hint">8 文字以上、大文字・小文字・数字を含む</p>
```

`aria-describedby` を使うと、スクリーンリーダーはラベルの後に補足説明を読み上げる：
「パスワード、テキスト入力、8 文字以上、大文字・小文字・数字を含む」

## 必須フィールド

```html
<!-- HTML5 の required + 視覚的なマーク -->
<label for="name"> 氏名 <span aria-hidden="true">*</span> </label>
<input type="text" id="name" required aria-required="true" />

<!-- 必須マークの説明（フォームの冒頭に配置） -->
<p><span aria-hidden="true">*</span> は必須項目</p>
```

::: tip
`required` 属性がある場合 `aria-required` は冗長だが、旧バージョンのスクリーンリーダーとの互換性のために両方付けるプロジェクトもある
:::

## グループ化

関連するフォーム要素はグループ化してラベルを付ける

```html
<!-- fieldset + legend でグループ化 -->
<fieldset>
  <legend>支払い方法</legend>
  <label> <input type="radio" name="payment" value="credit" /> クレジットカード </label>
  <label> <input type="radio" name="payment" value="bank" /> 銀行振込 </label>
  <label>
    <input type="radio" name="payment" value="convenience" /> コンビニ支払い
  </label>
</fieldset>
```

スクリーンリーダーは `legend` をグループ名として読み上げる：「支払い方法、クレジットカード、ラジオボタン」

## エラーメッセージ

### 単一フィールドのエラー

```html
<label for="email">メールアドレス</label>
<input
  type="email"
  id="email"
  aria-invalid="true"
  aria-describedby="email-error"
/>
<p id="email-error" role="alert">メールアドレスの形式が正しくありません</p>
```

| 属性                  | 役割                           |
| --------------------- | ------------------------------ |
| `aria-invalid="true"` | この入力が無効であることを支援技術に伝える |
| `aria-describedby`    | エラーメッセージを入力と関連付ける |
| `role="alert"`        | エラーメッセージの出現時に即座に読み上げる |

---

### エラーサマリー

複数エラーがある場合、フォーム上部にエラーリストを表示してフォーカスする

```html
<div id="error-summary" role="alert" tabindex="-1">
  <h2>2 件のエラーがあります</h2>
  <ul>
    <li><a href="#name">氏名を入力してください</a></li>
    <li><a href="#email">メールアドレスの形式が正しくありません</a></li>
  </ul>
</div>
```

```js
function onSubmitError(errors) {
  const summary = document.getElementById("error-summary");
  summary.hidden = false;
  summary.focus();
}
```

::: warning エラー表示を「色だけに頼らない」こと。赤色 + テキストメッセージ + アイコンの組み合わせを推奨する。色覚多様性のあるユーザーは赤色だけではエラーを識別できない
:::

## React での実装

```tsx
function LoginForm() {
  const [errors, setErrors] = useState<Record<string, string>>({});

  return (
    <form onSubmit={handleSubmit} noValidate>
      <div>
        <label htmlFor="email">メールアドレス</label>
        <input
          type="email"
          id="email"
          aria-invalid={!!errors.email}
          aria-describedby={errors.email ? "email-error" : undefined}
        />
        {errors.email && (
          <p id="email-error" role="alert">
            {errors.email}
          </p>
        )}
      </div>

      <div>
        <label htmlFor="password">パスワード</label>
        <input
          type="password"
          id="password"
          aria-invalid={!!errors.password}
          aria-describedby={
            errors.password ? "password-hint password-error" : "password-hint"
          }
        />
        <p id="password-hint">8 文字以上</p>
        {errors.password && (
          <p id="password-error" role="alert">
            {errors.password}
          </p>
        )}
      </div>

      <button type="submit">ログイン</button>
    </form>
  );
}
```

::: tip
`aria-describedby` はスペース区切りで複数の ID を指定できる。ヒントとエラーメッセージを同時に関連付ける場合に便利である
:::

## オートコンプリート

`autocomplete` 属性を設定するとブラウザの自動入力が有効になり、運動障害のあるユーザーの入力負担を軽減する

```html
<input type="text" autocomplete="name" name="name" />
<input type="email" autocomplete="email" name="email" />
<input type="tel" autocomplete="tel" name="phone" />
<input type="text" autocomplete="street-address" name="address" />
<input type="text" autocomplete="postal-code" name="zip" />
```
