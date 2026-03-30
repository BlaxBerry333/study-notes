# tRPC + Next.js

本文以 Next.js App Router 全栈项目为例

## 目录结构

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

## 公共模块

### 初始化

::: code-group

```ts [基本初始化]
import { initTRPC } from "@trpc/server";

export const t = initTRPC.create();
```

```ts [携带上下文对象的初始化]
import { initTRPC } from "@trpc/server";
import type { Context类型 } from "定义上下文的文件";

export const t = initTRPC.context<Context类型>().create();
```

:::

---

## 服务端

主要定义 tRPC 的 [路由器 ( Router )](/programming/web-backend/trpc/sample-next#路由器)、[过程 ( Procedure )](/programming/web-backend/trpc/sample-next#过程)、[上下文 ( Context )](/programming/web-backend/trpc/sample-next#上下文)

---

### 路由器

> Router

tRPC 路由器是一个对象，用于组织各个具体的 [过程](#过程)

通过方法`router()`创建，然后导出类型

```ts
import { t } from "定义初始化的文件";
import { 过程1, 过程2 } from "定义过程的文件";

export const 服务端路由器 = t.router({
  过程1,
  过程2,
});

export type 服务端路由器类型 = typeof 服务端路由器;
```

---

### 过程

> Procedure

tRPC 过程是一个函数，用于处理明确的请求并可以返回响应

通过`t.procedure`定义，然后在 [路由器](#路由器) 中整合

可通过方法`query()`、`mutation()`、`subscription()`来实现查询、变更、订阅

可通过方法`input()`添加请求的参数的类型校验（ 可以通过 Zod 进行校验 ）

```ts
import { t } from "定义初始化的文件";

const 查询过程无参数 = t.procedure.query(async ({ ctx }) => {
  return 数据;
});

const 查询过程有参数 = t.procedure
  .input(参数ZodSchema)
  .query(async ({ ctx, input }) => {
    return 数据;
  });

const 变更过程 = t.procedure
  .input(参数ZodSchema)
  .mutation(async ({ ctx, input }) => {
    return 数据;
  });

const 订阅过程 = t.procedure
  .input(参数ZodSchema)
  .subscription(async ({ ctx, input }) => {
    return 数据;
  });

const trpcServerRouter = t.router({
  查询过程无参数,
  查询过程有参数,
  变更过程,
  订阅过程,
});
```

多个过程可以通过方法`unstable_concat()`合并为一个新的过程，继承合并过程的所有中间件

```ts
const 过程1 = ...;
const 过程2 = ...;

const 新的过程 = 过程1.unstable_concat(过程2);
```

::: details 例子: tRPC过程的两种定义写法

::: code-group

```ts [写法一 ( 直接定义 )]
import { initTRPC, TRPCError } from "@trpc/server";

const t = initTRPC.context<Context类型>().create();

const trpcServerRouter = t.router({
  queryData: t.procedure.input(参数ZodSchema).query(async ({ ctx, input }) => {
    return 数据;
  }),

  mutationData: t.procedure
    .input(参数ZodSchema)
    .mutation(async ({ ctx, input }) => {
      return 数据;
    }),
});
```

```ts [写法二 ( 外部抽离 )]
import type { NextRequest, NextResponse } from "next/server";
import { initTRPC, TRPCError } from "@trpc/server";

const t = initTRPC.context<Context类型>().create();

const queryData = t.procedure
  .input(参数ZodSchema)
  .query(async ({ ctx, input }) => {
    return 数据;
  });

const mutationData = t.procedure
  .input(参数ZodSchema)
  .mutation(async ({ ctx, input }) => {
    return 数据;
  });

const trpcServerRouter = t.router({
  queryData,
  mutationData,
});
```

:::

:::

---

### 中间件

> Middleware

tRPC 中间件是一个函数，可以运行在 [过程](#过程) 之前 ( 前置中间件 ) 或之后 ( 后置中间件 )

通过方法`t.middleware()`定义

处理异常时可抛出错误对象`new TRPCError()`供在客户端捕获

```ts
import { TRPCError } from "@trpc/server";
import { t } from "定义初始化的文件";

export const 前置中间件 = t.middleware(async ({ ctx, next }) => {
  if (条件) {
    throw new TRPCError({ code: "...", message: "..." });
  }
  return next();
});

export const 后置中间件 = t.middleware(async ({ ctx, next }) => {
  const result = await next();
  return result;
});
```

中间件可以在`next()`的参数`ctx`中对上下文对象的值进行扩展

```ts
const 前置中间件 = t.middleware(async ({ ctx, next }) => {
  return next({
    ctx: {
      // ...扩展赋值
    },
  });
});
```

多个中间件可以通过方法`unstable_pipe()`合并为一个新的中间件

```ts
const 中间件1 = ...;
const 中间件2 = ...;

const 新的中间件 = 中间件1.unstable_pipe(中间件2);
```

中间件需要通过方法`use()`添加到 [过程](#过程) 中，调用方法`use()`添加了中间件之后返回一个新的可继续链式调用的过程

```ts
const 使用了中间件的过程 = t.procedure.use(中间件1);

const 使用了中间件的过程 = t.procedure.use(中间件1).use(中间件2);

const 使用了中间件的过程 = 使用了中间件的过程.use(中间件3);
```

::: details 例子: tRPC中间件的两种定义写法

::: code-group

```ts [写法一 ( 直接定义 )]
import { initTRPC, TRPCError } from "@trpc/server";

const t = initTRPC.context<Context类型>().create();

const trpcServerRouter = t.router({
  queryData: t.procedure
    // 前置中间件
    .use(async ({ ctx, next }) => {
      // ...
      if (条件) {
        throw new TRPCError({ code: "...", message: "..." });
      }
      return next();
    })
    // 后置中间件
    .use(async ({ ctx, next }) => {
      const result = await next();
      // ...
      return result;
    })
    .input(参数ZodSchema)
    .query(async ({ ctx, input }) => {
      return 数据;
    }),
});
```

```ts [写法二 ( 外部抽离 )]
import type { NextRequest, NextResponse } from "next/server";
import { initTRPC, TRPCError } from "@trpc/server";

const t = initTRPC.context<Context类型>().create();

const 前置中间件 = t.middleware(async ({ ctx, next }) => {
  //...
  if (条件) {
    throw new TRPCError({ code: "...", message: "..." });
  }
  return next();
});

const 后置中间件 = t.middleware(async ({ ctx, next }) => {
  const result = await next();
  //...
  return result;
});

const trpcServerRouter = t.router({
  queryData: t.procedure
    .use(前置中间件)
    .use(后置中间件)
    .input(参数ZodSchema)
    .query(async ({ ctx, input }) => {
      return 数据;
    }),
});
```

:::

:::

---

### 上下文

> Context

tRPC 上下文是一个对象，用于在 [过程](#过程) 中传递数据

需要先定义一个上下文生成器函数去创建上下文，然后导出类型

```ts
import type { NextRequest, NextResponse } from "next/server";
import { initTRPC } from "@trpc/server";

export async function 上下文生成器(req: NextRequest, res: NextResponse) {
  return 数据;
}

const t = initTRPC.context<typeof 上下文生成器>().create();
```

上下文对象在 [过程](#过程)、[中间件](#中间件) 中可以通过参数中的`ctx`访问

```ts
import { t } from "定义初始化的文件";

const 查询过程 = t.procedure.query(async ({ ctx }) => {
  // ...
  return 数据;
});
```

## 客户端

前端通过 [客户端对象](#客户端对象) 调用对应的 [过程](#过程) 处理请求

这些过程的调用需要通过 [API Handler](#api-handler) 转为 HTTP 请求发送给服务端

---

### 客户端对象

> tRPC Client

tRPC 客户端对象是一个对象，用于调用 [过程](#过程) 处理具体的请求

通过方法`createTRPCClient()`并结合在服务端定义的 [路由器](#路由器) 的类型定义

```ts
import { createTRPCClient, httpBatchLink } from "@trpc/client";
import type { 服务端路由器类型 } from "定义路由的文件";

export const trpcClient = createTRPCClient<服务端路由器类型>({
  links: [
    httpBatchLink({
      url: "http://localhost:[端口]/api/trpc",
    }),
  ],
});
```

---

### API Handler

Next.js 通过 API Handler 接收客户端页面的请求后分发给对应的 [过程](#过程)

通过方法`fetchRequestHandler()`指定 [路由器](#路由器)、[上下文生成器](#上下文)

::: code-group

```ts [/src/app/api/trpc/[...trpc]/route.ts]
import { NextRequest, NextResponse } from "next/server";
import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { 上下文生成器 } from "定义上下文的文件";
import { 服务端路由器 } from "定义路由的文件";

const handler = (req: NextRequest, res: NextResponse) => {
  return fetchRequestHandler({
    endpoint: "/api/trpc",
    req,
    router: 服务端路由器,
    createContext: () => 上下文生成器(req, res),
  });
};

export { handler as GET, handler as POST };
```

:::

---

### 调用过程

页面组件内通过 [客户端对象](#客户端对象) 调用对应的 [过程](#过程) 处理请求

```ts
"use client";

import { useState, useEffect } from "react";
import { 客户端对象 } from "定义客户端对象的文件";

function 组件() {
  const [data, setData] = useState<数据类型>();
  const [isLoading, setIsLoading] = useState<boolean>(false);

  useEffect(() => {
    setIsLoading(true);
    (async () => {
      try {
        const data1 = await 客户端对象.查询过程名.query();
        const data2 = await 客户端对象.查询过程名.query(参数);
        const data3 = await 客户端对象.变更过程名.mutation(参数);
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
