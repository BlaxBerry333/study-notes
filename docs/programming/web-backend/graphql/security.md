# 安全与错误处理

## 查询安全

### 问题

REST 每个端点返回固定结构，服务端完全控制查询。GraphQL 把查询能力交给了客户端，带来两个安全风险：

**1. 深度嵌套攻击** — 客户端可以构造无限嵌套的查询，每一层都触发 Resolver 和数据库查询：

```graphql
# 恶意查询：无限嵌套
query {
  user {
    posts {
      comments {
        author {
          posts {
            comments {
              author { ... }  # 继续嵌套...
            }
          }
        }
      }
    }
  }
}
```

**2. 宽度爆炸攻击** — 嵌套只有 2 层，但一次查 10000 个用户 × 100 篇文章 = 100 万条数据：

```graphql
query {
  users(first: 10000) {
    posts(first: 100) { title }
  }
}
```

---

### 解决方案

| 方案 | 防什么 | 原理 | 实现成本 |
| --- | --- | --- | --- |
| 深度限制 | 无限嵌套 | 数嵌套层数，超过就拒绝 | 低（一行配置） |
| 复杂度限制 | 大量数据获取 | 按字段权重累加，超阈值就拒绝 | 中（需调权重） |
| 持久化查询 | 任意查询注入 | 只允许预注册的查询 | 中 |

三者**同时使用**效果最好：深度限制兜底防嵌套，复杂度限制控制实际开销，持久化查询从根源杜绝恶意查询

---

### 深度限制

限制查询的最大嵌套层数，超过直接拒绝执行：

```ts
import depthLimit from "graphql-depth-limit";

const server = new ApolloServer({
  typeDefs,
  resolvers,
  validationRules: [depthLimit(10)], // 超过 10 层拒绝
});
```

---

### 复杂度限制

为每个字段分配权重，查询前计算总复杂度，超过阈值就拒绝：

```txt
query {
  users(first: 100) {    ← 复杂度: 100（列表字段 × 数量）
    posts(first: 50) {   ← 复杂度: 100 × 50 = 5000
      title
    }
  }
}
总复杂度: 5100 → 超过阈值 1000，拒绝执行
```

```ts
import { createComplexityLimitRule } from "graphql-validation-complexity";

const server = new ApolloServer({
  typeDefs,
  resolvers,
  validationRules: [createComplexityLimitRule(1000)],
});
```

---

### 持久化查询

> Persisted Queries

正常情况下客户端每次发送完整的查询字符串。持久化查询把查询预注册到服务端，客户端只发送哈希值：

```txt
正常请求:
  → { query: "query { users { name posts { title } } }" }    完整字符串，每次传输

持久化查询:
  首次: → { hash: "abc123", query: "query { users { ... } }" }  服务端缓存
  后续: → { hash: "abc123" }                                     只传哈希
```

- **减少传输** — 复杂查询字符串可能很长，哈希固定 64 字节
- **防止任意查询** — 严格模式下只允许已注册的查询，客户端无法构造恶意查询

```ts
const server = new ApolloServer({
  typeDefs,
  resolvers,
  persistedQueries: { ttl: 900 }, // 缓存 15 分钟
});
```

---

### Introspection

Introspection 允许客户端查询 Schema 的完整结构，包括所有类型、字段、参数。GraphQL Playground 等工具依赖它来提供自动补全和文档浏览，开发阶段非常有用

但在生产环境应该关闭 Introspection，否则攻击者可以直接获取完整的 API 结构，为构造恶意查询提供便利

Apollo Server 4 在 `NODE_ENV=production` 时默认关闭 Introspection。手动关闭：

```ts
const server = new ApolloServer({
  typeDefs,
  resolvers,
  introspection: false, // 禁止 Schema 查询
});
```

---

### 速率限制

深度限制和复杂度限制防的是单个查询的恶意构造，速率限制防的是大量请求的暴力攻击

GraphQL 只有一个端点 `/graphql`，不能用传统的按 URL 限流，需要按 IP / 用户 / 查询复杂度来限流。常见方案：`express-rate-limit`（按 IP 限流）、`graphql-rate-limit`（按字段级别限流）

```ts
// express-rate-limit：每个 IP 15 分钟内最多 100 次请求
import rateLimit from "express-rate-limit";

app.use("/graphql", rateLimit({ windowMs: 15 * 60 * 1000, max: 100 }));
```

---

## 错误处理

### 现状：和 REST 的区别

GraphQL 的错误机制和 REST 有两个本质区别：

**1. HTTP 状态码始终 200** — REST 用状态码区分成功失败（200、404、500），GraphQL 不管成功失败都返回 200，错误放在响应体的 `errors` 字段中：

```json
{
  "data": null,
  "errors": [
    {
      "message": "User not found",
      "path": ["user"],
      "extensions": { "code": "NOT_FOUND" }
    }
  ]
}
```

**2. 部分成功** — REST 一个请求要么成功要么失败。GraphQL 一个请求查多个字段，部分字段失败时其他字段仍然正常返回：

```json
{
  "data": {
    "user": {
      "name": "Alice",
      "posts": null
    }
  },
  "errors": [{ "message": "Failed to fetch posts", "path": ["user", "posts"] }]
}
```

---

### 怎么处理

**服务端**：在 Resolver 中通过 `GraphQLError` 抛出带错误码的错误，用法见 [Resolver — 权限检查](/programming/web-backend/graphql/resolver#resolver-中检查权限)

**客户端**：需要同时检查 `data` 和 `errors` 两个字段。根据 `extensions.code` 判断错误类型（跳转登录页、显示提示等），不要依赖 `message` 文本。使用 Apollo Client 时框架会自动解析，见 [Apollo — 错误处理](/programming/web-backend/graphql/apollo#错误处理)
