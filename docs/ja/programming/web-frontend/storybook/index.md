---
prev: false
next: false
---

# Storybook

コンポーネントの独立した開発環境――隔離された状態でUIコンポーネントを開発、ドキュメント化、テストする

::: warning 特徴:

- コンポーネントは独立した環境でレンダリングされ、アプリ全体のルーティング、状態、APIに依存しない
- 各コンポーネントの異なる状態をStoryで記述――正常状態、空状態、エラー状態、ローディング状態
- コンポーネントドキュメントを自動生成（Propsテーブル、コード例）
- インタラクションテスト（Interaction Testing）をサポート――Story内でユーザー操作をシミュレートしてアサート
- MSWと統合――Story内でAPIレスポンスをmock

:::

## 基礎概念

| 概念 | 説明 |
| --- | --- |
| Story | コンポーネントの特定の状態のレンダリング例（1つのコンポーネントに複数のStoryを持てる） |
| CSF3 | Component Story Format 3――現在のStory記述の標準（オブジェクト形式） |
| Meta | Storyファイルのメタ情報――コンポーネント、デフォルトargs、decoratorsを指定 |
| Args | コンポーネントに渡すprops――Storybook UIでリアルタイムに調整可能 |
| Decorators | Storyのラッパー――Context Provider、レイアウトコンテナなどを提供 |
| Play function | Storyのインタラクションスクリプト――ユーザー操作のシミュレート + アサーション |

## 基本的な使い方

### CSF3 記法

```tsx
// Button.stories.tsx
import type { Meta, StoryObj } from "@storybook/react";
import { Button } from "./Button";

// Meta: 描述组件的元信息
const meta = {
  title: "Components/Button", // Storybook 侧边栏的路径
  component: Button,
  tags: ["autodocs"], // 自动生成文档页
  argTypes: {
    variant: {
      control: "select",
      options: ["primary", "secondary", "danger"],
    },
    size: {
      control: "radio",
      options: ["sm", "md", "lg"],
    },
  },
} satisfies Meta<typeof Button>;

export default meta;
type Story = StoryObj<typeof meta>;

// 每个 export = 一个 Story
export const Primary: Story = {
  args: {
    variant: "primary",
    children: "Button",
  },
};

export const Secondary: Story = {
  args: {
    variant: "secondary",
    children: "Button",
  },
};

export const Disabled: Story = {
  args: {
    variant: "primary",
    children: "Disabled",
    disabled: true,
  },
};

export const Loading: Story = {
  args: {
    variant: "primary",
    children: "Loading...",
    loading: true,
  },
};
```

---

### Decorators

Storyにcontext Provider、レイアウトコンテナなどのコンテキストを提供する：

```tsx
const meta = {
  title: "Components/ThemeToggle",
  component: ThemeToggle,
  decorators: [
    // 单个组件的 decorator
    (Story) => (
      <ThemeProvider>
        <div style={{ padding: "2rem" }}>
          <Story />
        </div>
      </ThemeProvider>
    ),
  ],
} satisfies Meta<typeof ThemeToggle>;
```

グローバルdecorator（すべてのStoryで共有）：

```ts
// .storybook/preview.ts
import type { Preview } from "@storybook/react";

const preview: Preview = {
  decorators: [
    (Story) => (
      <AppProviders>
        <Story />
      </AppProviders>
    ),
  ],
};

export default preview;
```

---

### インタラクションテスト

Story内でユーザー操作をシミュレートし、`expect` でアサートする――ドキュメントとテストを兼ねる：

```tsx
import { within, userEvent, expect } from "@storybook/test";

export const FilledForm: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // 模拟用户填写表单
    await userEvent.type(canvas.getByLabelText("邮箱"), "alice@example.com");
    await userEvent.type(canvas.getByLabelText("密码"), "password123");
    await userEvent.click(canvas.getByRole("button", { name: "登录" }));

    // 断言
    await expect(canvas.getByText("登录成功")).toBeInTheDocument();
  },
};

export const ValidationError: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // 不填表单直接提交
    await userEvent.click(canvas.getByRole("button", { name: "登录" }));

    // 断言错误提示出现
    await expect(canvas.getByText("邮箱不能为空")).toBeInTheDocument();
  },
};
```

::: tip インタラクションテスト vs Vitest コンポーネントテスト

- **Storybook play function**：ビジュアルデバッグ（操作過程でのコンポーネントの状態変化が見える）、同時にドキュメント
- **Vitest + Testing Library**：より高速、CI内でより安定、大量のテストケースに適する
- 両者は補完的：Storybookはコアインタラクションシナリオをカバー（ビジュアル + ドキュメント）、Vitestはエッジケースをカバー（高速 + 大量）

:::

---

### MSW 統合

Story内でAPIレスポンスをmockし、コンポーネントが実環境と同じように動作する：

```tsx
import { http, HttpResponse } from "msw";

export const WithData: Story = {
  parameters: {
    msw: {
      handlers: [
        http.get("/api/users", () => {
          return HttpResponse.json([
            { id: "1", name: "Alice" },
            { id: "2", name: "Bob" },
          ]);
        }),
      ],
    },
  },
};

export const Loading: Story = {
  parameters: {
    msw: {
      handlers: [
        http.get("/api/users", async () => {
          await new Promise((r) => setTimeout(r, 999999)); // 永远不返回
        }),
      ],
    },
  },
};

export const Error: Story = {
  parameters: {
    msw: {
      handlers: [
        http.get("/api/users", () => {
          return HttpResponse.json(
            { error: "Internal Server Error" },
            { status: 500 },
          );
        }),
      ],
    },
  },
};
```

::: warning Design System のベストプラクティス

- すべてのコンポーネントにStoryを用意し、最低限カバーすべき状態：**デフォルト / 各variant / 無効状態 / ローディング状態 / 空状態 / エラー状態**
- `argTypes` を使ってデザイナーやPMがStorybook UIでpropsを調整してプレビューできるようにする
- 複雑なコンポーネントには `play` functionでインタラクションフローを演示――新メンバーがStoryを見るだけでコンポーネントの振る舞いを理解できる
- MSWでデータをmock――API呼び出しを含むコンポーネントもStorybook内で正常に動作させる

:::
