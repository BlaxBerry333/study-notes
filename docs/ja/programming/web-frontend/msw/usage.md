# 基本的な使い方

## 推奨ディレクトリ構成

```txt
src/
└── mocks/
    ├── handlers.ts      ← 全 handler の集約エクスポート
    ├── handlers/
    │   ├── user.ts      ← リソース/機能モジュールごとに分割
    │   └── post.ts
    ├── browser.ts       ← setupWorker（開発環境）
    └── server.ts        ← setupServer（テスト環境）
```

handler をモジュールごとに分割し、`handlers.ts` で集約する：

```ts
import { userHandlers } from "./handlers/user";
import { postHandlers } from "./handlers/post";

export const handlers = [...userHandlers, ...postHandlers];
```

---

## 1. Handler を定義する

リクエストにマッチ → モックレスポンスを返す：

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

### 動的レスポンス

リクエストパラメータに応じて異なるレスポンスを返す：

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

### エラーのシミュレーション

```ts
// HTTP エラー
http.get("/api/users", () => {
  return HttpResponse.json(
    { message: "Internal Server Error" },
    { status: 500 },
  );
});

// ネットワークエラー（リクエストがサーバーに到達しない）
http.get("/api/users", () => {
  return HttpResponse.error();
});
```

---

### レスポンスの遅延

```ts
import { http, HttpResponse, delay } from "msw";

http.get("/api/users", async () => {
  await delay(2000); // 2秒遅延
  return HttpResponse.json([
    /* ... */
  ]);
});

// 無限遅延（ローディング状態のテスト用）
http.get("/api/users", async () => {
  await delay("infinite");
  return HttpResponse.json([]);
});
```

---

## 2. インターセプトインスタンスを作成する

::: code-group

```ts [ブラウザ側 — src/mocks/browser.ts]
import { setupWorker } from "msw/browser";
import { handlers } from "./handlers";

export const worker = setupWorker(...handlers);
```

```ts [Node.js 側 — src/mocks/server.ts]
import { setupServer } from "msw/node";
import { handlers } from "./handlers";

export const server = setupServer(...handlers);
```

:::

---

## 3. アプリに接続する

::: code-group

```ts [アプリのエントリポイント（開発環境）— src/main.ts]
async function bootstrap() {
  if (process.env.NODE_ENV === "development") {
    const { worker } = await import("./mocks/browser");
    await worker.start(); // 必ず await すること。そうしないと初回リクエストがインターセプトされない可能性がある
  }
  // アプリを起動...
}
bootstrap();
```

```ts [テストセットアップ — vitest.setup.ts]
import { beforeAll, afterEach, afterAll } from "vitest";
import { server } from "./src/mocks/server";

beforeAll(() => server.listen()); // インターセプト開始
afterEach(() => server.resetHandlers()); // 各テスト後にリセット
afterAll(() => server.close()); // 全テスト完了後にクローズ
```

```ts [テストセットアップ — jest.setup.ts]
import { server } from "./src/mocks/server";

beforeAll(() => server.listen());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());
```

:::

---

### テスト内での Handler の上書き

`server.use()` で特定のテスト内のみ一時的にデフォルト handler を置き換えられる。`afterEach` の `resetHandlers()` で上書きは自動的にクリアされる：

```ts
import { http, HttpResponse } from "msw";
import { server } from "./mocks/server";

test("API が 500 を返したときにエラーメッセージを表示する", async () => {
  server.use(
    http.get("/api/users", () => {
      return HttpResponse.json({ message: "Server Error" }, { status: 500 });
    }),
  );

  // ... テストロジック
});
```

---

### リクエストのアサーション

handler 内でリクエストデータをキャプチャし、テストで検証する：

```ts
test("フォーム送信時に正しいリクエストボディを送信する", async () => {
  let capturedBody: unknown;

  server.use(
    http.post("/api/users", async ({ request }) => {
      capturedBody = await request.json();
      return HttpResponse.json({ id: 1 }, { status: 201 });
    }),
  );

  // ... フォーム送信をトリガー

  expect(capturedBody).toEqual({
    name: "Alice",
    email: "alice@example.com",
  });
});
```
