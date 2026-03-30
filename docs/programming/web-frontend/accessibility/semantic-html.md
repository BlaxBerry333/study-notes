# 语义化 HTML

> Semantic HTML

使用有意义的元素，让辅助技术能理解页面结构

屏幕阅读器根据标签种类判断。只用 `<div>` 和 `<span>` 构建的页面，视觉上一样，但对辅助技术来说只是**一堆无意义的盒子**

```html
<!-- ❌ div 汤 — 屏幕阅读器无法理解结构 -->
<div class="header">
  <div class="nav">
    <div class="nav-item" onclick="...">首页</div>
  </div>
</div>
<div class="main">
  <div class="title">文章标题</div>
  <div class="content">正文...</div>
</div>

<!-- ✅ 语义化 HTML — 结构清晰 -->
<header>
  <nav>
    <a href="/">首页</a>
  </nav>
</header>
<main>
  <h1>文章标题</h1>
  <p>正文...</p>
</main>
```

## Landmark 元素

表示页面大结构的元素。屏幕阅读器可以在 Landmark 之间跳转

| 元素        | 隐含 ARIA Role       | 用途                        |
| ----------- | -------------------- | --------------------------- |
| `<header>`  | `banner`             | 页面/区块的头部             |
| `<nav>`     | `navigation`         | 导航链接组                  |
| `<main>`    | `main`               | 页面主要内容（每页仅 1 个） |
| `<aside>`   | `complementary`      | 补充信息（侧边栏等）        |
| `<footer>`  | `contentinfo`        | 页面/区块的底部             |
| `<section>` | `region`（需有标题） | 有主题的内容分组            |
| `<article>` | `article`            | 自包含内容（文章、评论等）  |

::: tip
`<header>` 和 `<footer>` 不仅能在页面顶层使用，也能在 `<article>` 或 `<section>` 内使用。但只有页面顶层的才会被识别为 Landmark
:::

## 标题元素

标题构成页面的**大纲结构**。大多数屏幕阅读器用户通过标题跳转来浏览页面

```html
<!-- ✅ 正确层级 -->
<h1>网站标题</h1>
<h2>章节 1</h2>
<h3>子章节 1-1</h3>
<h3>子章节 1-2</h3>
<h2>章节 2</h2>

<!-- ❌ 跳级了 -->
<h1>标题</h1>
<h3>直接 h3</h3>
<!-- 跳过了 h2 -->

<!-- ❌ 为了视觉效果改层级 -->
<h4>只是想字小一点</h4>
<!-- 应该用 CSS 处理 -->
```

::: warning
"标题不跳级""页面只有一个 `<h1>`"是基本原则。视觉调整用 CSS，HTML 标题层级必须跟随文档结构
:::

## 可交互元素

使用浏览器原生的可交互元素，键盘操作、焦点管理、屏幕阅读器通知都**自动获得**

---

### button vs div onclick

```html
<!-- ❌ div 加点击事件 -->
<div class="btn" onclick="submit()">提交</div>
<!--
  问题:
  - Tab 无法聚焦
  - Enter/Space 不响应
  - 屏幕阅读器不会读出"按钮"
-->

<!-- ✅ button 元素 -->
<button type="button" onclick="submit()">提交</button>
<!--
  自动获得:
  ✅ Tab 聚焦
  ✅ Enter/Space 触发
  ✅ 读出"提交 按钮"
-->
```

---

### a vs button

| 元素       | 用途                    | 键盘触发      |
| ---------- | ----------------------- | ------------- |
| `<a href>` | 页面跳转、有 URL 的操作 | Enter         |
| `<button>` | 执行动作、状态变更      | Enter / Space |

```html
<!-- ✅ 页面跳转 → a -->
<a href="/settings">前往设置</a>

<!-- ✅ 动作 → button -->
<button type="button" onclick="toggleMenu()">打开菜单</button>

<!-- ❌ 反模式 -->
<a href="#" onclick="toggleMenu()">打开菜单</a>
<!-- href="#" 没有跳转目标 -->
<button onclick="location.href='/settings'">设置</button>
<!-- 用 button 做跳转 -->
```

## 图片元素

```html
<!-- 有信息的图片 → 描述内容 -->
<img src="chart.png" alt="2024 年销售趋势图，Q4 同比增长 30%" />

<!-- 装饰性图片 → 空 alt 跳过 -->
<img src="decorative-line.png" alt="" />

<!-- 与文本重复的图片 → 空 alt -->
<figure>
  <img src="logo.png" alt="" />
  <figcaption>公司 Logo</figcaption>
</figure>

<!-- 复杂图片（图表等）→ 另外提供详细描述 -->
<img src="architecture.png" alt="系统架构图" aria-describedby="arch-desc" />
<div id="arch-desc">
  <p>前端使用 React，API 层使用 Node.js，数据库使用 PostgreSQL...</p>
</div>
```

::: warning
"什么时候 `alt` 设为空"是常考题。装饰性图片、与文本重复的图片用 `alt=""`。注意：省略 `alt` 属性本身是 NG 的（屏幕阅读器会读出文件名）
:::

## 列表元素

相关项目用 `<ul>`/`<ol>`/`<dl>` 标记。屏幕阅读器会读出"列表，5 项"

```html
<!-- 导航 → ul + li -->
<nav>
  <ul>
    <li><a href="/">首页</a></li>
    <li><a href="/about">关于</a></li>
    <li><a href="/contact">联系我们</a></li>
  </ul>
</nav>

<!-- 术语和解释 → dl -->
<dl>
  <dt>WAI-ARIA</dt>
  <dd>Web Accessibility Initiative - Accessible Rich Internet Applications</dd>
  <dt>WCAG</dt>
  <dd>Web Content Accessibility Guidelines</dd>
</dl>
```

## 表格元素

数据表格要正确使用 `<caption>`、`<thead>`、`<th scope>`

```html
<table>
  <caption>
    2024 年季度销售额
  </caption>
  <thead>
    <tr>
      <th scope="col">季度</th>
      <th scope="col">销售额（万元）</th>
      <th scope="col">同比</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <th scope="row">Q1</th>
      <td>1,200</td>
      <td>+5%</td>
    </tr>
    <tr>
      <th scope="row">Q2</th>
      <td>1,350</td>
      <td>+12%</td>
    </tr>
  </tbody>
</table>
```

::: tip
避免用表格做布局。如果不得不用，加 `role="presentation"` 阻止辅助技术将其解读为数据表格
:::
