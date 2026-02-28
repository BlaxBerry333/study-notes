# tRPC + TanstackQuery

在客户端中可以使用 TanstackQuery 进一步简化对调用 [过程 ( Procedure )](/programming/web-backend/trpc/sample-next#过程) 的处理请求

tRPC 提供了两个集成包，写法和设计思路不同：

|          | `@trpc/tanstack-react-query`                             | `@trpc/react-query`       |
| -------- | -------------------------------------------------------- | ------------------------- |
| 说明     | TanStack Query 原生，推荐新项目使用                      | tRPC 封装，不再添加新功能 |
| 创建方式 | `createTRPCContext()`                                    | `createTRPCReact()`       |
| 使用风格 | `useTRPC()` + <br>`useQuery(trpc.过程名.queryOptions())` | `trpc.过程名.useQuery()`  |

## @trpc/tanstack-react-query

```zsh
% npm install @trpc/tanstack-react-query
```

---

### 查询工具集合

基于在服务端定义的 [路由器 ( Router )](/programming/web-backend/trpc/sample-next#路由器) 的类型创建 tRPC 集成的工具函数集合

```ts
import { createTRPCContext } from "@trpc/tanstack-react-query";
import type { 服务端路由器类型 } from "定义路由的文件";

export const { TRPCProvider, useTRPC, useTRPCClient } =
  createTRPCContext<服务端路由器类型>();
```

---

### QueryProvider

在 Provider 中创建 tRPC 客户端与 QueryClient，结合 [查询工具集合](#查询工具集合) 包裹主应用

```tsx
"use client";

import { useState, type PropsWithChildren } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createTRPCClient, httpBatchLink } from "@trpc/client";
import { TRPCProvider } from "定义查询工具集合的文件";
import type { 服务端路由器类型 } from "定义路由的文件";

let browserQueryClient: QueryClient | undefined = undefined;

function makeQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 60 * 1000,
      },
    },
  });
}

function getQueryClient(): QueryClient {
  if (typeof window === "undefined") {
    return makeQueryClient();
  }
  if (!browserQueryClient) {
    browserQueryClient = makeQueryClient();
  }
  return browserQueryClient;
}

export default function Providers({ children }: PropsWithChildren) {
  const queryClient = getQueryClient();
  const [trpcClient] = useState(() =>
    createTRPCClient<服务端路由器类型>({
      links: [
        httpBatchLink({
          url: "http://localhost:[端口]/api/trpc",
        }),
      ],
    }),
  );

  return (
    <QueryClientProvider client={queryClient}>
      <TRPCProvider trpcClient={trpcClient} queryClient={queryClient}>
        {children}
      </TRPCProvider>
    </QueryClientProvider>
  );
}
```

---

### 调用过程

在 QueryProvider 组件内使用 TanStackQuery 的原生钩子函数`useQuery()`( 查询 )、`useMutation()`( 变更 ) 结合 [查询工具集合](#查询工具集合) 中的`useTRPC()`调用 [过程 ( Procedure )](/programming/web-backend/trpc/sample-next#过程)

```tsx
"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTRPC } from "定义查询工具集合的文件";

function 组件() {
  const queryClient = useQueryClient();

  const trpc = useTRPC();
  const { data, isLoading } = useQuery(trpc.过程名.queryOptions());
  const { data, isLoading } = useQuery(
    trpc.过程名.queryOptions(
      {
        /** 参数 */
      },
      {
        /** Tanstack React Query 配置 */
      },
    ),
  );

  const { mutateAsync, isPending } = useMutation(
    trpc.过程名.mutationOptions({
      onSuccess: () => {
        const myQueryKey = trpc.过程名.queryKey();
        queryClient.invalidateQueries({ queryKey: myQueryKey });
      },
    }),
  );

  return <>...</>;
}
```

## @trpc/react-query

```zsh
% npm install @trpc/react-query
```

---

### 创建 tRPC Hooks

基于在服务端定义的 [路由器 ( Router )](/programming/web-backend/trpc/sample-next#路由器) 的类型创建 tRPC 的钩子函数集合

```ts
import { createTRPCReact } from "@trpc/react-query";
import type { 服务端路由器类型 } from "定义路由的文件";

export const trpc = createTRPCReact<服务端路由器类型>();
```

---

### QueryProvider {#classic-query-provider}

基于`trpc`对象创建客户端并包裹主应用

```tsx
"use client";

import { useState, type PropsWithChildren } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { httpBatchLink } from "@trpc/client";
import { trpc } from "定义tRPC Hooks的文件";

export default function Providers({ children }: PropsWithChildren) {
  const [queryClient] = useState(() => new QueryClient());
  const [trpcClient] = useState(() =>
    trpc.createClient({
      links: [
        httpBatchLink({
          url: "http://localhost:[端口]/api/trpc",
        }),
      ],
    }),
  );

  return (
    <trpc.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </trpc.Provider>
  );
}
```

---

### 调用过程 {#classic-调用过程}

直接通过`trpc`对象调用 [过程 ( Procedure )](/programming/web-backend/trpc/sample-next#过程)，无需使用原生 TanStack Query 钩子

```tsx
"use client";

import { trpc } from "定义tRPC Hooks的文件";

function 组件() {
  const { data, isLoading } = trpc.过程名.useQuery();
  const { data, isLoading } = trpc.过程名.useQuery(参数);

  const { mutateAsync, isPending } = trpc.过程名.useMutation();

  return <>...</>;
}
```
