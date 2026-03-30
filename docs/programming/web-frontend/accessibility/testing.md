# 无障碍测试
## 三层体系

| 层级         | 覆盖率    | 工具/方法                                    | 能发现的问题                     |
| ------------ | --------- | -------------------------------------------- | -------------------------------- |
| 自动测试     | 约 30-40% | axe-core, Lighthouse, eslint-plugin-jsx-a11y | alt 缺失、对比度不足、ARIA 误用  |
| 手动测试     | +30-40%   | 键盘操作、缩放确认、颜色检查                 | 焦点顺序、操作流程、上下文合理性 |
| 辅助技术测试 | +20-30%   | 屏幕阅读器（VoiceOver, NVDA）                | 读出顺序、操作体感、信息传达效果 |

::: warning
仅靠自动测试只能覆盖 30-40%。"测试通过 ≠ 无障碍达标"
:::

## 自动测试

### axe-core

浏览器扩展、CI、测试框架等多种环境都能用的无障碍验证引擎

#### 浏览器扩展

安装 axe DevTools 到 Chrome/Firefox → DevTools 的 axe 标签扫描页面

#### jest-axe（单元测试）

```bash
npm install --save-dev jest-axe @testing-library/react
```

```tsx
import { render } from "@testing-library/react";
import { axe, toHaveNoViolations } from "jest-axe";

expect.extend(toHaveNoViolations);

test("LoginForm 无 a11y 违规", async () => {
  const { container } = render(<LoginForm />);
  const results = await axe(container);
  expect(results).toHaveNoViolations();
});
```

#### @axe-core/playwright（E2E 测试）

```bash
npm install --save-dev @axe-core/playwright
```

```ts
import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test("首页无障碍检查", async ({ page }) => {
  await page.goto("/");

  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa"]) // WCAG 2.x AA
    .analyze();

  expect(results.violations).toEqual([]);
});

test("登录流程无障碍检查", async ({ page }) => {
  await page.goto("/login");

  // 检查初始状态
  const beforeResults = await new AxeBuilder({ page }).analyze();
  expect(beforeResults.violations).toEqual([]);

  // 检查错误状态
  await page.click('button[type="submit"]');
  const afterResults = await new AxeBuilder({ page }).analyze();
  expect(afterResults.violations).toEqual([]);
});
```

---

### Lighthouse

Chrome DevTools 内置的审计工具，Accessibility 类别基于 axe-core 引擎，给出 0-100 分数和具体改进建议

```bash
# CLI 使用
npm install -g lighthouse
lighthouse https://example.com --only-categories=accessibility --output=json
```

```bash
# CI 集成（GitHub Actions）
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
Lighthouse 的 Accessibility 分数不等于 WCAG 合规。它只检查可自动化的规则（约 40%），手动测试仍然不可替代
:::

---

### eslint-plugin-jsx-a11y

在编码阶段就发现 JSX 的无障碍问题

```bash
npm install --save-dev eslint-plugin-jsx-a11y
```

```js
// eslint.config.js (flat config)
import jsxA11y from "eslint-plugin-jsx-a11y";

export default [jsxA11y.flatConfigs.recommended];
```

能检出的问题:

- `<img>` 没有 `alt`
- `<a>` 没有文本内容
- 非交互元素有 `onClick` 但没有 `onKeyDown`
- `aria-*` 属性值不合法

## 手动测试

### 键盘测试

用纯键盘操作确认以下项目

```
✅ Tab 能到达所有可交互元素
✅ 焦点顺序符合逻辑（与视觉顺序一致）
✅ 焦点指示器始终可见
✅ 模态对话框内焦点被限制
✅ Escape 能关闭模态/弹出层
✅ 焦点不会"消失"到屏幕外
✅ Skip to content 链接正常工作
```

---

### 缩放测试

```
✅ 200% 缩放内容不缺失
✅ 不出现水平滚动条（reflow 正常）
✅ 调整文本间距后内容仍可阅读
```

---

### 颜色与对比度

```
✅ 文本对比度: 正常文本 4.5:1 以上，大字 3:1 以上
✅ 没有仅靠颜色传达信息
✅ Windows 高对比度模式下显示正常
```

::: tip 对比度检查工具

- Chrome DevTools: 选中元素 → Styles 面板的颜色预览查看对比度
- WebAIM Contrast Checker 在线检查颜色组合
:::

## 屏幕阅读器测试

### macOS: VoiceOver

```
启动: Cmd + F5
操作:
  VO 键 = Ctrl + Option
  下一个元素: VO + →
  上一个元素: VO + ←
  标题跳转: VO + Cmd + H
  Landmark 跳转: VO + Cmd + L (转子)
  链接列表: VO + U → 左右方向键切换
退出: Cmd + F5
```

---

### Windows: NVDA（免费）

```
下载: nvaccess.org
启动: Ctrl + Alt + N
操作:
  下一个元素: Tab / ↓
  标题跳转: H
  Landmark: D
  链接列表: NVDA + F7
  虚拟光标 ON/OFF: NVDA + Space
退出: NVDA + Q
```

---

### 检查清单

```
✅ 页面标题被读出
✅ 标题结构正确读出
✅ 图片的 alt 被适当读出
✅ 表单标签与输入关联
✅ 错误信息被通知
✅ 动态内容更新被通知（Live Region）
✅ 自定义组件的角色和状态能传达
```

## CI 集成

```yaml
# GitHub Actions 示例
- name: Accessibility Test
  run: |
    npx playwright test --grep @a11y
```

给测试文件打标签管理:

```ts
test("首页 @a11y", async ({ page }) => {
  await page.goto("/");
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa"])
    .analyze();
  expect(results.violations).toEqual([]);
});
```

::: warning "如何自动化无障碍测试"是常见考察点。回答要点：axe-core + Playwright 集成到 CI，加上定期的手动键盘测试和屏幕阅读器测试
:::
