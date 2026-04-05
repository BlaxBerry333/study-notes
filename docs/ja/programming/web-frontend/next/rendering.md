# レンダリング戦略

> SSR / SSG / ISR / Streaming / Server Components / Server Actions

## Server Components

App Router ではコンポーネントは**デフォルトで Server Component**——サーバー側で実行され、JS をクライアントに送信しない

```tsx
// 默认就是 Server Component，不需要任何标记
async function ProductPage() {
  const product = await db.product.findUnique({ where: { id: 1 } });
  // 可以直接访问数据库、文件系统、环境变量
  // 组件的代码不会被发送到浏览器

  return <h1>{product.name}</h1>;
}
```

### Server vs Client Component

| 能力 | Server Component | Client Component |
| --- | --- | --- |
| データ取得 | `async/await` で直接取得 | `useEffect` / TanStack Query |
| バックエンドリソースへのアクセス | ✅ データベース、ファイルシステム、環境変数 | ❌ |
| クライアントへの JS 送信 | ❌ JS ゼロ | ✅ bundle が増加 |
| useState / useEffect | ❌ | ✅ |
| イベントハンドリング（onClick など） | ❌ | ✅ |
| ブラウザ API | ❌ | ✅ |
| Context | ❌ | ✅ |

::: warning 境界分割の原則

- **デフォルトで Server Component を使用**——サーバー側でできることはクライアントに持ち込まない
- **インタラクションが必要な場合のみ Client Component を使用**：`useState`、`useEffect`、イベントハンドリング、ブラウザ API
- **`"use client"` は境界**：マークすると、そのファイルおよび import されるすべてのモジュールがクライアントコードになる
- **`"use client"` を最小範囲に押し下げる**：本当にインタラクションが必要なリーフコンポーネントにのみマークし、トップレベルの layout にはマークしない

```tsx
// ❌ 整个页面变成客户端
"use client";
export default function Page() {
  const [open, setOpen] = useState(false);
  const data = useQuery(...); // 本可以在服务端获取
  return <div>...</div>;
}

// ✅ 只有交互部分是客户端
export default async function Page() {
  const data = await getData(); // 服务端获取
  return (
    <div>
      <StaticContent data={data} />
      <InteractivePanel /> {/* "use client" 只在这个组件里 */}
    </div>
  );
}
```

:::

---

## SSR

> Server-Side Rendering — リクエストごとにサーバー側でレンダリング

App Router では動的データ（`cookies()`、`headers()`、キャッシュされていない `fetch`）を使用すると自動的に SSR がトリガーされる：

```tsx
import { cookies } from "next/headers";

// 每次请求都在服务端运行（因为读了 cookies）
export default async function DashboardPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get("session")?.value;
  const data = await fetchDashboardData(token);

  return <Dashboard data={data} />;
}
```

---

## SSG

> Static Site Generation — ビルド時に静的 HTML を生成

動的データソースのないページは自動的に SSG になる：

```tsx
// 构建时运行一次，生成静态 HTML
export default async function AboutPage() {
  const content = await getMarkdownContent("about");
  return <article dangerouslySetInnerHTML={{ __html: content }} />;
}
```

動的ルートの SSG には `generateStaticParams` が必要：

```tsx
// app/blog/[slug]/page.tsx
export async function generateStaticParams() {
  const posts = await getAllPosts();
  return posts.map((post) => ({ slug: post.slug }));
  // 构建时为每个 slug 生成一个静态页面
}

export default async function BlogPost({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const post = await getPost(slug);
  return <article>{post.content}</article>;
}
```

---

## ISR

> Incremental Static Regeneration — 静的ページ + バックグラウンドでの定期再生成

SSG のパフォーマンスと SSR のデータ鮮度を両立：

```tsx
// 页面在 60 秒内返回缓存的静态 HTML
// 超过 60 秒后的请求仍返回旧页面，但在后台触发重新生成
// 下一次请求就能拿到新页面
export const revalidate = 60; // 秒

export default async function ProductPage() {
  const products = await getProducts();
  return <ProductList products={products} />;
}
```

オンデマンドで再生成をトリガー（定期を待たない）：

```ts
// app/api/revalidate/route.ts
import { revalidatePath, revalidateTag } from "next/cache";

export async function POST(request: Request) {
  revalidatePath("/products"); // 按路径
  // 或 revalidateTag("products"); // 按标签
  return Response.json({ revalidated: true });
}
```

---

## Streaming

ストリーミングレンダリング——ページのスケルトンを先に送信し、データが準備できた部分を段階的に送信：

```tsx
import { Suspense } from "react";

export default function DashboardPage() {
  return (
    <div>
      <h1>Dashboard</h1> {/* 立即发送 */}

      <Suspense fallback={<ChartSkeleton />}>
        <SlowChart /> {/* 数据准备好后流式发送 */}
      </Suspense>

      <Suspense fallback={<TableSkeleton />}>
        <SlowTable /> {/* 独立的 Suspense，各自等各自的 */}
      </Suspense>
    </div>
  );
}

// 慢组件——3 秒后才有数据，但不阻塞整个页面
async function SlowChart() {
  const data = await fetch("https://api.example.com/chart-data"); // 3s
  return <Chart data={await data.json()} />;
}
```

