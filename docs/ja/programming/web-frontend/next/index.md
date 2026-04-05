---
prev: false
next: false
---

# Next.js

React のフルスタックフレームワーク——React をベースに**ルーティング、レンダリング戦略、データ取得、ミドルウェア**などの機能をすぐに使える形で提供

::: warning 特徴:

- ファイルシステムベースのルーティング（App Router）
- 複数のレンダリング戦略：SSR、SSG、ISR、ストリーミングレンダリング——同一プロジェクト内で異なるページに異なる戦略を適用可能
- React Server Components（RSC）——コンポーネントはデフォルトでサーバー側で実行され、クライアント側の JS を削減
- 組み込み最適化：画像、フォント、スクリプト、Metadata
- Middleware はエッジで実行され、リクエストをインターセプトして認証、リダイレクト、国際化を処理
- API Routes / Server Actions——別途バックエンドサービスを用意しなくてもフォームやデータ操作を処理可能

:::

::: danger 制限事項:

- Vercel エコシステムに強く依存しており、セルフホスティング（Docker / 他プラットフォーム）時に一部機能が制限される
- Server Components と Client Components の境界分割に学習コストがあり、従来の SPA とはメンタルモデルが異なる
- メジャーバージョンアップデート（Pages → App Router）のたびに大きなマイグレーションコストが発生
- 大規模プロジェクトではビルド速度がボトルネックになる可能性がある

:::

```txt
┏━━━━ SPA（Vite + React Router）━━━━━━━━━━━━━━━━━━━━━━━━━━┓
┃                                                         ┃
┃  浏览器 → 下载 JS → 执行 JS → 渲染页面                    ┃
┃                                                         ┃
┃  ❌ 首屏白屏（JS 下载 + 执行完才看到内容）                  ┃
┃  ❌ SEO 差（爬虫看到空 HTML）                              ┃
┃  ✅ 后续导航快（客户端路由）                               ┃
┃  ✅ 交互丰富（全部在客端）                               ┃
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

## 基礎概念

| 概念 | 一言で説明 | 詳細 |
| --- | --- | --- |
| App Router | ファイルシステムベースのルーティング、`app/` ディレクトリ下のフォルダ = ルート | [詳細](/ja/programming/web-frontend/next/routing) |
| Server Component | デフォルトでサーバー側で実行されるコンポーネント、JS をクライアントに送信しない | [詳細](/ja/programming/web-frontend/next/rendering#server-components) |
| Client Component | `"use client"` でマークし、クライアント側で実行、ステートとイベントをサポート | [詳細](/ja/programming/web-frontend/next/rendering#client-components) |
| SSR | リクエストごとにサーバー側で HTML をレンダリング | [詳細](/ja/programming/web-frontend/next/rendering#ssr) |
| SSG | ビルド時に静的 HTML を生成 | [詳細](/ja/programming/web-frontend/next/rendering#ssg) |
| ISR | 静的ページ + 定期的なバックグラウンド再生成 | [詳細](/ja/programming/web-frontend/next/rendering#isr) |
| Streaming | ストリーミングレンダリング、利用可能な部分を先に送信し、段階的に補完 | [詳細](/ja/programming/web-frontend/next/rendering#streaming) |
| Middleware | リクエストがページに到達する前にインターセプト、エッジで実行 | [詳細](/ja/programming/web-frontend/next/middleware) |
| Server Actions | サーバー側関数、クライアントから直接呼び出し可能 | [詳細](/ja/programming/web-frontend/next/rendering#server-actions) |

## インストール

```bash
npx create-next-app@latest my-app --typescript --app
```

主要なディレクトリ構成：

```txt
my-app/
├── app/                    ← App Router ルートディレクトリ
│   ├── layout.tsx          ← ルートレイアウト（必須）
│   ├── page.tsx            ← トップページ /
│   ├── loading.tsx         ← ローディング UI（Suspense fallback）
│   ├── error.tsx           ← エラーバウンダリ
│   ├── not-found.tsx       ← 404 ページ
│   ├── about/
│   │   └── page.tsx        ← /about
│   └── users/
│       ├── page.tsx        ← /users
│       └── [id]/
│           └── page.tsx    ← /users/:id（動的ルーティング）
├── middleware.ts           ← Middleware（ルートディレクトリ）
├── public/                 ← 静的アセット
└── next.config.ts          ← Next.js 設定
```

## 基本的な使い方

**Server Component**（デフォルト）——データ取得とレンダリングはすべてサーバー側で実行：

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

**Client Component**——インタラクションが必要な場合に `"use client"` を追加：

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

**組み合わせて使用**——Server Component が Client Component をラップ：

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
