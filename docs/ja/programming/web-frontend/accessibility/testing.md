# アクセシビリティテスト
## 三層体系

| 層           | カバー率  | ツール/手法                                  | 発見できる問題                   |
| ------------ | --------- | -------------------------------------------- | -------------------------------- |
| 自動テスト   | 約 30-40% | axe-core, Lighthouse, eslint-plugin-jsx-a11y | alt の欠落、コントラスト不足、ARIA の誤用 |
| 手動テスト   | +30-40%   | キーボード操作、ズーム確認、色のチェック     | フォーカス順序、操作フロー、文脈の妥当性 |
| 支援技術テスト | +20-30% | スクリーンリーダー（VoiceOver, NVDA）        | 読み上げ順序、操作の体感、情報伝達の効果 |

::: warning
自動テストだけでは 30-40% しかカバーできない。「テスト通過 ≠ アクセシビリティ達成」
:::

## 自動テスト

### axe-core

ブラウザ拡張、CI、テストフレームワークなど多様な環境で使えるアクセシビリティ検証エンジン

#### ブラウザ拡張

axe DevTools を Chrome/Firefox にインストール → DevTools の axe タブでページをスキャン

#### jest-axe（ユニットテスト）

```bash
npm install --save-dev jest-axe @testing-library/react
```

```tsx
import { render } from "@testing-library/react";
import { axe, toHaveNoViolations } from "jest-axe";

expect.extend(toHaveNoViolations);

test("LoginForm に a11y 違反がない", async () => {
  const { container } = render(<LoginForm />);
  const results = await axe(container);
  expect(results).toHaveNoViolations();
});
```

#### @axe-core/playwright（E2E テスト）

```bash
npm install --save-dev @axe-core/playwright
```

```ts
import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test("トップページのアクセシビリティチェック", async ({ page }) => {
  await page.goto("/");

  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa"]) // WCAG 2.x AA
    .analyze();

  expect(results.violations).toEqual([]);
});

test("ログインフローのアクセシビリティチェック", async ({ page }) => {
  await page.goto("/login");

  // 初期状態のチェック
  const beforeResults = await new AxeBuilder({ page }).analyze();
  expect(beforeResults.violations).toEqual([]);

  // エラー状態のチェック
  await page.click('button[type="submit"]');
  const afterResults = await new AxeBuilder({ page }).analyze();
  expect(afterResults.violations).toEqual([]);
});
```

---

### Lighthouse

Chrome DevTools 内蔵の監査ツール。Accessibility カテゴリは axe-core エンジンに基づき、0-100 のスコアと具体的な改善提案を提示する

```bash
# CLI で使用
npm install -g lighthouse
lighthouse https://example.com --only-categories=accessibility --output=json
```

```bash
# CI 統合（GitHub Actions）
npm install -g @lhci/cli
lhci autorun --collect.url=http://localhost:3000 --assert.preset=lighthouse:recommended
```

```js
// lighthouserc.js
module.exports = {
  ci: {
    assert: {
      assertions: {
        "categories:accessibility": ["error", { minScore: 0.9 }],
      },
    },
  },
};
```

::: tip
Lighthouse の Accessibility スコアは WCAG 準拠と同義ではない。自動化可能なルール（約 40%）しかチェックしないため、手動テストは依然として不可欠である
:::

---

### eslint-plugin-jsx-a11y

コーディング段階で JSX のアクセシビリティ問題を検出する

```bash
npm install --save-dev eslint-plugin-jsx-a11y
```

```js
// eslint.config.js (flat config)
import jsxA11y from "eslint-plugin-jsx-a11y";

export default [jsxA11y.flatConfigs.recommended];
```

検出できる問題:

- `<img>` に `alt` がない
- `<a>` にテキストコンテンツがない
- 非インタラクティブ要素に `onClick` があるが `onKeyDown` がない
- `aria-*` 属性値が不正

## 手動テスト

### キーボードテスト

キーボードのみで操作し、以下の項目を確認する

```
✅ Tab で全てのインタラクティブ要素に到達できる
✅ フォーカス順序が論理的（視覚的な順序と一致）
✅ フォーカスインジケータが常に可視
✅ モーダルダイアログ内でフォーカスが制限される
✅ Escape でモーダル/ポップアップを閉じられる
✅ フォーカスが画面外に「消えない」
✅ Skip to content リンクが正常に動作する
```

---

### ズームテスト

```
✅ 200% ズームでコンテンツが欠損しない
✅ 水平スクロールバーが出ない（reflow が正常）
✅ テキスト間隔を調整してもコンテンツが読める
```

---

### 色とコントラスト

```
✅ テキストコントラスト: 通常テキスト 4.5:1 以上、大文字 3:1 以上
✅ 色だけで情報を伝えていない
✅ Windows ハイコントラストモードで正常に表示される
```

::: tip コントラストチェックツール

- Chrome DevTools: 要素を選択 → Styles パネルの色プレビューでコントラスト比を確認
- WebAIM Contrast Checker でオンラインで色の組み合わせをチェック
:::

## スクリーンリーダーテスト

### macOS: VoiceOver

```
起動: Cmd + F5
操作:
  VO キー = Ctrl + Option
  次の要素: VO + →
  前の要素: VO + ←
  見出しジャンプ: VO + Cmd + H
  Landmark ジャンプ: VO + Cmd + L（ローター）
  リンクリスト: VO + U → 左右方向キーで切り替え
終了: Cmd + F5
```

---

### Windows: NVDA（無料）

```
ダウンロード: nvaccess.org
起動: Ctrl + Alt + N
操作:
  次の要素: Tab / ↓
  見出しジャンプ: H
  Landmark: D
  リンクリスト: NVDA + F7
  仮想カーソル ON/OFF: NVDA + Space
終了: NVDA + Q
```

---

### チェックリスト

```
✅ ページタイトルが読み上げられる
✅ 見出し構造が正しく読み上げられる
✅ 画像の alt が適切に読み上げられる
✅ フォームラベルと入力が関連付けられている
✅ エラーメッセージが通知される
✅ 動的コンテンツの更新が通知される（Live Region）
✅ カスタムコンポーネントのロールと状態が伝わる
```

## CI 統合

```yaml
# GitHub Actions の例
- name: Accessibility Test
  run: |
    npx playwright test --grep @a11y
```

テストファイルにタグを付けて管理する:

```ts
test("トップページ @a11y", async ({ page }) => {
  await page.goto("/");
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa"])
    .analyze();
  expect(results.violations).toEqual([]);
});
```

::: warning 「アクセシビリティテストをどう自動化するか」はよく問われるポイント。回答の要点：axe-core + Playwright を CI に統合し、定期的な手動キーボードテストとスクリーンリーダーテストを加える
:::
