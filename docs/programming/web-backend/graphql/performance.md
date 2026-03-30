# 安全与错误处理

## 查询深度限制

防止恶意的深度嵌套查询

```ts
import depthLimit from "graphql-depth-limit";

const server = new ApolloServer({
  typeDefs,
  resolvers,
  validationRules: [depthLimit(10)],
});
```

---

## 查询复杂度限制

按字段权重限制查询复杂度

```ts
import { createComplexityLimitRule } from "graphql-validation-complexity";

const server = new ApolloServer({
  typeDefs,
  resolvers,
  validationRules: [createComplexityLimitRule(1000)],
});
```

---

## 持久化查询（Persisted Queries）

客户端发送查询的哈希值而非完整字符串，减少网络传输 + 防止任意查询注入

```ts
const server = new ApolloServer({
  typeDefs,
  resolvers,
  persistedQueries: { ttl: 900 }, // 缓存 15 分钟
});
```

```txt
首次请求:  { hash: "abc123", query: "query { users { name } }" }  → 服务端缓存
后续请求:  { hash: "abc123" }  → 直接匹配，无需传输完整查询
```

---

## 错误处理

GraphQL 的错误不通过 HTTP 状态码表示（通常始终返回 200），而是在响应体的 `errors` 字段中

---

### 错误响应格式

```json
{
  "data": null,
  "errors": [
    {
      "message": "User not found",
      "locations": [{ "line": 2, "column": 3 }],
      "path": ["user"],
      "extensions": {
        "code": "NOT_FOUND"
      }
    }
  ]
}
```

---

### 部分成功

GraphQL 可以在部分字段失败时仍返回其他字段的数据

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

### 服务端抛出错误

```ts
import { GraphQLError } from "graphql";

const resolvers = {
  Query: {
    user: async (_, { id }, { db }) => {
      const user = await db.users.findById(id);
      if (!user) {
        throw new GraphQLError("User not found", {
          extensions: { code: "NOT_FOUND" },
        });
      }
      return user;
    },
  },
};
```
