# Resolver

> Resolver 是 Schema 中每个字段的数据解析函数，定义了"如何获取数据"

---

## 四个参数

```ts
const resolvers = {
  Type名: {
    字段名: (parent, args, context, info) => {
      // parent:  父对象的返回值（根查询时为 undefined）
      // args:    客户端传递的参数
      // context: 所有 Resolver 共享的上下文（数据库、认证等）
      // info:    查询的 AST 信息（高级用途）
      return 数据;
    },
  },
};
```

::: warning Resolver 的执行顺序

GraphQL 从根类型开始，递归解析每个字段。如果字段返回对象类型，继续解析该对象的子字段。
如果某个字段没有定义 Resolver，GraphQL 引擎会使用**默认 Resolver**（返回 `parent[fieldName]`）
:::

---

## 完整示例

```ts
const resolvers = {
  // 根查询
  Query: {
    user: async (_, { id }, { db }) => {
      return db.users.findById(id);
    },
    users: async (_, { limit, offset }, { db }) => {
      return db.users.find().skip(offset).limit(limit);
    },
  },

  // 根变更
  Mutation: {
    createUser: async (_, { input }, { db }) => {
      return db.users.create(input);
    },
    updateUser: async (_, { id, input }, { db }) => {
      return db.users.findByIdAndUpdate(id, input, { new: true });
    },
    deleteUser: async (_, { id }, { db }) => {
      await db.users.findByIdAndDelete(id);
      return true;
    },
  },

  // 字段级 Resolver（关联查询）
  User: {
    // parent 是当前 User 对象
    posts: async (parent, _, { db }) => {
      return db.posts.find({ authorId: parent.id });
    },
  },

  Post: {
    author: async (parent, _, { db }) => {
      return db.users.findById(parent.authorId);
    },
    comments: async (parent, _, { db }) => {
      return db.comments.find({ postId: parent.id });
    },
  },

  // Union / Interface 需要 __resolveType
  SearchResult: {
    __resolveType(obj) {
      if (obj.email) return "User";
      if (obj.title) return "Post";
      if (obj.text) return "Comment";
      return null;
    },
  },
};
```

---

## Context 与认证

Context 在服务器启动时配置，每个请求创建一次，所有 Resolver 共享。认证通常在 Context 中完成：

```ts
const server = new ApolloServer({ typeDefs, resolvers });

const { url } = await startStandaloneServer(server, {
  context: async ({ req }) => {
    const token = req.headers.authorization?.replace("Bearer ", "");
    let user = null;
    if (token) {
      try {
        user = await verifyToken(token);
      } catch {
        // token 无效
      }
    }
    return { user, db: database, loaders: createLoaders(database) };
  },
});
```

---

### Resolver 中检查权限

```ts
import { GraphQLError } from "graphql";

const resolvers = {
  Query: {
    me: (_, __, { user }) => {
      if (!user) {
        throw new GraphQLError("Authentication required", {
          extensions: { code: "UNAUTHENTICATED" },
        });
      }
      return user;
    },
  },
  Mutation: {
    deleteUser: async (_, { id }, { user, db }) => {
      if (!user) {
        throw new GraphQLError("Authentication required", {
          extensions: { code: "UNAUTHENTICATED" },
        });
      }
      if (user.role !== "ADMIN") {
        throw new GraphQLError("Admin access required", {
          extensions: { code: "FORBIDDEN" },
        });
      }
      return db.users.findByIdAndDelete(id);
    },
  },
};
```

::: warning 常用错误码约定

GraphQL 没有标准错误码规范，以下是 Apollo 生态中常用的 `extensions.code`：

| code | 含义 | 对应 HTTP |
| --- | --- | --- |
| `BAD_USER_INPUT` | 参数校验失败 | 400 |
| `UNAUTHENTICATED` | 未登录 / Token 失效 | 401 |
| `FORBIDDEN` | 权限不足 | 403 |
| `NOT_FOUND` | 资源不存在 | 404 |
| `INTERNAL_SERVER_ERROR` | 服务端内部错误 | 500 |

:::

> 客户端携带 Token 的配置见 [Apollo — 携带认证 Token](/programming/web-backend/graphql/apollo#携带认证-token)
> 错误响应格式和部分成功机制见 [安全与错误处理 — 错误处理](/programming/web-backend/graphql/security#错误处理)

---

## Mutation 返回值设计

::: tip 推荐做法：返回 Payload 类型

不要只返回 `Boolean!`，返回包含修改后对象的 Payload 类型，便于客户端直接更新缓存
:::

```graphql
# 不推荐
type Mutation {
  deleteUser(id: ID!): Boolean!
}

# 推荐：返回修改后的对象
type Mutation {
  createUser(input: CreateUserInput!): CreateUserPayload!
}

type CreateUserPayload {
  user: User!
  success: Boolean!
  message: String
}
```
