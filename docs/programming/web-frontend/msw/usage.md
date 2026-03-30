# 基本使用

## 推荐目录结构

```txt
src/
└── mocks/
    ├── handlers.ts      ← 所有 handler 的汇总导出
    ├── handlers/
    │   ├── user.ts      ← 按资源/功能模块拆分
    │   └── post.ts
    ├── browser.ts       ← setupWorker（开发环境）
    └── server.ts        ← setupServer（测试环境）
```

handler 按模块拆分后在 `handlers.ts` 中汇总：

```ts
import { userHandlers } from "./handlers/user";
import { postHandlers } from "./handlers/post";

export const handlers = [...userHandlers, ...postHandlers];
```

---

## 1. 定义 Handler

匹配请求 → 返回模拟响应：

::: code-group

```ts [REST API — src/mocks/handlers.ts]
import { http, HttpResponse } from "msw";

export const handlers = [
  http.get("/api/users", () => {
    return HttpResponse.json([
      { id: 1, name: "Alice" },
      { id: 2, name: "Bob" },
    ]);
  }),

  http.get("/api/users/:id", ({ params }) => {
    return HttpResponse.json({ id: Number(params.id), name: "Alice" });
  }),

  http.post("/api/users", async ({ request }) => {
    const body = await request.json();
    return HttpResponse.json({ id: 3, ...body }, { status: 201 });
  }),

  http.delete("/api/users/:id", () => {
    return new HttpResponse(null, { status: 204 });
  }),
];
```

```ts [GraphQL — src/mocks/handlers.ts]
import { graphql, HttpResponse } from "msw";

export const handlers = [
  graphql.query("GetUser", ({ variables }) => {
    return HttpResponse.json({
      data: { user: { id: variables.id, name: "Alice" } },
    });
  }),

  graphql.mutation("CreateUser", ({ variables }) => {
    return HttpResponse.json({
      data: { createUser: { id: 1, ...variables } },
    });
  }),
];
```

:::

---

### 动态响应

根据请求参数返回不同响应：

```ts
http.get("/api/users", ({ request }) => {
  const url = new URL(request.url);
  const page = url.searchParams.get("page") ?? "1";

  return HttpResponse.json({
    page: Number(page),
    users: [
      /* ... */
    ],
  });
});
```

---

### 错误模拟

```ts
// HTTP 错误
http.get("/api/users", () => {
  return HttpResponse.json(
    { message: "Internal Server Error" },
    { status: 500 },
  );
});

// 网络错误（请求根本无法到达服务端）
http.get("/api/users", () => {
  return HttpResponse.error();
});
```

---

### 延迟响应

```ts
import { http, HttpResponse, delay } from "msw";

http.get("/api/users", async () => {
  await delay(2000); // 延迟 2 秒
  return HttpResponse.json([
    /* ... */
  ]);
});

// 无限延迟（用于测试 loading 状态）
http.get("/api/users", async () => {
  await delay("infinite");
  return HttpResponse.json([]);
});
```

---

## 2. 创建拦截实例

::: code-group

```ts [浏览器端 — src/mocks/browser.ts]
import { setupWorker } from "msw/browser";
import { handlers } from "./handlers";

export const worker = setupWorker(...handlers);
```

```ts [Node.js 端 — src/mocks/server.ts]
import { setupServer } from "msw/node";
import { handlers } from "./handlers";

export const server = setupServer(...handlers);
```

:::

---

## 3. 接入应用

::: code-group

```ts [应用入口（开发环境）— src/main.ts]
async function bootstrap() {
  if (process.env.NODE_ENV === "development") {
    const { worker } = await import("./mocks/browser");
    await worker.start(); // 必须 await，否则首次请求可能未被拦截
  }
  // 启动应用...
}
bootstrap();
```

```ts [测试 setup — vitest.setup.ts]
import { beforeAll, afterEach, afterAll } from "vitest";
import { server } from "./src/mocks/server";

beforeAll(() => server.listen()); // 启动拦截
afterEach(() => server.resetHandlers()); // 每个测试后重置
afterAll(() => server.close()); // 全部完成后关闭
```

```ts [测试 setup — jest.setup.ts]
import { server } from "./src/mocks/server";

beforeAll(() => server.listen());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());
```

:::

---

### 测试中覆盖 Handler

用 `server.use()` 在特定测试中临时替换默认 handler，`afterEach` 中的 `resetHandlers()` 会自动清除覆盖：

```ts
import { http, HttpResponse } from "msw";
import { server } from "./mocks/server";

test("显示错误信息当 API 返回 500", async () => {
  server.use(
    http.get("/api/users", () => {
      return HttpResponse.json({ message: "Server Error" }, { status: 500 });
    }),
  );

  // ... 测试逻辑
});
```

---

### 请求断言

在 handler 中捕获请求数据，测试中验证：

```ts
test("提交表单时发送正确的请求体", async () => {
  let capturedBody: unknown;

  server.use(
    http.post("/api/users", async ({ request }) => {
      capturedBody = await request.json();
      return HttpResponse.json({ id: 1 }, { status: 201 });
    }),
  );

  // ... 触发表单提交

  expect(capturedBody).toEqual({
    name: "Alice",
    email: "alice@example.com",
  });
});
```
