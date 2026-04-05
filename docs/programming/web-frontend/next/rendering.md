# 渲染策略

> SSR / SSG / ISR / Streaming / Server Components / Server Actions

## Server Components

App Router 中组件**默认是 Server Component**——在服务端执行，不发送 JS 到客户端

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
| 数据获取 | `async/await` 直接获取 | `useEffect` / TanStack Query |
| 访问后端资源 | ✅ 数据库、文件系统、环境变量 | ❌ |
| 发送 JS 到客户端 | ❌ 零 JS | ✅ 会增加 bundle |
| useState / useEffect | ❌ | ✅ |
| 事件处理（onClick 等） | ❌ | ✅ |
| 浏览器 API | ❌ | ✅ |
| Context | ❌ | ✅ |

::: warning 边界划分原则

- **默认用 Server Component**——能在服务端做的就不要搬到客户端
- **需要交互时才用 Client Component**：`useState`、`useEffect`、事件处理、浏览器 API
- **`"use client"` 是边界**：标记后该文件及其 import 的所有模块都变成客户端代码
- **把 `"use client"` 下推到最小范围**：只给真正需要交互的叶子组件标记，不要在顶层 layout 标记

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

> Server-Side Rendering — 每次请求在服务端渲染

App Router 中使用动态数据（`cookies()`、`headers()`、未缓存的 `fetch`）时自动触发 SSR：

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

> Static Site Generation — 构建时生成静态 HTML

没有动态数据源的页面自动走 SSG：

```tsx
// 构建时运行一次，生成静态 HTML
export default async function AboutPage() {
  const content = await getMarkdownContent("about");
  return <article dangerouslySetInnerHTML={{ __html: content }} />;
}
```

动态路由的 SSG 需要 `generateStaticParams`：

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

> Incremental Static Regeneration — 静态页面 + 后台定时重新生成

兼顾 SSG 的性能和 SSR 的数据新鲜度：

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

按需触发重新生成（不等定时）：

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

流式渲染——先发送页面骨架，再逐步发送数据准备好的部分：

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

::: tip `loading.tsx` 就是页面级的 Streaming

`loading.tsx` 文件会被自动包裹为 `<Suspense fallback={<Loading />}>`，整个 `page.tsx` 准备好前显示 loading UI

:::

---

## Server Actions

服务端函数，可以直接在客户端表单或事件处理中调用——不需要手动创建 API 端点：

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

Client Component 中使用 Server Actions：

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

::: warning Server Actions 的注意点

- `"use server"` 标记的函数会暴露为可远程调用的端点，参数通过网络传输——不要传大对象
- 参数必须可序列化（不能传函数、DOM 元素等）
- 需要自己做输入验证（用 Zod 等），因为任何人都可以直接调用这个端点
- 适合表单提交、数据变更等 mutation 场景，不适合数据获取（用 Server Component 获取）

:::

---

## 渲染策略选择

| 场景 | 策略 | 原因 |
| --- | --- | --- |
| 博客文章、文档、营销页面 | **SSG** | 内容不常变，构建时生成最快 |
| 电商商品页 | **ISR** | 价格/库存会变但不需要实时，定时更新即可 |
| 用户 dashboard、个性化页面 | **SSR** | 每个用户看到不同内容，需要实时数据 |
| 数据加载慢的页面 | **Streaming** | 先发送骨架，逐步填充，不阻塞首屏 |
| 静态页面 + 少量交互 | **RSC + Client Component** | 大部分内容服务端渲染，只有交互部分发 JS |

---

## Hydration

SSR 的 HTML 到达浏览器后，React 需要**hydration**（注水）——将静态 HTML 和 React 组件树关联起来，绑定事件处理器

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

服务端渲染的 HTML 和客户端 React 生成的 DOM 不一致时，React 会报错并尝试修复（可能导致闪烁）：

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

修复方式：

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

::: warning 常见 Hydration Mismatch 原因

- **时间/随机数**：服务端和客户端执行时间不同
- **浏览器 API**：`window`、`localStorage`、`navigator` 在服务端不存在
- **浏览器扩展**：修改了 DOM 结构（如翻译插件插入了额外标签）
- **HTML 嵌套错误**：`<p>` 里嵌了 `<div>`，浏览器自动修正导致结构不同

:::
