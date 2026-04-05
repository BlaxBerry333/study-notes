# N+1 问题

N+1 在任何「循环中逐条查询关联数据」的场景都会触发（REST、ORM 都会遇到）

GraphQL 中特别容易触发，因为每个字段的 Resolver 独立执行，嵌套字段天然形成逐条查询的结构

## 什么是 N+1

查询一个列表（1 次查询），然后**对列表中的每一条结果再逐条查询关联数据**（N 次查询），总共 1 + N 次查询，这就是 N+1 问题

本来一次 `WHERE IN` 批量查询就能拿到所有关联数据，却变成了 N 次独立查询，数据量越大性能越差

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

GraphQL 中每个字段的 Resolver 独立执行，`posts` 的 Resolver 会对每个 user 各调用一次：

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

没有 DataLoader 时，每个 Resolver 各自查数据库，互相不知道对方的存在：

```txt
Resolver 1: "我要 userId=1 的 posts"  → SELECT * FROM posts WHERE userId = 1
Resolver 2: "我要 userId=2 的 posts"  → SELECT * FROM posts WHERE userId = 2
Resolver 3: "我要 userId=3 的 posts"  → SELECT * FROM posts WHERE userId = 3
```

DataLoader 做的事情是**在 Resolver 和数据库之间加一层缓冲**。Resolver 不再直接查数据库，而是把需求交给 DataLoader（`.load(id)`）。DataLoader 不会立即执行，而是先攒着，等当前这一轮所有 Resolver 都提交完需求后，**合并为一次批量查询**：

```txt
Resolver 1: "我要 userId=1 的 posts"  → 交给 DataLoader
Resolver 2: "我要 userId=2 的 posts"  → 交给 DataLoader
Resolver 3: "我要 userId=3 的 posts"  → 交给 DataLoader

                    ┌──────────────────────┐
                    │ DataLoader 攒了一轮:   │
                    │ userId = 1, 2, 3     │
                    └──────────┬───────────┘
                               ▼
              SELECT * FROM posts WHERE userId IN (1, 2, 3)
              （1 次查询搞定，DataLoader 再把结果分发给每个 Resolver）
```

```txt
改善前: 1 次查 users + N 次逐条查 posts = N+1 次
改善后: 1 次查 users + 1 次批量查 posts = 2 次
```

::: details 下载安装

```zsh
% npm install dataloader
```

:::

::: details 创建 Loader

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

:::

::: details 注入 Context

每个请求创建新的 DataLoader 实例：

```ts
const { url } = await startStandaloneServer(server, {
  context: async ({ req }) => ({
    db: database,
    loaders: createLoaders(database),
  }),
});
```

:::

::: details 在 Resolver 中使用

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

:::

::: warning DataLoader 关键规则

- **每个请求创建新实例**（在 Context 中 `new`）— 不要跨请求复用
- 批量函数的**返回顺序必须与输入顺序一致**
- DataLoader 的缓存是**请求级别**的，请求结束自动释放

:::

---

## 方案 2: JOIN 预加载

在查询根字段时直接 JOIN 关联表，一次查询取回所有数据。适合关联关系固定且简单的场景（比如 user 总是需要带 profile）

```txt
改善后（JOIN）:
  SELECT * FROM users LEFT JOIN posts ON users.id = posts.userId    (1 次)
```

```ts
// TypeORM 示例（userRepository = dataSource.getRepository(User)）
const resolvers = {
  Query: {
    users: () => userRepository.find({ relations: ["posts"] }),
  },
};
```

::: danger 问题
客户端没查 `posts` 字段时也会 JOIN，违背了 GraphQL「按需获取」的原则，浪费数据库资源。因此只适合**关联数据几乎总是需要的场景**，否则应该用 DataLoader 或条件 JOIN
:::

---

## 方案 3: 条件 JOIN

方案 2 的改进版。通过 Resolver 的第 4 个参数 `info`（`GraphQLResolveInfo`）解析客户端实际请求了哪些字段，按需决定是否 JOIN：

```ts
// TypeORM 简化示例（未处理 Fragment 等复杂情况）
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

客户端查了 `posts` 才 JOIN，没查就不 JOIN。但手动解析 `info` 很繁琐（Fragment、嵌套层级都要处理），实际项目中通常借助工具库：

| 库 | 说明 |
| --- | --- |
| `graphql-parse-resolve-info` | 从 `info` 中提取结构化的字段树，处理了 Fragment 和嵌套 |
| `graphql-fields` | 更轻量，返回字段名的嵌套对象 |

---

## 方案 4: ORM 内置防护

部分 ORM 内置了自动批量化机制，原理和 DataLoader 类似（同一 tick 内的查询自动合并），但不需要手动创建 Loader

---

### Prisma

Prisma Client 内置 dataloader，自动将同一 tick 内的多次 `findUnique` 合并为一次批量查询：

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
