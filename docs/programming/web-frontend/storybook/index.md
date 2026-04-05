---
prev: false
next: false
---

# Storybook

组件的独立开发环境——在隔离状态下开发、文档化和测试 UI 组件

::: warning 特点:

- 组件在独立环境中渲染，不依赖完整应用的路由、状态、API
- 每个组件的不同状态用 Story 描述——正常态、空态、错误态、加载态
- 自动生成组件文档（Props 表、代码示例）
- 支持交互测试（Interaction Testing）——在 Story 中模拟用户操作并断言
- 与 MSW 集成——在 Story 中 mock API 响应

:::

## 基础概念

| 概念 | 说明 |
| --- | --- |
| Story | 组件的一个特定状态的渲染示例（一个组件可以有多个 Story） |
| CSF3 | Component Story Format 3——当前标准的 Story 写法（对象形式） |
| Meta | Story 文件的元信息——指定组件、默认 args、decorators |
| Args | 传给组件的 props——可以在 Storybook UI 中实时调整 |
| Decorators | Story 的包裹层——提供 Context Provider、布局容器等 |
| Play function | Story 的交互脚本——模拟用户操作 + 断言 |

## 基本使用

### CSF3 写法

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

为 Story 提供 Context Provider、布局容器等上下文：

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

全局 decorator（所有 Story 共享）：

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

### 交互测试

在 Story 中模拟用户操作并用 `expect` 断言——同时是文档和测试：

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

::: tip 交互测试 vs Vitest 组件测试

- **Storybook play function**：可视化调试（看得到组件在操作过程中的状态变化），同时是文档
- **Vitest + Testing Library**：更快、CI 中更稳定，适合大量测试用例
- 两者互补：Storybook 覆盖核心交互场景（可视化 + 文档），Vitest 覆盖边界情况（快速 + 批量）

:::

---

### MSW 集成

在 Story 中 mock API 响应，组件像在真实环境中一样工作：

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

::: warning Design System 的最佳实践

- 每个组件都有 Story，至少覆盖：**默认态 / 各种 variant / 禁用态 / 加载态 / 空态 / 错误态**
- 用 `argTypes` 让设计师和 PM 在 Storybook UI 中调整 props 预览效果
- 复杂组件加 `play` function 演示交互流程——新人看 Story 就能理解组件行为
- 用 MSW mock 数据——让涉及 API 调用的组件在 Storybook 中也能正常工作

:::
