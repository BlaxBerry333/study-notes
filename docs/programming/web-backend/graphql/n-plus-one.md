# N+1 问题

N+1 在任何「循环中逐条查询关联数据」的场景都会触发（REST、ORM 都会遇到）

GraphQL 中特别容易触发，因为每个字段的 Resolver 独立执行，嵌套字段天然形成逐条查询的结构

## 什么是 N+1

```graphql
query {
  users {
    name
    posts {
      title
    }
  }
}
```

Resolver 执行过程：

```txt
users → SELECT * FROM users                           (1 次)
users[0].posts → SELECT * FROM posts WHERE userId = 1  (第 1 次)
users[1].posts → SELECT * FROM posts WHERE userId = 2  (第 2 次)
users[2].posts → SELECT * FROM posts WHERE userId = 3  (第 3 次)
...
100 个用户 → 1 + 100 = 101 次查询
```

---

## 解决方案对比

| 方案         | 原理                             | 查询数      | 适用场景                                 |
| ------------ | -------------------------------- | ----------- | ---------------------------------------- |
| DataLoader   | 同一事件循环内的查询自动批量合并 | 2 次（1+1） | **大多数项目首选**，通用、可控、生态成熟 |
| JOIN 预加载  | 查询时直接 LEFT JOIN 关联表      | 1 次        | 关联关系固定且简单，但要注意过度获取     |
| 条件 JOIN    | 解析 `info` 参数，按需 JOIN      | 1 次        | 实现成本高，只在需要极致优化时考虑       |
| ORM 内置防护 | ORM 自动批量化（如 Prisma）      | 2 次        | 已用 Prisma 的项目直接享受，无需额外引入 |

---

## 方案 1: DataLoader

将同一事件循环中的多次单条查询**批量合并**为一次 `WHERE IN` 查询

```txt
改善前（N+1）:
  users → SELECT * FROM users                             (1 次)
  users[0].posts → SELECT * FROM posts WHERE userId = 1    (第 1 次)
  users[1].posts → SELECT * FROM posts WHERE userId = 2    (第 2 次)
  users[2].posts → SELECT * FROM posts WHERE userId = 3    (第 3 次)
  共 N+1 次查询

改善后（DataLoader）:
  users → SELECT * FROM users                                   (1 次)
  所有 posts → SELECT * FROM posts WHERE userId IN (1, 2, 3)     (1 次, 自动去重合并)
  共 2 次查询
```

---

### 下载安装

```zsh
% npm install dataloader
```

---

### 创建 Loader

```ts
import DataLoader from "dataloader";

function createLoaders(db) {
  return {
    // 按 userId 批量加载 posts
    postsLoader: new DataLoader(async (userIds: readonly string[]) => {
      // 1 次查询：SELECT * FROM posts WHERE userId IN (...)
      const posts = await db.posts.find({ userId: { $in: userIds } });
      // 按 userId 分组，并按输入顺序返回
      return userIds.map((id) => posts.filter((p) => p.userId === id));
    }),
  };
}
```

---

### 注入 Context

每个请求创建新的 DataLoader 实例：

```ts
const { url } = await startStandaloneServer(server, {
  context: async ({ req }) => ({
    db: database,
    loaders: createLoaders(database),
  }),
});
```

---

### 在 Resolver 中使用

```ts
const resolvers = {
  User: {
    posts: (parent, _, { loaders }) => {
      // 多个用户的 posts 请求被自动合并为一次批量查询
      return loaders.postsLoader.load(parent.id);
    },
  },
};
```

::: warning DataLoader 关键规则

- **每个请求创建新实例**（在 Context 中 `new`）— 不要跨请求复用
- 批量函数的**返回顺序必须与输入顺序一致**
- DataLoader 的缓存是**请求级别**的，请求结束自动释放

:::

---

## 方案 2: JOIN 预加载

在查询根字段时直接 JOIN 关联表，一次查询取回所有数据：

```txt
改善后（JOIN）:
  SELECT * FROM users LEFT JOIN posts ON users.id = posts.userId    (1 次)
```

```ts
// TypeORM 示例
const resolvers = {
  Query: {
    users: () => userRepository.find({ relations: ["posts"] }),
  },
};
```

::: danger 问题
客户端没查 `posts` 字段时也会 JOIN，违背了 GraphQL「按需获取」的原则，浪费数据库资源
:::

---

## 方案 3: 条件 JOIN

通过 Resolver 的第 4 个参数 `info`（`GraphQLResolveInfo`）解析客户端的查询 AST，按需决定是否 JOIN：

```ts
const resolvers = {
  Query: {
    users: (_, __, ___, info) => {
      // 检查客户端是否查询了 posts 字段
      const hasPosts = info.fieldNodes[0].selectionSet?.selections.some(
        (s) => s.kind === "Field" && s.name.value === "posts",
      );

      return userRepository.find({
        relations: hasPosts ? ["posts"] : [],
      });
    },
  },
};
```

客户端查了 `posts` 才 JOIN，没查就不 JOIN。但实现复杂，嵌套层级深时需要递归解析

---

## 方案 4: ORM 内置防护

部分 ORM 内置了自动批量化机制，不需要手动实现 DataLoader：

---

### Prisma

Prisma Client 内置 dataloader，自动将同一 tick 内的多次 `findUnique` 查询合并为一次批量查询：

```ts
const resolvers = {
  Post: {
    author: (parent) => {
      // 看起来是逐条查询，但 Prisma 会自动合并为 WHERE id IN (...)
      return prisma.user.findUnique({ where: { id: parent.authorId } });
    },
  },
};
```

::: tip Prisma 自动批量化条件
同一 tick 内、相同 `where` 和 `include` 参数的 `findUnique` 调用会被自动合并。注意：`findMany` 不会自动合并，只有 `findUnique` 才生效
:::
