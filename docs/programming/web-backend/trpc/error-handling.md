# 错误处理

## 和 GraphQL 的区别

tRPC 的错误处理比 GraphQL 直观得多，因为它直接映射回了 HTTP 的模型：

| | tRPC | GraphQL |
| --- | --- | --- |
| 状态码 | **正常 HTTP 状态码**（400、401、404、500） | 始终 200 |
| 错误位置 | HTTP 响应体直接返回错误 | 响应体的 `errors` 字段 |
| 部分成功 | 不存在（一个 procedure 要么成功要么失败） | 存在（多字段查询时部分失败部分成功） |
| 类型安全 | 错误码有 TypeScript 类型提示 | 错误码是自定义字符串，没有类型约束 |

简单来说：tRPC 的错误就是正常的 HTTP 错误，前端按 HTTP 状态码处理就行，不需要像 GraphQL 那样额外解析 `errors` 字段

---

## 服务端抛出错误

在 Procedure 中通过 `TRPCError` 抛出错误：

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

## 错误码

`TRPCError` 的 `code` 是枚举值，TypeScript 会自动提示可用的错误码：

| code | HTTP 状态码 | 含义 |
| --- | --- | --- |
| `BAD_REQUEST` | 400 | 请求格式错误 |
| `UNAUTHORIZED` | 401 | 未登录 / Token 失效 |
| `FORBIDDEN` | 403 | 权限不足 |
| `NOT_FOUND` | 404 | 资源不存在 |
| `METHOD_NOT_SUPPORTED` | 405 | 不支持的请求方法 |
| `TIMEOUT` | 408 | 请求超时 |
| `CONFLICT` | 409 | 资源冲突 |
| `PRECONDITION_FAILED` | 412 | 前置条件不满足 |
| `PAYLOAD_TOO_LARGE` | 413 | 请求体过大 |
| `TOO_MANY_REQUESTS` | 429 | 限流 |
| `INTERNAL_SERVER_ERROR` | 500 | 服务端内部错误 |

::: warning Zod 校验失败时自动返回 BAD_REQUEST

Procedure 用 `.input(zodSchema)` 定义了参数校验时，如果客户端传入的数据不符合 schema，tRPC **自动抛出** `BAD_REQUEST`（HTTP 400），不需要手动处理。错误响应中会包含 Zod 的详细校验信息：

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

## 客户端处理

使用 TanStack Query 时，错误会被捕获到 `error` 对象中：

```ts
const { data, error } = trpc.getUserById.useQuery({ id: "1" });

if (error) {
  // error.data?.code 是 TRPCError 的错误码（如 "NOT_FOUND"）
  // error.message 是错误信息
  switch (error.data?.code) {
    case "UNAUTHORIZED":
      router.push("/login");
      break;
    case "NOT_FOUND":
      // 显示 404 页面
      break;
    default:
      // 显示通用错误提示
  }
}
```

::: tip 和 GraphQL 的客户端处理对比

- **tRPC**：`error.data.code` 是 TypeScript 枚举，IDE 自动补全，写错了编译期就能发现
- **GraphQL**：`error.extensions.code` 是自定义字符串，写错了运行时才能发现
:::

---

## 中间件统一处理

把认证、权限等通用逻辑放到中间件中，避免每个 Procedure 重复写：

```ts
// 需要登录的 Procedure 基础
const protectedProcedure = t.procedure.use(async ({ ctx, next }) => {
  if (!ctx.user) {
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: "Login required",
    });
  }
  // 把 user 注入到后续 Procedure 的 ctx 中
  return next({ ctx: { user: ctx.user } });
});

// 需要管理员权限的 Procedure 基础
const adminProcedure = protectedProcedure.use(async ({ ctx, next }) => {
  if (ctx.user.role !== "ADMIN") {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Admin access required",
    });
  }
  return next({ ctx });
});

// 使用：不需要在每个 Procedure 里写认证逻辑
const deleteUser = adminProcedure
  .input(z.object({ id: z.string() }))
  .mutation(async ({ ctx, input }) => {
    return ctx.db.users.delete(input.id);
  });
```
