---
prev: false
next: false
---

# 前端测试

前端测试的核心目标：**验证用户看到的行为是否正确**，而非验证实现细节

::: warning 特点:

- 测试金字塔：单元测试（多）→ 集成测试（中）→ E2E 测试（少）
- 现代前端测试以**组件行为测试**为核心，而非函数单元测试
- Testing Library 的哲学：从用户角度测试——查找元素用角色/文本，不用 CSS 选择器
- MSW 拦截网络层 mock API，测试代码不感知是 mock 还是真实请求

:::

```txt
┌─────────────────────────────────────────────────┐
│            E2E 测试（Playwright）                 │
│        真实浏览器 + 真实服务器                     │
│        覆盖关键用户流程                            │
│        慢、维护成本高 → 只测核心路径               │
├─────────────────────────────────────────────────┤
│          集成测试（Vitest + Testing Library）      │
│        组件 + Hook + API 调用的协作                │
│        用 MSW mock API，验证完整行为               │
│        最大投资回报率 → 主力测试                    │
├─────────────────────────────────────────────────┤
│           单元测试（Vitest）                       │
│        纯函数、工具方法                            │
│        快速、稳定 → 覆盖边界情况                    │
└─────────────────────────────────────────────────┘
```

## 基础概念

| 概念 | 说明 | 详细 |
| --- | --- | --- |
| Vitest | Vite 原生的测试框架，兼容 Jest API，开箱即用 | [详见](/programming/web-frontend/testing/vitest) |
| Testing Library | 从用户视角测试组件——按角色/文本查找元素，不依赖实现细节 | [详见](/programming/web-frontend/testing/vitest#组件测试) |
| MSW | 网络层拦截 mock API（[详见](/programming/web-frontend/msw/)），测试中 mock 服务端响应 | [详见](/programming/web-frontend/testing/vitest#msw-集成) |
| Storybook | 组件开发环境 + 交互测试 | [详见](/programming/web-frontend/storybook/) |
| Playwright | E2E 测试框架，真实浏览器自动化 | — |

## 测试策略

### 什么值得测

| 优先级 | 测试对象 | 方法 |
| --- | --- | --- |
| **高** | 核心业务逻辑（表单提交、支付流程、权限判断） | 集成测试 |
| **高** | 工具函数的边界情况（日期格式化、金额计算） | 单元测试 |
| **高** | 关键用户路径（登录 → 下单 → 支付） | E2E |
| **中** | 条件渲染（不同状态显示不同 UI） | 组件测试 |
| **中** | 错误处理（API 失败、网络超时） | 集成测试 + MSW |
| **低** | 样式细节、动画 | Storybook 视觉回归 |
| **不测** | 第三方库的内部行为 | — |
| **不测** | 实现细节（state 值、内部方法调用次数） | — |

---

### Testing Library 的哲学

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

查找元素的优先级：

| 方法 | 何时用 |
| --- | --- |
| `getByRole` | **首选**——按 ARIA 角色查找（`button`、`textbox`、`heading`） |
| `getByLabelText` | 表单元素——通过 label 关联 |
| `getByPlaceholderText` | 输入框——没有 label 时 |
| `getByText` | 非交互元素——按可见文本 |
| `getByTestId` | **最后手段**——无法用语义方式查找时 |
