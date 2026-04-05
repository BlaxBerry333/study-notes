# 前端安全

> Web Security

## 常见攻击与防御

| 攻击 | 一句话说明 | 核心防御 |
| --- | --- | --- |
| XSS | 注入恶意脚本到页面中执行 | [详见](#xss) |
| CSRF | 伪造已登录用户的请求 | [详见](#csrf) |
| CORS | 浏览器的跨域限制（不是攻击，是防御机制） | [详见](#cors) |
| 点击劫持 | 用透明 iframe 覆盖页面诱导点击 | `X-Frame-Options: DENY` |

---

## XSS

> Cross-Site Scripting — 注入恶意脚本

攻击者将恶意 JavaScript 注入到页面中，窃取 Cookie、Session、发起请求

### 三种类型

| 类型 | 注入位置 | 示例 |
| --- | --- | --- |
| **存储型** | 数据库（评论、昵称） | 攻击者在评论中写 `<script>steal()</script>`，其他用户看到评论时执行 |
| **反射型** | URL 参数 | `https://site.com/search?q=<script>alert(1)</script>` |
| **DOM 型** | 客户端 JS | `element.innerHTML = userInput`，JS 直接把用户输入插入 DOM |

---

### 防御

**1. 不要用 `innerHTML` / `dangerouslySetInnerHTML`**

```tsx
// ❌ 直接插入用户输入
element.innerHTML = userInput;
<div dangerouslySetInnerHTML={{ __html: userInput }} />

// ✅ React 默认转义——直接渲染文本是安全的
<div>{userInput}</div>  // <script> 会被转义为文本，不会执行
```

**2. 必须用 `dangerouslySetInnerHTML` 时，先消毒**

```ts
import DOMPurify from "dompurify";

// 消毒：保留安全的 HTML 标签，移除 script/事件处理器
const clean = DOMPurify.sanitize(userInput);
<div dangerouslySetInnerHTML={{ __html: clean }} />
```

**3. CSP（Content Security Policy）——浏览器层面的最后防线**

```
Content-Security-Policy: default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'
```

CSP 告诉浏览器只执行来自指定源的脚本——即使 XSS 成功注入了 `<script>`，浏览器也不会执行

::: warning React 中的 XSS 风险点

React 的 JSX 默认会转义所有内容，但这些地方仍然有风险：

- `dangerouslySetInnerHTML`——名字里就在警告你
- `href={userInput}`——`javascript:alert(1)` 协议可以执行脚本
- `eval()`、`new Function()`——永远不要对用户输入使用
- URL 参数拼接到 API 请求中——可能导致 SSRF

:::

---

## CSRF

> Cross-Site Request Forgery — 伪造请求

用户登录了银行网站 A，Cookie 中有 session。攻击者诱导用户访问恶意网站 B，B 自动发起向 A 的请求——浏览器会自动带上 A 的 Cookie

```txt
用户已登录 bank.com（Cookie: session=abc123）
     │
     ▼ 访问恶意网站
evil.com 的页面中有:
<img src="https://bank.com/transfer?to=attacker&amount=10000" />
     │
     ▼ 浏览器自动带上 bank.com 的 Cookie
bank.com 收到请求，以为是用户本人操作
```

---

### 防御

**1. SameSite Cookie（最重要）**

```
Set-Cookie: session=abc123; SameSite=Lax; Secure; HttpOnly
```

| SameSite 值 | 行为 |
| --- | --- |
| `Strict` | 跨站请求一律不带 Cookie（最安全，但从外部链接跳入也不带） |
| `Lax`（推荐） | 跨站 GET 导航（链接点击）带 Cookie，POST/Ajax 不带 |
| `None` | 允许跨站（必须配合 `Secure`，仅 HTTPS） |

**2. CSRF Token**

服务端在表单中嵌入一个随机 token，提交时验证：

```tsx
<form method="POST" action="/transfer">
  <input type="hidden" name="_csrf" value={csrfToken} />
  <!-- 攻击者无法获取这个 token -->
</form>
```

**3. 验证请求头**

检查 `Origin` 或 `Referer` 头是否来自自己的域名

---

## CORS

> Cross-Origin Resource Sharing — 浏览器的跨域安全机制

浏览器禁止 JS 跨域请求（不同协议/域名/端口 = 跨域）。CORS 是服务端通过响应头告诉浏览器"允许哪些源访问"

```txt
前端: https://app.example.com
API:  https://api.example.com  ← 不同子域 = 跨域

浏览器发送预检请求（OPTIONS）:
→ Origin: https://app.example.com

服务端响应:
← Access-Control-Allow-Origin: https://app.example.com
← Access-Control-Allow-Methods: GET, POST, PUT
← Access-Control-Allow-Headers: Content-Type, Authorization
← Access-Control-Allow-Credentials: true
```

---

### 常见配置

```ts
// Express 示例
app.use(
  cors({
    origin: "https://app.example.com", // 不要用 *（配合 credentials 时不允许）
    credentials: true, // 允许带 Cookie
    methods: ["GET", "POST", "PUT", "DELETE"],
    allowedHeaders: ["Content-Type", "Authorization"],
  }),
);
```

::: warning CORS 常见误区

- CORS 是**浏览器行为**——Postman、curl 不受限制，服务端之间的请求也不受限
- `Access-Control-Allow-Origin: *` 不能和 `credentials: true` 同时用
- 预检请求（OPTIONS）是浏览器自动发的，不是你的代码发的
- 简单请求（GET、POST + form content-type）不需要预检

:::

---

## Cookie 安全

```
Set-Cookie: session=abc123;
  HttpOnly;        ← JS 无法访问（防 XSS 窃取）
  Secure;          ← 只在 HTTPS 传输
  SameSite=Lax;    ← 防 CSRF
  Path=/;
  Max-Age=86400;
```

| 属性 | 作用 |
| --- | --- |
| `HttpOnly` | JS 的 `document.cookie` 无法读写——XSS 窃取不到 |
| `Secure` | 只在 HTTPS 连接中发送——防中间人窃听 |
| `SameSite` | 控制跨站请求是否带 Cookie——防 CSRF |

::: tip Token 存哪里

| 方案 | XSS 安全 | CSRF 安全 | 推荐场景 |
| --- | --- | --- | --- |
| HttpOnly Cookie | ✅（JS 读不到） | 需要 SameSite | 传统 Web 应用 |
| localStorage | ❌（XSS 可读写） | ✅（不自动发送） | 不推荐存敏感 token |
| 内存（变量/闭包） | ✅ | ✅ | SPA 短期 token |

**最安全的方案**：Access Token 存内存，Refresh Token 存 HttpOnly Cookie

:::

---

## SPA 鉴权架构

### JWT 认证流程

```txt
┌─────────┐                    ┌─────────┐
│  客户端   │                    │  服务端   │
└────┬────┘                    └────┬────┘
     │                              │
     │  POST /login {email, pw}     │
     │ ───────────────────────────▶ │
     │                              │ 验证凭证
     │                              │ 生成 Access Token（短期，15min）
     │                              │ 生成 Refresh Token（长期，7d）
     │  Set-Cookie: refresh=xxx     │
     │  { accessToken: "yyy" }      │
     │ ◀─────────────────────────── │
     │                              │
     │  GET /api/data               │
     │  Authorization: Bearer yyy   │
     │ ───────────────────────────▶ │ 验证 Access Token
     │  { data: ... }               │
     │ ◀─────────────────────────── │
     │                              │
     │ （Access Token 过期后）         │
     │  POST /refresh               │
     │  Cookie: refresh=xxx         │
     │ ───────────────────────────▶ │ 验证 Refresh Token
     │  { accessToken: "zzz" }      │ 签发新 Access Token
     │ ◀─────────────────────────── │
```

::: warning 为什么用两个 Token

- **Access Token**：短期（15 分钟），存内存，泄露了损失有限
- **Refresh Token**：长期（7 天），存 HttpOnly Cookie，只发给 `/refresh` 端点
- 分离的好处：Access Token 不走 Cookie（防 CSRF），Refresh Token 不被 JS 访问（防 XSS）

:::

---

### Next.js 中的鉴权

```tsx
// middleware.ts — 每个请求都检查
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  const session = request.cookies.get("session")?.value;

  if (!session && request.nextUrl.pathname.startsWith("/dashboard")) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  // 可以在这里验证 JWT 签名（轻量校验，不查数据库）
  return NextResponse.next();
}
```

```tsx
// Server Component 中获取用户信息
import { cookies } from "next/headers";
import { verifyToken } from "@/lib/auth";

async function DashboardPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get("session")?.value;
  const user = await verifyToken(token); // 服务端验证

  if (!user) redirect("/login");

  return <Dashboard user={user} />;
}
```

```tsx
// Server Action 中验证权限
"use server";
import { cookies } from "next/headers";

export async function deletePost(postId: string) {
  const cookieStore = await cookies();
  const token = cookieStore.get("session")?.value;
  const user = await verifyToken(token);

  if (!user) throw new Error("Unauthorized");
  if (user.role !== "admin") throw new Error("Forbidden");

  await db.post.delete({ where: { id: postId } });
  revalidatePath("/posts");
}
```

::: tip SPA 鉴权的三层防护

| 层 | 负责什么 | 实现 |
| --- | --- | --- |
| **Middleware** | 路由级拦截（未登录不让进） | 检查 Cookie，重定向到登录页 |
| **Server Component** | 页面级数据获取（获取当前用户） | `cookies()` + 验证 token |
| **Server Action** | 操作级权限验证（能不能删除） | 验证 token + 角色检查 |

每一层都独立验证——不要只靠 Middleware 挡，Server Action 也必须自己验证（因为任何人都可以直接调用）

:::
