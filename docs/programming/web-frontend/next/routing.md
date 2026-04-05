# 路由

> App Router

基于文件系统的路由——文件夹结构即路由结构，特殊文件名（`page.tsx`、`layout.tsx`、`loading.tsx` 等）定义页面行为

## 路由约定

| 文件 | 作用 |
| --- | --- |
| `page.tsx` | 路由的 UI，使该路由可访问 |
| `layout.tsx` | 该路由及子路由共享的布局，导航时不重新渲染 |
| `loading.tsx` | 加载 UI，自动包裹在 `<Suspense>` 中 |
| `error.tsx` | 错误边界，捕获该路由及子路由的错误 |
| `not-found.tsx` | 404 页面 |
| `template.tsx` | 类似 layout，但导航时会重新挂载（重置状态） |

```txt
app/
├── layout.tsx              ← 根布局（html + body）
├── page.tsx                ← /
├── dashboard/
│   ├── layout.tsx          ← dashboard 的布局（sidebar）
│   ├── page.tsx            ← /dashboard
│   ├── loading.tsx         ← /dashboard 的加载状态
│   ├── error.tsx           ← /dashboard 的错误边界
│   ├── settings/
│   │   └── page.tsx        ← /dashboard/settings
│   └── analytics/
│       └── page.tsx        ← /dashboard/analytics
```

---

## Layout 与嵌套

Layout 在导航时**保持状态**不重新渲染——适合 sidebar、navbar 等持久 UI：

```tsx
// app/dashboard/layout.tsx
export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex">
      <Sidebar /> {/* 导航时不重新渲染 */}
      <main className="flex-1">{children}</main>
    </div>
  );
}
```

嵌套关系：根 layout → dashboard layout → page

```txt
<RootLayout>          ← app/layout.tsx
  <DashboardLayout>   ← app/dashboard/layout.tsx
    <Page />          ← app/dashboard/page.tsx（切换时只替换这里）
  </DashboardLayout>
</RootLayout>
```

::: tip layout vs template

- `layout.tsx`：导航时保持挂载，状态不丢失（大部分场景用这个）
- `template.tsx`：每次导航重新挂载（需要重置表单、重新触发动画时使用）

:::

---

## 动态路由

```txt
app/users/[id]/page.tsx       → /users/1, /users/abc
app/blog/[...slug]/page.tsx   → /blog/2024, /blog/2024/01/hello（任意层级）
app/shop/[[...slug]]/page.tsx → /shop, /shop/a, /shop/a/b（可选 catch-all）
```

```tsx
// app/users/[id]/page.tsx
type Props = {
  params: Promise<{ id: string }>;
};

export default async function UserPage({ params }: Props) {
  const { id } = await params;
  const user = await getUser(id);

  return <h1>{user.name}</h1>;
}
```

---

## 路由分组

`(folder)` 括号包裹的文件夹**不影响 URL**，只用于组织代码和共享 layout：

```txt
app/
├── (marketing)/            ← URL 中没有 "marketing"
│   ├── layout.tsx          ← marketing 页面共享的 layout
│   ├── about/page.tsx      ← /about
│   └── blog/page.tsx       ← /blog
├── (dashboard)/            ← URL 中没有 "dashboard"
│   ├── layout.tsx          ← dashboard 页面共享的 layout（带 sidebar）
│   ├── settings/page.tsx   ← /settings
│   └── analytics/page.tsx  ← /analytics
```

---

## 导航

### Link 组件

```tsx
import Link from "next/link";

function Nav() {
  return (
    <nav>
      <Link href="/">首页</Link>
      <Link href="/about">关于</Link>
      <Link href={`/users/${userId}`}>用户详情</Link>
    </nav>
  );
}
```

`<Link>` 自动**预取**可视区域内链接的页面数据（生产环境），实现近乎即时的导航

---

### useRouter

```tsx
"use client";
import { useRouter } from "next/navigation";

function LoginForm() {
  const router = useRouter();

  async function handleSubmit() {
    await login();
    router.push("/dashboard"); // 编程式导航
    router.refresh(); // 刷新当前路由（重新获取 Server Component 数据）
    router.back(); // 返回
  }
}
```

::: warning

`useRouter` 只能在 Client Component 中使用。Server Component 中重定向用 `redirect()` 函数

:::

---

## 并行路由与拦截路由

### 并行路由

同一页面同时渲染多个独立的路由段——每个有自己的 loading 和 error 状态：

```txt
app/dashboard/
├── layout.tsx
├── page.tsx
├── @analytics/       ← 并行路由 slot
│   └── page.tsx
└── @notifications/   ← 并行路由 slot
    └── page.tsx
```

```tsx
// app/dashboard/layout.tsx
export default function Layout({
  children,
  analytics,
  notifications,
}: {
  children: React.ReactNode;
  analytics: React.ReactNode;
  notifications: React.ReactNode;
}) {
  return (
    <div>
      {children}
      <div className="grid grid-cols-2">
        {analytics}
        {notifications}
      </div>
    </div>
  );
}
```

---

### 拦截路由

在当前布局内展示另一个路由的内容（如：在列表页弹窗预览详情，刷新后跳转到完整详情页）：

```txt
app/
├── feed/
│   ├── page.tsx              ← 信息流列表
│   └── (..)photo/[id]/       ← 拦截 /photo/[id]，在 feed 内用 modal 展示
│       └── page.tsx
└── photo/[id]/
    └── page.tsx              ← 完整照片页（直接访问或刷新时）
```

拦截前缀：`(.)` 同级、`(..)` 上一级、`(...)` 根级别
