---
prev: false
next: false
---

# フロントエンドテスト

フロントエンドテストの核心目標：**ユーザーが見る振る舞いが正しいかを検証する**こと、実装の詳細を検証することではない

::: warning 特徴:

- テストピラミッド：ユニットテスト（多）→ 結合テスト（中）→ E2Eテスト（少）
- モダンフロントエンドテストは**コンポーネントの振る舞いテスト**を中心に、関数のユニットテストではない
- Testing Libraryの哲学：ユーザーの視点からテスト――要素の検索にはロール/テキストを使い、CSSセレクタは使わない
- MSWがネットワーク層でAPI mockを行い、テストコードはmockか本番リクエストかを意識しない

:::

```txt
┌─────────────────────────────────────────────────┐
│            E2E テスト（Playwright）                │
│        実ブラウザ + 実サーバー                      │
│        重要なユーザーフローをカバー                   │
│        遅い、メンテコスト高い → コアパスのみ          │
├─────────────────────────────────────────────────┤
│          結合テスト（Vitest + Testing Library）     │
│        コンポーネント + Hook + API呼び出しの連携      │
│        MSWでAPI mock、完全な振る舞いを検証           │
│        最大の投資対効果 → 主力テスト                  │
├─────────────────────────────────────────────────┤
│           ユニットテスト（Vitest）                   │
│        純粋関数、ユーティリティ                      │
│        高速、安定 → エッジケースをカバー              │
└─────────────────────────────────────────────────┘
```

## 基礎概念

| 概念 | 説明 | 詳細 |
| --- | --- | --- |
| Vitest | Viteネイティブのテストフレームワーク、Jest API互換、すぐに使える | [詳細](/ja/programming/web-frontend/testing/vitest) |
| Testing Library | ユーザー視点でコンポーネントをテスト――ロール/テキストで要素を検索し、実装詳細に依存しない | [詳細](/ja/programming/web-frontend/testing/vitest#コンポーネントテスト) |
| MSW | ネットワーク層でAPI mockを行う（[詳細](/ja/programming/web-frontend/msw/)）、テスト内でサーバーレスポンスをmock | [詳細](/ja/programming/web-frontend/testing/vitest#msw-集成) |
| Storybook | コンポーネント開発環境 + インタラクションテスト | [詳細](/ja/programming/web-frontend/storybook/) |
| Playwright | E2Eテストフレームワーク、実ブラウザの自動化 | - |

## テスト戦略

### テストすべきもの

| 優先度 | テスト対象 | 手法 |
| --- | --- | --- |
| **高** | コアビジネスロジック（フォーム送信、決済フロー、権限判定） | 結合テスト |
| **高** | ユーティリティ関数のエッジケース（日付フォーマット、金額計算） | ユニットテスト |
| **高** | 重要なユーザーパス（ログイン → 注文 → 決済） | E2E |
| **中** | 条件付きレンダリング（異なる状態で異なるUIを表示） | コンポーネントテスト |
| **中** | エラーハンドリング（API失敗、ネットワークタイムアウト） | 結合テスト + MSW |
| **低** | スタイルの詳細、アニメーション | Storybookビジュアルリグレッション |
| **不要** | サードパーティライブラリの内部挙動 | - |
| **不要** | 実装の詳細（state値、内部メソッドの呼び出し回数） | - |

---

### Testing Library の哲学

```tsx
// ❌ 测实现细节——重构就挂
const { container } = render(<UserProfile />);
const name = container.querySelector(".user-name"); // CSS 选择器
expect(wrapper.state().isLoading).toBe(false); // 内部 state

// ✅ 测用户行为——重构不影响
render(<UserProfile />);
expect(screen.getByRole("heading", { name: "Alice" })).toBeInTheDocument();
expect(screen.getByText("alice@example.com")).toBeInTheDocument();
```

要素検索の優先順位：

| メソッド | 使うタイミング |
| --- | --- |
| `getByRole` | **最優先**――ARIAロールで検索（`button`、`textbox`、`heading`） |
| `getByLabelText` | フォーム要素――labelの関連付けで検索 |
| `getByPlaceholderText` | 入力欄――labelがない場合 |
| `getByText` | 非インタラクティブ要素――表示テキストで検索 |
| `getByTestId` | **最後の手段**――セマンティックな方法で検索できない場合 |
