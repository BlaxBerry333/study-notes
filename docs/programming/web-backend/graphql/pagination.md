# 分页

|      | Offset                  | Cursor                      |
| ---- | ----------------------- | --------------------------- |
| 实现 | `LIMIT + OFFSET`        | `WHERE id > cursor LIMIT N` |
| 优点 | 简单、可跳页            | 性能稳定、无偏移问题        |
| 缺点 | 数据变动时可能重复/遗漏 | 不能跳页                    |
| 适用 | 小数据集、管理后台      | 大数据集、无限滚动          |

---

## Offset 分页

简单直观，适合数据量不大的场景

```graphql
type Query {
  posts(limit: Int = 10, offset: Int = 0): PostConnection!
}

type PostConnection {
  items: [Post!]!
  totalCount: Int!
  hasMore: Boolean!
}
```

---

## Cursor 分页（Relay 风格）

```graphql
type Query {
  posts(first: Int!, after: String): PostConnection!
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
// Resolver 实现
const resolvers = {
  Query: {
    posts: async (_, { first, after }, { db }) => {
      const query = after ? { _id: { $gt: decodeCursor(after) } } : {};
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

const encodeCursor = (id) => Buffer.from(id.toString()).toString("base64");
const decodeCursor = (cursor) =>
  Buffer.from(cursor, "base64").toString("utf-8");
```

> 客户端分页用法见 [Apollo — 分页](/programming/web-backend/graphql/apollo#分页-fetchmore)
