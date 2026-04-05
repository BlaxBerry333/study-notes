---
prev: false
next: false
---

# Next.js

React 的全栈框架——在 React 基础上提供**路由、渲染策略、数据获取、中间件**等开箱即用的能力

::: warning 特点:

- 基于文件系统的路由（App Router）
- 多种渲染策略：SSR、SSG、ISR、流式渲染——同一项目中不同页面可以用不同策略
- React Server Components（RSC）——组件默认在服务端运行，减少客户端 JS
- 内置优化：图片、字体、脚本、Metadata
- Middleware 在边缘运行，拦截请求做鉴权、重定向、国际化
- API Routes / Server Actions——不需要单独的后端服务就能处理表单和数据操作

:::

::: danger 局限性:

- 强绑定 Vercel 生态，自部署（Docker / 其他平台）时部分功能受限
- Server Components 和 Client Components 的边界划分有学习成本，心智模型和传统 SPA 不同
- 每次大版本更新（Pages → App Router）都有较大的迁移成本
- 构建速度在大项目中可能成为瓶颈

:::

```txt
┏━━━━ SPA（Vite + React Router）━━━━━━━━━━━━━━━━━━━━━━━━━━┓
┃                                                         ┃
┃  浏览器 → 下载 JS → 执行 JS → 渲染页面                    ┃
┃                                                         ┃
┃  ❌ 首屏白屏（JS 下载 + 执行完才看到内容）                  ┃
┃  ❌ SEO 差（爬虫看到空 HTML）                              ┃
┃  ✅ 后续导航快（客户端路由）                               ┃
┃  ✅ 交互丰富（全部在客户端）                               ┃
┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛

┏━━━━ Next.js（SSR + RSC）━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓
┃                                                         ┃
┃  浏览器 → 收到完整 HTML → 立即显示内容 → hydration         ┃
┃                                                         ┃
┃  ✅ 首屏快（服务端已渲染好 HTML）                          ┃
┃  ✅ SEO 好（爬虫拿到完整 HTML）                           ┃
┃  ✅ RSC 减少客户端 JS 体积                                ┃
┃  ✅ 后续导航也快（预取 + 客户端路由）                      ┃
┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛
```

## 基础概念

| 概念 | 一句话说明 | 详细 |
| --- | --- | --- |
| App Router | 基于文件系统的路由，`app/` 目录下的文件夹 = 路由 | [详见](/programming/web-frontend/next/routing) |
| Server Component | 默认在服务端运行的组件，不发送 JS 到客户端 | [详见](/programming/web-frontend/next/rendering#server-components) |
| Client Component | 用 `"use client"` 标记，在客户端运行，支持状态和事件 | [详见](/programming/web-frontend/next/rendering#client-components) |
| SSR | 每次请求在服务端渲染 HTML | [详见](/programming/web-frontend/next/rendering#ssr) |
| SSG | 构建时生成静态 HTML | [详见](/programming/web-frontend/next/rendering#ssg) |
| ISR | 静态页面 + 定时后台重新生成 | [详见](/programming/web-frontend/next/rendering#isr) |
| Streaming | 流式渲染，先发送可用部分，再逐步补全 | [详见](/programming/web-frontend/next/rendering#streaming) |
| Middleware | 在请求到达页面前拦截，运行在边缘 | [详见](/programming/web-frontend/next/middleware) |
| Server Actions | 服务端函数，可以直接在客户端调用 | [详见](/programming/web-frontend/next/rendering#server-actions) |

## 下载安装

```bash
npx create-next-app@latest my-app --typescript --app
```

关键目录结构：

```txt
my-app/
├── app/                    ← App Router 根目录
│   ├── layout.tsx          ← 根布局（必需）
│   ├── page.tsx            ← 首页 /
│   ├── loading.tsx         ← 加载 UI（Suspense fallback）
│   ├── error.tsx           ← 错误边界
│   ├── not-found.tsx       ← 404 页面
│   ├── about/
│   │   └── page.tsx        ← /about
│   └── users/
│       ├── page.tsx        ← /users
│       └── [id]/
│           └── page.tsx    ← /users/:id（动态路由）
├── middleware.ts           ← Middleware（根目录）
├── public/                 ← 静态资源
└── next.config.ts          ← Next.js 配置
```

## 基本使用

**Server Component**（默认）——数据获取和渲染都在服务端：

```tsx
// app/users/page.tsx — 默认是 Server Component
async function UsersPage() {
  // 直接在组件中 await，不需要 useEffect + useState
  const users = await fetch("https://api.example.com/users").then((r) =>
    r.json(),
  );

  return (
    <ul>
      {users.map((user: User) => (
        <li key={user.id}>{user.name}</li>
      ))}
    </ul>
  );
}

export default UsersPage;
```

**Client Component**——需要交互时加 `"use client"`：

```tsx
"use client";
// app/components/SearchBox.tsx
import { useState } from "react";

export function SearchBox() {
  const [query, setQuery] = useState("");

  return (
    <input
      value={query}
      onChange={(e) => setQuery(e.target.value)}
      placeholder="搜索..."
    />
  );
}
```

**组合使用**——Server Component 包裹 Client Component：

```tsx
// app/users/page.tsx (Server Component)
import { SearchBox } from "../components/SearchBox";

async function UsersPage() {
  const users = await getUsers(); // 服务端数据获取

  return (
    <div>
      <SearchBox /> {/* Client Component：交互 */}
      <UserList users={users} /> {/* Server Component：静态展示 */}
    </div>
  );
}
```
