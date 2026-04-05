# 分页

GraphQL 中分页有两种主流方案。选择很简单：

| | Offset 分页 | Cursor 分页 |
| --- | --- | --- |
| 对应 SQL | `LIMIT 10 OFFSET 20` | `WHERE id > cursor LIMIT 10` |
| 能跳页吗 | 能（直接跳到第 5 页） | 不能（只能上一页/下一页） |
| 数据变动时 | 可能重复或遗漏 | 稳定，不受影响 |
| 用在哪 | 管理后台、数据量小 | 无限滚动、Feed 流、数据量大 |

---

## Offset 分页

用 `limit`（每页几条）和 `offset`（跳过几条）定位数据，和 SQL 的 `LIMIT + OFFSET` 一一对应

```txt
第 1 页: offset=0,  limit=3  → 取第 1~3 条
第 2 页: offset=3,  limit=3  → 跳过 3 条，取第 4~6 条
第 3 页: offset=6,  limit=3  → 跳过 6 条，取第 7~9 条
```

---

### Schema + Resolver

```graphql
type Query {
  posts(limit: Int = 10, offset: Int = 0): PostPage!
}

type PostPage {
  items: [Post!]!       # 当前页的数据
  totalCount: Int!      # 总条数（用于计算总页数）
  hasMore: Boolean!     # 是否还有下一页
}
```

```ts
const resolvers = {
  Query: {
    posts: async (_, { limit, offset }, { db }) => {
      const [items, totalCount] = await Promise.all([
        db.posts.find().skip(offset).limit(limit).sort({ createdAt: -1 }),
        db.posts.countDocuments(),
      ]);
      return {
        items,
        totalCount,
        hasMore: offset + items.length < totalCount,
      };
    },
  },
};
```

客户端查询：

```graphql
query GetPosts($limit: Int!, $offset: Int!) {
  posts(limit: $limit, offset: $offset) {
    items { id title }
    totalCount
    hasMore
  }
}
```

---

### Offset 的偏移问题

::: danger 数据变动时会重复或遗漏

用户正在看第 1 页，这时有新数据插入，所有数据的位置都往后挪了一位。用户翻到第 2 页时，`offset` 指向的位置就不对了：

```txt
初始: [A, B, C, D, E]      用户看第 1 页 → A, B

插入 X: [X, A, B, C, D, E]  用户翻第 2 页（offset=2）

期望: C, D
实际: B, C    ← B 重复了
```

数据变动不频繁时没大问题。数据量大 + 频繁写入的场景用 Cursor 分页
:::

---

## Cursor 分页

不用偏移量，改用**上一页最后一条数据的标识**（cursor）作为起点。不管中间插入了多少数据，cursor 指向的那条数据不会变，所以翻页结果始终稳定

```txt
第 1 页: "给我前 3 条"         → A, B, C（C 的 cursor = "abc"）
第 2 页: "给我 abc 之后的 3 条" → D, E, F
                                    ↑ 即使中间插入了新数据，D 还是在 C 后面
```

GraphQL 社区用 **Relay Connection 规范**定义 Cursor 分页的数据结构：

```txt
PostConnection                      ← 返回类型
├── edges[]                         ← 数据列表（不是直接返回数组）
│   ├── node: Post                  ← 实际的数据对象
│   └── cursor: "abc123"            ← 这条数据的游标
└── pageInfo
    ├── hasNextPage: true           ← 还有下一页吗
    └── endCursor: "abc123"         ← 最后一条的游标（下次请求传这个）
```

::: tip 为什么要套 edges / node 而不是直接返回数组

因为每条数据需要附带自己的 cursor。直接返回 `[Post]` 的话没地方放 cursor，所以用 `edge`（边）包一层：`edge = { node: 实际数据, cursor: 游标 }`
:::

---

### Schema + Resolver

```graphql
type Query {
  posts(first: Int!, after: String): PostConnection!
  #      ↑ 取几条       ↑ 从哪个 cursor 之后开始（不传 = 从头开始）
}

type PostConnection {
  edges: [PostEdge!]!
  pageInfo: PageInfo!
}

type PostEdge {
  node: Post!
  cursor: String!
}

type PageInfo {
  hasNextPage: Boolean!
  endCursor: String
}
```

```ts
const resolvers = {
  Query: {
    posts: async (_, { first, after }, { db }) => {
      // after 有值时，从该 cursor 之后开始查
      const query = after ? { _id: { $gt: decodeCursor(after) } } : {};
      // 多查一条：如果返回 first+1 条说明还有下一页
      const items = await db.posts
        .find(query)
        .limit(first + 1)
        .sort({ _id: 1 });

      const hasNextPage = items.length > first;
      const edges = items.slice(0, first).map((item) => ({
        node: item,
        cursor: encodeCursor(item._id),
      }));

      return {
        edges,
        pageInfo: {
          hasNextPage,
          endCursor: edges.at(-1)?.cursor ?? null,
        },
      };
    },
  },
};

// cursor 用 Base64 编码，让客户端不知道也不依赖内部格式（可能是 id、时间戳等）
const encodeCursor = (id) => Buffer.from(id.toString()).toString("base64");
const decodeCursor = (cursor) =>
  Buffer.from(cursor, "base64").toString("utf-8");
```

客户端查询：

```graphql
# 第 1 页（不传 after）
query { posts(first: 10) { edges { node { id title } cursor } pageInfo { hasNextPage endCursor } } }

# 第 2 页（传上一页的 endCursor）
query { posts(first: 10, after: "abc123") { edges { node { id title } cursor } pageInfo { hasNextPage endCursor } } }
```

> 使用 Apollo Client 的 `fetchMore` 实现无限滚动见 [Apollo — 分页](/programming/web-backend/graphql/apollo#分页-fetchmore)
