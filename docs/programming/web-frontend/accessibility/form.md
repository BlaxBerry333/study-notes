# 表单无障碍

## 标签关联

所有表单输入都**必须**有程序关联的标签

---

### label 关联方式

```html
<!-- 方式 1: for + id（推荐） -->
<label for="email">邮箱地址</label>
<input type="email" id="email" name="email" />

<!-- 方式 2: 用 label 包裹 -->
<label>
  邮箱地址
  <input type="email" name="email" />
</label>

<!-- ❌ 没有标签 — 屏幕阅读器只读出"文本输入" -->
<div class="label">邮箱地址</div>
<input type="email" name="email" />

<!-- ❌ placeholder 不能替代标签 -->
<input type="email" placeholder="邮箱地址" />
<!--
  问题:
  - 开始输入就消失 → 忘了该填什么
  - 对比度通常很低
  - 某些屏幕阅读器不读
-->
```

---

### 视觉上隐藏标签

```html
<!-- 搜索框等图标已经表明含义的场景 -->
<label for="search" class="visually-hidden">搜索</label>
<input type="search" id="search" />

<!-- 或者用 aria-label -->
<input type="search" aria-label="站内搜索" />
```

```css
/* visually-hidden: 视觉隐藏但屏幕阅读器可读 */
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
`display: none` 和 `visibility: hidden` 会同时对屏幕阅读器隐藏。只想视觉隐藏标签时用 `visually-hidden` 模式
:::

## 补充说明

```html
<label for="password">密码</label>
<input type="password" id="password" aria-describedby="password-hint" />
<p id="password-hint">至少 8 位，包含大小写字母和数字</p>
```

使用 `aria-describedby` 后，屏幕阅读器会在标签之后读出补充说明：
"密码，文本输入，至少 8 位，包含大小写字母和数字"

## 必填字段

```html
<!-- HTML5 的 required + 视觉标记 -->
<label for="name"> 姓名 <span aria-hidden="true">*</span> </label>
<input type="text" id="name" required aria-required="true" />

<!-- 必填标记说明（放在表单开头） -->
<p><span aria-hidden="true">*</span> 为必填项</p>
```

::: tip
有 `required` 属性时 `aria-required` 是冗余的，但有些项目为了兼容旧版屏幕阅读器会同时加上
:::

## 分组

相关的表单元素要分组并加标签

```html
<!-- fieldset + legend 分组 -->
<fieldset>
  <legend>支付方式</legend>
  <label> <input type="radio" name="payment" value="credit" /> 信用卡 </label>
  <label> <input type="radio" name="payment" value="bank" /> 银行转账 </label>
  <label>
    <input type="radio" name="payment" value="convenience" /> 便利店支付
  </label>
</fieldset>
```

屏幕阅读器会将 `legend` 作为组名读出："支付方式，信用卡，单选按钮"

## 错误信息

### 单个字段的错误

```html
<label for="email">邮箱地址</label>
<input
  type="email"
  id="email"
  aria-invalid="true"
  aria-describedby="email-error"
/>
<p id="email-error" role="alert">邮箱格式不正确</p>
```

| 属性                  | 作用                         |
| --------------------- | ---------------------------- |
| `aria-invalid="true"` | 告诉辅助技术这个输入是无效的 |
| `aria-describedby`    | 将错误信息与输入关联         |
| `role="alert"`        | 错误信息出现时立即读出       |

---

### 错误摘要

多个错误时，在表单顶部显示错误列表并聚焦

```html
<div id="error-summary" role="alert" tabindex="-1">
  <h2>有 2 个错误</h2>
  <ul>
    <li><a href="#name">请输入姓名</a></li>
    <li><a href="#email">邮箱格式不正确</a></li>
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

::: warning 错误展示不能"只靠颜色"。推荐红色 + 文字信息 + 图标的组合。色觉多样性用户无法仅靠红色识别错误
:::

## React 实现

```tsx
function LoginForm() {
  const [errors, setErrors] = useState<Record<string, string>>({});

  return (
    <form onSubmit={handleSubmit} noValidate>
      <div>
        <label htmlFor="email">邮箱地址</label>
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
        <label htmlFor="password">密码</label>
        <input
          type="password"
          id="password"
          aria-invalid={!!errors.password}
          aria-describedby={
            errors.password ? "password-hint password-error" : "password-hint"
          }
        />
        <p id="password-hint">至少 8 位</p>
        {errors.password && (
          <p id="password-error" role="alert">
            {errors.password}
          </p>
        )}
      </div>

      <button type="submit">登录</button>
    </form>
  );
}
```

::: tip
`aria-describedby` 可以用空格分隔指定多个 ID。同时关联提示和错误信息时很方便
:::

## 自动补全

设置 `autocomplete` 属性后浏览器自动填充生效，减轻运动障碍用户的输入负担

```html
<input type="text" autocomplete="name" name="name" />
<input type="email" autocomplete="email" name="email" />
<input type="tel" autocomplete="tel" name="phone" />
<input type="text" autocomplete="street-address" name="address" />
<input type="text" autocomplete="postal-code" name="zip" />
```
