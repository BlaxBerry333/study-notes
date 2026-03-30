# WAI-ARIA

> Web Accessibility Initiative - Accessible Rich Internet Applications

## 基本规则

::: warning ARIA 第一规则："如果能用原生 HTML 元素实现，就不要用 ARIA"。ARIA 会**覆盖** HTML 的语义，误用会让无障碍性**更差**
:::

```html
<!-- ❌ 用 ARIA 重新发明 button -->
<div
  role="button"
  tabindex="0"
  aria-pressed="false"
  onkeydown="if(event.key==='Enter'||event.key===' ')toggle()"
>
  点赞
</div>

<!-- ✅ 原生 HTML 就够了 -->
<button type="button" onclick="toggle()">点赞</button>
```

## 三大支柱

### 1. Role（角色）

定义元素的角色。原生 HTML 元素自带隐含角色

| 类别        | Role                                                           | 说明                             |
| ----------- | -------------------------------------------------------------- | -------------------------------- |
| Landmark    | `banner`, `navigation`, `main`, `complementary`, `contentinfo` | 页面结构（通常用 HTML 元素替代） |
| Widget      | `tab`, `tabpanel`, `dialog`, `alertdialog`, `menu`, `menuitem` | 自定义 UI 组件                   |
| Live Region | `alert`, `status`, `log`, `timer`                              | 动态变化的内容                   |
| 结构        | `list`, `listitem`, `table`, `row`, `cell`                     | 内容结构                         |

```html
<!-- Tab UI — 原生 HTML 没有 Tab 元素，需要 ARIA -->
<div role="tablist">
  <button role="tab" aria-selected="true" aria-controls="panel-1">
    标签 1
  </button>
  <button role="tab" aria-selected="false" aria-controls="panel-2">
    标签 2
  </button>
</div>
<div role="tabpanel" id="panel-1">标签 1 的内容</div>
<div role="tabpanel" id="panel-2" hidden>标签 2 的内容</div>
```

---

### 2. Properties（属性）

描述元素特性的属性，值相对静态

| 属性               | 用途                          | 示例                                   |
| ------------------ | ----------------------------- | -------------------------------------- |
| `aria-label`       | 给元素加标签（文本不可见时）  | `<button aria-label="关闭">✕</button>` |
| `aria-labelledby`  | 引用其他元素作为标签          | `aria-labelledby="heading-1"`          |
| `aria-describedby` | 引用补充说明                  | `aria-describedby="password-hint"`     |
| `aria-required`    | 必填输入                      | `<input aria-required="true">`         |
| `aria-controls`    | 本元素控制的目标              | `aria-controls="dropdown-menu"`        |
| `aria-owns`        | 将 DOM 树外的元素关联为子元素 | 弹出层等                               |
| `aria-haspopup`    | 表示有弹出内容                | `aria-haspopup="menu"`                 |

---

### 3. States（状态）

表示元素当前状态的属性，随用户操作动态变化

| 属性            | 用途               | 场景             |
| --------------- | ------------------ | ---------------- |
| `aria-expanded` | 展开/折叠状态      | 手风琴、下拉菜单 |
| `aria-selected` | 选中状态           | Tab、列表框      |
| `aria-checked`  | 勾选状态           | 自定义复选框     |
| `aria-disabled` | 禁用状态           | 不可操作的元素   |
| `aria-hidden`   | 从辅助技术中隐藏   | 装饰性图标等     |
| `aria-pressed`  | 切换按钮的按下状态 | 点赞按钮等       |
| `aria-current`  | 当前项             | 导航中的当前页面 |
| `aria-busy`     | 加载中             | 内容更新中       |

## 实现模式

### 手风琴（Accordion）

```html
<h3>
  <button aria-expanded="false" aria-controls="section1-content">章节 1</button>
</h3>
<div id="section1-content" role="region" hidden>
  <p>章节 1 的内容...</p>
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

### 模态对话框

```html
<div role="dialog" aria-modal="true" aria-labelledby="dialog-title">
  <h2 id="dialog-title">确认</h2>
  <p>确定要删除吗？</p>
  <button>取消</button>
  <button>删除</button>
</div>
```

::: warning
`aria-modal="true"` 不会自动实现焦点陷阱。需要用 JavaScript 阻止焦点移到对话框外。使用 HTML 原生 `<dialog>` 元素可以自动获得焦点陷阱
:::

---

### Live Region（实时区域）

页面局部动态更新时，通知屏幕阅读器

```html
<!-- 重要通知（立即读出） -->
<div role="alert">错误：邮箱格式无效</div>

<!-- 状态更新（当前读完后再通知） -->
<div role="status">找到 3 条搜索结果</div>

<!-- 用 aria-live 细粒度控制 -->
<div aria-live="polite" aria-atomic="true">购物车中有 5 件商品</div>
```

| 属性值                  | 行为                                     |
| ----------------------- | ---------------------------------------- |
| `aria-live="assertive"` | 立即读出（等同 `role="alert"`）          |
| `aria-live="polite"`    | 当前读完后再通知（等同 `role="status"`） |
| `aria-live="off"`       | 不通知（默认）                           |
| `aria-atomic="true"`    | 读出整个区域，而不只是变化的部分         |

::: warning 能说清 `aria-live="assertive"` 和 `aria-live="polite"` 的区别。assertive 会打断用户当前操作来通知，所以只用于错误或紧急消息
:::

---

### 装饰性图标

```html
<!-- 图标 + 文字 → 隐藏图标 -->
<button>
  <svg aria-hidden="true" focusable="false">...</svg>
  删除
</button>

<!-- 仅图标 → 用 aria-label 加标签 -->
<button aria-label="删除">
  <svg aria-hidden="true" focusable="false">...</svg>
</button>
```

## `aria-hidden` 注意事项

```html
<!-- ✅ 隐藏装饰元素 -->
<span aria-hidden="true">★</span> 收藏

<!-- ❌ 不要对可聚焦元素使用 aria-hidden -->
<button aria-hidden="true">隐藏按钮</button>
<!-- 屏幕阅读器看不到，但 Tab 能聚焦 → 用户困惑 -->
```
