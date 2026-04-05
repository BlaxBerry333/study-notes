# エラーハンドリング

## GraphQL との違い

tRPC のエラーハンドリングは GraphQL よりはるかに直感的である。HTTP のモデルに直接マッピングされるためだ：

| | tRPC | GraphQL |
| --- | --- | --- |
| ステータスコード | **通常の HTTP ステータスコード**（400、401、404、500） | 常に 200 |
| エラーの位置 | HTTP レスポンスボディに直接エラーを返す | レスポンスボディの `errors` フィールド |
| 部分的な成功 | 存在しない（1つの Procedure は成功か失敗のどちらか） | 存在する（複数フィールドのクエリ時に一部成功・一部失敗） |
| 型安全 | エラーコードに TypeScript の型補完がある | エラーコードはカスタム文字列で型制約なし |

簡単に言えば、tRPC のエラーは通常の HTTP エラーであり、フロントエンドでは HTTP ステータスコードに基づいて処理すればよい。GraphQL のように `errors` フィールドを別途パースする必要はない

---

## サーバー側でのエラー送出

Procedure 内で `TRPCError` を throw してエラーを送出する：

```ts
import { TRPCError } from "@trpc/server";

const getUserById = t.procedure
  .input(z.object({ id: z.string() }))
  .query(async ({ ctx, input }) => {
    const user = await ctx.db.users.findById(input.id);

    if (!user) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "User not found",
      });
    }
    return user;
  });

const deleteUser = t.procedure
  .input(z.object({ id: z.string() }))
  .mutation(async ({ ctx, input }) => {
    if (!ctx.user) {
      throw new TRPCError({
        code: "UNAUTHORIZED",
        message: "Login required",
      });
    }
    if (ctx.user.role !== "ADMIN") {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "Admin access required",
      });
    }
    return ctx.db.users.delete(input.id);
  });
```

---

## エラーコード

`TRPCError` の `code` は列挙値であり、TypeScript が利用可能なエラーコードを自動補完する：

| code | HTTP ステータスコード | 意味 |
| --- | --- | --- |
| `BAD_REQUEST` | 400 | リクエスト形式エラー |
| `UNAUTHORIZED` | 401 | 未ログイン / トークン失効 |
| `FORBIDDEN` | 403 | 権限不足 |
| `NOT_FOUND` | 404 | リソースが存在しない |
| `METHOD_NOT_SUPPORTED` | 405 | サポートされていないリクエストメソッド |
| `TIMEOUT` | 408 | リクエストタイムアウト |
| `CONFLICT` | 409 | リソースの競合 |
| `PRECONDITION_FAILED` | 412 | 前提条件を満たしていない |
| `PAYLOAD_TOO_LARGE` | 413 | リクエストボディが大きすぎる |
| `TOO_MANY_REQUESTS` | 429 | レートリミット |
| `INTERNAL_SERVER_ERROR` | 500 | サーバー内部エラー |

::: warning Zod バリデーション失敗時は自動的に BAD_REQUEST を返す

Procedure で `.input(zodSchema)` によるパラメータバリデーションを定義している場合、クライアントから送信されたデータが schema に適合しなければ、tRPC は **自動的に** `BAD_REQUEST`（HTTP 400）を throw する。手動での処理は不要。エラーレスポンスには Zod の詳細なバリデーション情報が含まれる：

```json
{
  "code": "BAD_REQUEST",
  "message": "Validation error",
  "data": {
    "zodError": {
      "fieldErrors": { "email": ["Invalid email"] }
    }
  }
}
```

:::

---

## クライアント側の処理

TanStack Query を使用している場合、エラーは `error` オブジェクトにキャプチャされる：

```ts
const { data, error } = trpc.getUserById.useQuery({ id: "1" });

if (error) {
  // error.data?.code は TRPCError のエラーコード（例："NOT_FOUND"）
  // error.message はエラーメッセージ
  switch (error.data?.code) {
    case "UNAUTHORIZED":
      router.push("/login");
      break;
    case "NOT_FOUND":
      // 404 ページを表示
      break;
    default:
      // 汎用エラー通知を表示
  }
}
```

::: tip GraphQL のクライアント側処理との比較

- **tRPC**：`error.data.code` は TypeScript の列挙値で、IDE が自動補完し、誤りはコンパイル時に検出される
- **GraphQL**：`error.extensions.code` はカスタム文字列で、誤りはランタイムでしか検出されない
:::

---

## ミドルウェアによる一括処理

認証や権限チェック等の共通ロジックをミドルウェアにまとめ、各 Procedure で繰り返し記述するのを避ける：

```ts
// ログインが必要な Procedure のベース
const protectedProcedure = t.procedure.use(async ({ ctx, next }) => {
  if (!ctx.user) {
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: "Login required",
    });
  }
  // user を後続 Procedure の ctx に注入
  return next({ ctx: { user: ctx.user } });
});

// 管理者権限が必要な Procedure のベース
const adminProcedure = protectedProcedure.use(async ({ ctx, next }) => {
  if (ctx.user.role !== "ADMIN") {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Admin access required",
    });
  }
  return next({ ctx });
});

// 使用例：各 Procedure 内で認証ロジックを書く必要がない
const deleteUser = adminProcedure
  .input(z.object({ id: z.string() }))
  .mutation(async ({ ctx, input }) => {
    return ctx.db.users.delete(input.id);
  });
```
