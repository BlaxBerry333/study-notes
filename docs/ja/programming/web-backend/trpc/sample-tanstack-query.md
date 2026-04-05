# tRPC + TanStack Query

クライアント側で TanStack Query を使用すると、[プロシージャ（Procedure）](/ja/programming/web-backend/trpc/sample-next#プロシージャ) の呼び出しによるリクエスト処理をさらに簡略化できる

tRPC は2つの統合パッケージを提供しており、書き方と設計思想が異なる：

|          | `@trpc/tanstack-react-query`                             | `@trpc/react-query`       |
| -------- | -------------------------------------------------------- | ------------------------- |
| 説明     | TanStack Query ネイティブ、新規プロジェクトに推奨         | tRPC ラッパー、新機能の追加なし |
| 作成方法 | `createTRPCContext()`                                    | `createTRPCReact()`       |
| 使用スタイル | `useTRPC()` + <br>`useQuery(trpc.プロシージャ名.queryOptions())` | `trpc.プロシージャ名.useQuery()`  |

## @trpc/tanstack-react-query

```zsh
% npm install @trpc/tanstack-react-query
```

---

### クエリツール集

サーバー側で定義した [ルーター（Router）](/ja/programming/web-backend/trpc/sample-next#ルーター) の型に基づき、tRPC 統合のユーティリティ関数群を作成する

```ts
import { createTRPCContext } from "@trpc/tanstack-react-query";
import type { サーバールーター型 } from "ルーター定義ファイル";

export const { TRPCProvider, useTRPC, useTRPCClient } =
  createTRPCContext<サーバールーター型>();
```

---

### QueryProvider

Provider 内で tRPC クライアントと QueryClient を作成し、[クエリツール集](#クエリツール集) と組み合わせてアプリケーション全体をラップする

```tsx
"use client";

import { useState, type PropsWithChildren } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createTRPCClient, httpBatchLink } from "@trpc/client";
import { TRPCProvider } from "クエリツール集定義ファイル";
import type { サーバールーター型 } from "ルーター定義ファイル";

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
    createTRPCClient<サーバールーター型>({
      links: [
        httpBatchLink({
          url: "http://localhost:[ポート]/api/trpc",
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

### プロシージャの呼び出し

QueryProvider コンポーネント内で TanStack Query のネイティブフック `useQuery()`（クエリ）、`useMutation()`（変更）と [クエリツール集](#クエリツール集) の `useTRPC()` を組み合わせて [プロシージャ（Procedure）](/ja/programming/web-backend/trpc/sample-next#プロシージャ) を呼び出す

```tsx
"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTRPC } from "クエリツール集定義ファイル";

function コンポーネント() {
  const queryClient = useQueryClient();

  const trpc = useTRPC();
  const { data, isLoading } = useQuery(trpc.プロシージャ名.queryOptions());
  const { data, isLoading } = useQuery(
    trpc.プロシージャ名.queryOptions(
      {
        /** パラメータ */
      },
      {
        /** TanStack React Query の設定 */
      },
    ),
  );

  const { mutateAsync, isPending } = useMutation(
    trpc.プロシージャ名.mutationOptions({
      onSuccess: () => {
        const myQueryKey = trpc.プロシージャ名.queryKey();
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

### tRPC Hooks の作成

サーバー側で定義した [ルーター（Router）](/ja/programming/web-backend/trpc/sample-next#ルーター) の型に基づき、tRPC のフック関数群を作成する

```ts
import { createTRPCReact } from "@trpc/react-query";
import type { サーバールーター型 } from "ルーター定義ファイル";

export const trpc = createTRPCReact<サーバールーター型>();
```

---

### QueryProvider {#classic-query-provider}

`trpc` オブジェクトに基づきクライアントを作成し、アプリケーション全体をラップする

```tsx
"use client";

import { useState, type PropsWithChildren } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { httpBatchLink } from "@trpc/client";
import { trpc } from "tRPC Hooks定義ファイル";

export default function Providers({ children }: PropsWithChildren) {
  const [queryClient] = useState(() => new QueryClient());
  const [trpcClient] = useState(() =>
    trpc.createClient({
      links: [
        httpBatchLink({
          url: "http://localhost:[ポート]/api/trpc",
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

### プロシージャの呼び出し {#classic-プロシージャの呼び出し}

`trpc` オブジェクトを通じて直接 [プロシージャ（Procedure）](/ja/programming/web-backend/trpc/sample-next#プロシージャ) を呼び出す。ネイティブの TanStack Query フックを使用する必要はない

```tsx
"use client";

import { trpc } from "tRPC Hooks定義ファイル";

function コンポーネント() {
  const { data, isLoading } = trpc.プロシージャ名.useQuery();
  const { data, isLoading } = trpc.プロシージャ名.useQuery(パラメータ);

  const { mutateAsync, isPending } = trpc.プロシージャ名.useMutation();

  return <>...</>;
}
```
