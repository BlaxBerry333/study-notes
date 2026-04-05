# tRPC + Next.js

本記事では Next.js App Router のフルスタックプロジェクトを例に説明する

## ディレクトリ構成

```txt
/
└── src
    ├── app
    │   └── api
    │       └── trpc
    │           └── [...trpc]
    │               └── route.ts
    ├── server
    │   ├── procedures
    │   │   └── ...
    │   ├── middlewares
    │   │   └── ...
    │   └── router.ts
    │
    └── shared
        └── trpc/
            └── ...
```

## 共通モジュール

### 初期化

::: code-group

```ts [基本的な初期化]
import { initTRPC } from "@trpc/server";

export const t = initTRPC.create();
```

```ts [コンテキストオブジェクト付きの初期化]
import { initTRPC } from "@trpc/server";
import type { Context型 } from "コンテキスト定義ファイル";

export const t = initTRPC.context<Context型>().create();
```

:::

---

## サーバー側

主に tRPC の [ルーター（Router）](/ja/programming/web-backend/trpc/sample-next#ルーター)、[プロシージャ（Procedure）](/ja/programming/web-backend/trpc/sample-next#プロシージャ)、[コンテキスト（Context）](/ja/programming/web-backend/trpc/sample-next#コンテキスト) を定義する

---

### ルーター

> Router

tRPC ルーターは各 [プロシージャ](#プロシージャ) を整理・登録するオブジェクトである

`router()` メソッドで作成し、型をエクスポートする

```ts
import { t } from "初期化定義ファイル";
import { プロシージャ1, プロシージャ2 } from "プロシージャ定義ファイル";

export const サーバールーター = t.router({
  プロシージャ1,
  プロシージャ2,
});

export type サーバールーター型 = typeof サーバールーター;
```

---

### プロシージャ

> Procedure

tRPC プロシージャは、明確なリクエストを処理しレスポンスを返すことができる関数である

`t.procedure` で定義し、[ルーター](#ルーター) 内で統合する

`query()`、`mutation()`、`subscription()` メソッドでクエリ、変更、サブスクリプションを実装できる

`input()` メソッドでリクエストパラメータの型バリデーションを追加できる（Zod でバリデーション可能）

```ts
import { t } from "初期化定義ファイル";

const パラメータなしクエリ = t.procedure.query(async ({ ctx }) => {
  return データ;
});

const パラメータありクエリ = t.procedure
  .input(パラメータZodSchema)
  .query(async ({ ctx, input }) => {
    return データ;
  });

const 変更プロシージャ = t.procedure
  .input(パラメータZodSchema)
  .mutation(async ({ ctx, input }) => {
    return データ;
  });

const サブスクリプション = t.procedure
  .input(パラメータZodSchema)
  .subscription(async ({ ctx, input }) => {
    return データ;
  });

const trpcServerRouter = t.router({
  パラメータなしクエリ,
  パラメータありクエリ,
  変更プロシージャ,
  サブスクリプション,
});
```

複数のプロシージャは `unstable_concat()` メソッドで新しいプロシージャに統合でき、統合元のすべてのミドルウェアを継承する

```ts
const プロシージャ1 = ...;
const プロシージャ2 = ...;

const 新しいプロシージャ = プロシージャ1.unstable_concat(プロシージャ2);
```

::: details 例: tRPC プロシージャの2つの定義方法

::: code-group

```ts [方法1（インラインで定義）]
import { initTRPC, TRPCError } from "@trpc/server";

const t = initTRPC.context<Context型>().create();

const trpcServerRouter = t.router({
  queryData: t.procedure.input(パラメータZodSchema).query(async ({ ctx, input }) => {
    return データ;
  }),

  mutationData: t.procedure
    .input(パラメータZodSchema)
    .mutation(async ({ ctx, input }) => {
      return データ;
    }),
});
```

```ts [方法2（外部に分離）]
import type { NextRequest, NextResponse } from "next/server";
import { initTRPC, TRPCError } from "@trpc/server";

const t = initTRPC.context<Context型>().create();

const queryData = t.procedure
  .input(パラメータZodSchema)
  .query(async ({ ctx, input }) => {
    return データ;
  });

const mutationData = t.procedure
  .input(パラメータZodSchema)
  .mutation(async ({ ctx, input }) => {
    return データ;
  });

const trpcServerRouter = t.router({
  queryData,
  mutationData,
});
```

:::

:::

---

### ミドルウェア

> Middleware

tRPC ミドルウェアは [プロシージャ](#プロシージャ) の前（プレミドルウェア）または後（ポストミドルウェア）に実行できる関数である

`t.middleware()` メソッドで定義する

例外処理時にはエラーオブジェクト `new TRPCError()` を throw してクライアント側でキャッチさせることができる

```ts
import { TRPCError } from "@trpc/server";
import { t } from "初期化定義ファイル";

export const プレミドルウェア = t.middleware(async ({ ctx, next }) => {
  if (条件) {
    throw new TRPCError({ code: "...", message: "..." });
  }
  return next();
});

export const ポストミドルウェア = t.middleware(async ({ ctx, next }) => {
  const result = await next();
  return result;
});
```

ミドルウェアは `next()` のパラメータ `ctx` でコンテキストオブジェクトの値を拡張できる

```ts
const プレミドルウェア = t.middleware(async ({ ctx, next }) => {
  return next({
    ctx: {
      // ...拡張値
    },
  });
});
```

複数のミドルウェアは `unstable_pipe()` メソッドで新しいミドルウェアに統合できる

```ts
const ミドルウェア1 = ...;
const ミドルウェア2 = ...;

const 新しいミドルウェア = ミドルウェア1.unstable_pipe(ミドルウェア2);
```

ミドルウェアは `use()` メソッドで [プロシージャ](#プロシージャ) に追加する。`use()` でミドルウェアを追加すると、チェーン可能な新しいプロシージャが返される

```ts
const ミドルウェア付きプロシージャ = t.procedure.use(ミドルウェア1);

const ミドルウェア付きプロシージャ = t.procedure.use(ミドルウェア1).use(ミドルウェア2);

const ミドルウェア付きプロシージャ = ミドルウェア付きプロシージャ.use(ミドルウェア3);
```

::: details 例: tRPC ミドルウェアの2つの定義方法

::: code-group

```ts [方法1（インラインで定義）]
import { initTRPC, TRPCError } from "@trpc/server";

const t = initTRPC.context<Context型>().create();

const trpcServerRouter = t.router({
  queryData: t.procedure
    // プレミドルウェア
    .use(async ({ ctx, next }) => {
      // ...
      if (条件) {
        throw new TRPCError({ code: "...", message: "..." });
      }
      return next();
    })
    // ポストミドルウェア
    .use(async ({ ctx, next }) => {
      const result = await next();
      // ...
      return result;
    })
    .input(パラメータZodSchema)
    .query(async ({ ctx, input }) => {
      return データ;
    }),
});
```

```ts [方法2（外部に分離）]
import type { NextRequest, NextResponse } from "next/server";
import { initTRPC, TRPCError } from "@trpc/server";

const t = initTRPC.context<Context型>().create();

const プレミドルウェア = t.middleware(async ({ ctx, next }) => {
  //...
  if (条件) {
    throw new TRPCError({ code: "...", message: "..." });
  }
  return next();
});

const ポストミドルウェア = t.middleware(async ({ ctx, next }) => {
  const result = await next();
  //...
  return result;
});

const trpcServerRouter = t.router({
  queryData: t.procedure
    .use(プレミドルウェア)
    .use(ポストミドルウェア)
    .input(パラメータZodSchema)
    .query(async ({ ctx, input }) => {
      return データ;
    }),
});
```

:::

:::

---

### コンテキスト

> Context

tRPC コンテキストは [プロシージャ](#プロシージャ) 間でデータを受け渡すためのオブジェクトである

まずコンテキスト生成関数を定義してコンテキストを作成し、型をエクスポートする

```ts
import type { NextRequest, NextResponse } from "next/server";
import { initTRPC } from "@trpc/server";

export async function コンテキスト生成関数(req: NextRequest, res: NextResponse) {
  return データ;
}

const t = initTRPC.context<typeof コンテキスト生成関数>().create();
```

コンテキストオブジェクトは [プロシージャ](#プロシージャ)、[ミドルウェア](#ミドルウェア) 内でパラメータの `ctx` を通じてアクセスできる

```ts
import { t } from "初期化定義ファイル";

const クエリプロシージャ = t.procedure.query(async ({ ctx }) => {
  // ...
  return データ;
});
```

## クライアント側

フロントエンドでは [クライアントオブジェクト](#クライアントオブジェクト) を通じて対応する [プロシージャ](#プロシージャ) を呼び出してリクエストを処理する

これらのプロシージャ呼び出しは [API Handler](#api-handler) によって HTTP リクエストに変換されサーバーに送信される

---

### クライアントオブジェクト

> tRPC Client

tRPC クライアントオブジェクトは [プロシージャ](#プロシージャ) を呼び出して具体的なリクエストを処理するオブジェクトである

`createTRPCClient()` メソッドとサーバー側で定義した [ルーター](#ルーター) の型定義を組み合わせて作成する

```ts
import { createTRPCClient, httpBatchLink } from "@trpc/client";
import type { サーバールーター型 } from "ルーター定義ファイル";

export const trpcClient = createTRPCClient<サーバールーター型>({
  links: [
    httpBatchLink({
      url: "http://localhost:[ポート]/api/trpc",
    }),
  ],
});
```

---

### API Handler

Next.js ではクライアントページからのリクエストを API Handler で受け取り、対応する [プロシージャ](#プロシージャ) にディスパッチする

`fetchRequestHandler()` メソッドで [ルーター](#ルーター)、[コンテキスト生成関数](#コンテキスト) を指定する

::: code-group

```ts [/src/app/api/trpc/[...trpc]/route.ts]
import { NextRequest, NextResponse } from "next/server";
import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { コンテキスト生成関数 } from "コンテキスト定義ファイル";
import { サーバールーター } from "ルーター定義ファイル";

const handler = (req: NextRequest, res: NextResponse) => {
  return fetchRequestHandler({
    endpoint: "/api/trpc",
    req,
    router: サーバールーター,
    createContext: () => コンテキスト生成関数(req, res),
  });
};

export { handler as GET, handler as POST };
```

:::

---

### プロシージャの呼び出し

ページコンポーネント内で [クライアントオブジェクト](#クライアントオブジェクト) を通じて対応する [プロシージャ](#プロシージャ) を呼び出しリクエストを処理する

```ts
"use client";

import { useState, useEffect } from "react";
import { クライアントオブジェクト } from "クライアントオブジェクト定義ファイル";

function コンポーネント() {
  const [data, setData] = useState<データ型>();
  const [isLoading, setIsLoading] = useState<boolean>(false);

  useEffect(() => {
    setIsLoading(true);
    (async () => {
      try {
        const data1 = await クライアントオブジェクト.クエリプロシージャ名.query();
        const data2 = await クライアントオブジェクト.クエリプロシージャ名.query(パラメータ);
        const data3 = await クライアントオブジェクト.変更プロシージャ名.mutation(パラメータ);
        setData({ data1, data2, data3 });
        setIsLoading(false);
      } catch (error) {
        console.error(error);
        setIsLoading(false);
      }
    })();
  }, []);

  if (isLoading) {
    return <>Loading...</>;
  }
  return <>{JSON.stringify(data)}</>;
}
```
