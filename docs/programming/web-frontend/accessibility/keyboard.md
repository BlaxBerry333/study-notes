# 键盘操作
## 为什么重要

- 视障用户使用屏幕阅读器 + 键盘操作
- 运动障碍用户可能无法使用鼠标
- 高级用户依赖键盘快捷键提高效率
- WCAG 2.1 Level A 达成基准 2.1.1"键盘"是**最低要求**

## Tab 顺序与焦点

### 自然 Tab 顺序

原生可交互元素（`<a>`, `<button>`, `<input>`, `<select>`, `<textarea>`）自动包含在 Tab 顺序中。DOM 顺序 = Tab 顺序

```html
<!-- Tab 顺序: 1 → 2 → 3（按 DOM 顺序） -->
<button>第一个</button>
<!-- 1 -->
<a href="/about">关于</a>
<!-- 2 -->
<input type="text" />
<!-- 3 -->
```

---

### tabindex 用法

| 值              | 行为                                          |
| --------------- | --------------------------------------------- |
| `tabindex="0"`  | 加入 Tab 顺序（在 DOM 顺序的位置）            |
| `tabindex="-1"` | 从 Tab 顺序移除，只能用 JS 的 `.focus()` 聚焦 |
| `tabindex="1+"` | **禁止使用**。用数值控制 Tab 顺序 → 维护噩梦  |

```html
<!-- 自定义元素加入 Tab 顺序 -->
<div role="button" tabindex="0">自定义按钮</div>

<!-- 需要程序聚焦但 Tab 不到达 -->
<div id="error-summary" tabindex="-1">有错误</div>

<script>
  // 验证失败时移动焦点
  document.getElementById("error-summary").focus();
</script>
```

::: warning 能说清 `tabindex="0"` 和 `tabindex="-1"` 的区别，以及为什么不该用正数 `tabindex`
:::

## 焦点指示器

被聚焦的元素必须有可见的视觉指示（WCAG 2.4.7 Level AA）

```css
/* ❌ 消除焦点指示器 — 无障碍违规 */
*:focus {
  outline: none;
}

/* ✅ 自定义焦点样式 */
:focus-visible {
  outline: 2px solid #4a90d9;
  outline-offset: 2px;
}

/* :focus-visible 只在键盘操作时显示 */
/* 鼠标点击时不显示 → UX 和 a11y 两全 */
```

::: tip
`:focus-visible` 所有现代浏览器都已支持。`:focus` 在鼠标点击时也会显示轮廓，推荐用 `:focus-visible`
:::

## 键盘操作模式

### 标准按键

| 按键          | 行为                  |
| ------------- | --------------------- |
| `Tab`         | 下一个可聚焦元素      |
| `Shift + Tab` | 上一个可聚焦元素      |
| `Enter`       | 触发链接、按钮        |
| `Space`       | 触发按钮、切换复选框  |
| `Escape`      | 关闭对话框、弹出层    |
| `Arrow keys`  | 菜单、Tab、列表内移动 |

---

### 自定义组件

不用原生元素而自建组件时，需要自己实现键盘事件

```html
<!-- 自定义下拉框 -->
<div
  role="combobox"
  tabindex="0"
  aria-expanded="false"
  aria-haspopup="listbox"
  aria-controls="options-list"
>
  请选择
</div>
<ul role="listbox" id="options-list" hidden>
  <li role="option" tabindex="-1">选项 1</li>
  <li role="option" tabindex="-1">选项 2</li>
  <li role="option" tabindex="-1">选项 3</li>
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
      combobox.focus(); // 焦点回到触发元素
      break;
  }
});

// 列表内的方向键操作
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

## 焦点陷阱（Focus Trap）

模态对话框中，Tab 键只在对话框内循环

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
      // Shift + Tab: 第一个元素 → 跳到最后
      if (document.activeElement === first) {
        e.preventDefault();
        last.focus();
      }
    } else {
      // Tab: 最后一个元素 → 跳到第一个
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
HTML 的 `<dialog>` 元素配合 `.showModal()` 方法，焦点陷阱和 Escape 关闭都是**原生支持**的。优先使用 `<dialog>` 而非自定义实现
:::

## 跳过导航链接（Skip Link）

让键盘用户跳过重复的导航区域，直接到主要内容

```html
<body>
  <a href="#main-content" class="skip-link">跳到主要内容</a>
  <nav><!-- 大量导航链接 --></nav>
  <main id="main-content" tabindex="-1">
    <!-- 主要内容 -->
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

组件内部用方向键导航，整个组件在 Tab 序列中只占一个位置。常用于 Tab 面板、工具栏、菜单等

```html
<div role="tablist">
  <button role="tab" tabindex="0" aria-selected="true">标签 1</button>
  <button role="tab" tabindex="-1" aria-selected="false">标签 2</button>
  <button role="tab" tabindex="-1" aria-selected="false">标签 3</button>
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

::: warning Roving tabindex 是自定义组件键盘导航的核心模式。整个组件只有一个 Tab Stop，内部用方向键切换
:::

## 焦点管理

| 场景            | 焦点移动目标                      |
| --------------- | --------------------------------- |
| 打开对话框      | 对话框内第一个可聚焦元素          |
| 关闭对话框      | 打开对话框的触发元素              |
| 删除元素        | 下一个元素，或列表标题            |
| 页内跳转（SPA） | 新页面的 `<h1>` 或 `<main>`       |
| 发生错误        | 错误摘要，或第一个出错的字段      |
| Toast/通知      | 不移动焦点（用 `aria-live` 通知） |

```js
// SPA 路由切换时
function onRouteChange() {
  const main = document.querySelector("main");
  main.setAttribute("tabindex", "-1");
  main.focus();
  // 聚焦后移除 tabindex（不影响 Tab 顺序）
  main.addEventListener("blur", () => main.removeAttribute("tabindex"), {
    once: true,
  });
}
```
