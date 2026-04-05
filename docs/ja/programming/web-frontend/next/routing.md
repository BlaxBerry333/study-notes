# ルーティング

> App Router

ファイルシステムベースのルーティング——フォルダ構造がそのままルート構造となり、特殊なファイル名（`page.tsx`、`layout.tsx`、`loading.tsx` など）がページの動作を定義する

## ルーティング規約

| ファイル | 役割 |
| --- | --- |
| `page.tsx` | ルートの UI、このルートをアクセス可能にする |
| `layout.tsx` | このルートおよびサブルートで共有されるレイアウト、ナビゲーション時に再レンダリングされない |
| `loading.tsx` | ローディング UI、自動的に `<Suspense>` でラップされる |
| `error.tsx` | エラーバウンダリ、このルートおよびサブルートのエラーをキャッチ |
| `not-found.tsx` | 404 ページ |
| `template.tsx` | layout に似ているが、ナビゲーション時に再マウントされる（ステートがリセットされる） |

```txt
app/
├── layout.tsx              ← ルートレイアウト（html + body）
├── page.tsx                ← /
├── dashboard/
│   ├── layout.tsx          ← dashboard のレイアウト（sidebar）
│   ├── page.tsx            ← /dashboard
│   ├── loading.tsx         ← /dashboard のローディング状態
│   ├── error.tsx           ← /dashboard のエラーバウンダリ
│   ├── settings/
│   │   └── page.tsx        ← /dashboard/settings
│   └── analytics/
│       └── page.tsx        ← /dashboard/analytics
```

---

## Layout とネスト

Layout はナビゲーション時に**ステートを保持**し再レンダリングされない——sidebar、navbar などの持続的な UI に適している：

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

ネスト関係：ルート layout → dashboard layout → page

```txt
<RootLayout>          ← app/layout.tsx
  <DashboardLayout>   ← app/dashboard/layout.tsx
    <Page />          ← app/dashboard/page.tsx（切换时只替换这里）
  </DashboardLayout>
</RootLayout>
```

::: tip layout vs template

- `layout.tsx`：ナビゲーション時にマウント状態を維持し、ステートが失われない（ほとんどのケースでこちらを使用）
- `template.tsx`：ナビゲーションごとに再マウント（フォームのリセットやアニメーションの再トリガーが必要な場合に使用）

:::

---

## 動的ルーティング

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

## ルートグループ

`(folder)` 括弧で囲まれたフォルダは **URL に影響しない**、コードの整理と layout の共有のためだけに使用：

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

## ナビゲーション

### Link コンポーネント

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

`<Link>` はビューポート内のリンク先ページデータを自動的に**プリフェッチ**し（本番環境）、ほぼ瞬時のナビゲーションを実現する

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

`useRouter` は Client Component でのみ使用可能。Server Component でのリダイレクトには `redirect()` 関数を使用する

:::

---

## パラレルルートとインターセプトルート

### パラレルルート

同一ページ内で複数の独立したルートセグメントを同時にレンダリング——それぞれ独自の loading と error ステートを持つ：

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

### インターセプトルート

現在のレイアウト内で別のルートのコンテンツを表示する（例：リストページでモーダルによる詳細プレビュー、リロード後は完全な詳細ページに遷移）：

```txt
app/
├── feed/
│   ├── page.tsx              ← 信息流列表
│   └── (..)photo/[id]/       ← 拦截 /photo/[id]，在 feed 内用 modal 展示
│       └── page.tsx
└── photo/[id]/
    └── page.tsx              ← 完整照片页（直接访问或刷新时）
```

インターセプトプレフィックス：`(.)` 同一階層、`(..)` 一つ上の階層、`(...)` ルートレベル