```txt
Time 0s:  浏览器收到 HTML 骨架 + <h1>Dashboard</h1> + Skeleton
Time 1s:  SlowTable 数据到了 → 流式替换 TableSkeleton
Time 3s:  SlowChart 数据到了 → 流式替换 ChartSkeleton
```

::: tip `loading.tsx` はページレベルの Streaming

`loading.tsx` ファイルは自動的に `<Suspense fallback={<Loading />}>` でラップされ、`page.tsx` が準備完了するまで loading UI を表示する

:::

---

## Server Actions

サーバー側関数で、クライアントのフォームやイベントハンドラから直接呼び出せる——手動で API エンドポイントを作成する必要がない：

```tsx
// app/actions.ts
"use server";

export async function createPost(formData: FormData) {
  const title = formData.get("title") as string;
  const content = formData.get("content") as string;

  await db.post.create({ data: { title, content } });
  revalidatePath("/posts"); // 触发页面重新生成
}
```

```tsx
// app/posts/new/page.tsx
import { createPost } from "../actions";

export default function NewPostPage() {
  return (
    <form action={createPost}>
      <input name="title" placeholder="标题" required />
      <textarea name="content" placeholder="内容" required />
      <button type="submit">发布</button>
    </form>
  );
}
```

Client Component での Server Actions の使用：

```tsx
"use client";
import { createPost } from "../actions";
import { useTransition } from "react";

export function PostForm() {
  const [isPending, startTransition] = useTransition();

  const handleSubmit = (formData: FormData) => {
    startTransition(async () => {
      await createPost(formData);
    });
  };

  return (
    <form action={handleSubmit}>
      <input name="title" required />
      <button disabled={isPending}>
        {isPending ? "发布中..." : "发布"}
      </button>
    </form>
  );
}
```

::: warning Server Actions の注意点

- `"use server"` でマークされた関数はリモート呼び出し可能なエンドポイントとして公開され、引数はネットワーク経由で転送される——大きなオブジェクトを渡さないこと
- 引数はシリアライズ可能でなければならない（関数、DOM 要素などは渡せない）
- 入力バリデーションは自分で行う必要がある（Zod など）、誰でもこのエンドポイントを直接呼び出せるため
- フォーム送信やデータ変更などの mutation シナリオに適しており、データ取得には適さない（データ取得には Server Component を使用）

:::

---

## レンダリング戦略の選択

| シナリオ | 戦略 | 理由 |
| --- | --- | --- |
| ブログ記事、ドキュメント、マーケティングページ | **SSG** | コンテンツが頻繁に変わらず、ビルド時の生成が最速 |
| EC 商品ページ | **ISR** | 価格/在庫は変動するがリアルタイム性は不要、定期更新で十分 |
| ユーザーダッシュボード、パーソナライズページ | **SSR** | ユーザーごとに異なるコンテンツ、リアルタイムデータが必要 |
| データ読み込みが遅いページ | **Streaming** | スケルトンを先に送信し、段階的に埋めることで初期表示をブロックしない |
| 静的ページ + 少量のインタラクション | **RSC + Client Component** | 大部分のコンテンツはサーバー側でレンダリング、インタラクション部分のみ JS を送信 |

---

## Hydration

SSR の HTML がブラウザに到達した後、React は **hydration**（ハイドレーション）を行う——静的 HTML と React コンポーネントツリーを関連付け、イベントハンドラをバインドする

```txt
服务端渲染 HTML（静态，不可交互）
      │
      ▼ 浏览器接收
显示静态 HTML（用户已经能看到内容）
      │
      ▼ JS 加载完成
React hydration（把事件处理器绑到已有 DOM 上）
      │
      ▼
页面可交互
```

---

### Hydration Mismatch

サーバー側でレンダリングされた HTML とクライアント側で React が生成する DOM が一致しない場合、React はエラーを報告して修復を試みる（ちらつきが発生する可能性がある）：

```tsx
// ❌ 服务端和客户端渲染结果不同
function Greeting() {
  return <p>现在时间: {new Date().toLocaleTimeString()}</p>;
  // 服务端: "10:00:00"，客户端 hydration 时: "10:00:01" → mismatch
}

// ❌ 服务端没有 window
function Sidebar() {
  const isMobile = window.innerWidth < 768; // 服务端报错
  return isMobile ? <MobileNav /> : <DesktopNav />;
}
```

修正方法：

```tsx
// ✅ 方案 1: useEffect 延迟到客户端
function Greeting() {
  const [time, setTime] = useState<string>("");

  useEffect(() => {
    setTime(new Date().toLocaleTimeString());
  }, []); // 只在客户端执行

  return <p>现在时间: {time || "加载中..."}</p>;
}

// ✅ 方案 2: suppressHydrationWarning（已知差异）
<time suppressHydrationWarning>
  {new Date().toLocaleTimeString()}
</time>

// ✅ 方案 3: 动态导入跳过 SSR
import dynamic from "next/dynamic";
const Chart = dynamic(() => import("./Chart"), { ssr: false });
```

::: warning よくある Hydration Mismatch の原因

- **時刻/乱数**：サーバー側とクライアント側で実行タイミングが異なる
- **ブラウザ API**：`window`、`localStorage`、`navigator` はサーバー側に存在しない
- **ブラウザ拡張機能**：DOM 構造を変更する（翻訳プラグインが追加のタグを挿入するなど）
- **HTML ネストエラー**：`<p>` 内に `<div>` がネストされ、ブラウザの自動修正により構造が異なる

:::
