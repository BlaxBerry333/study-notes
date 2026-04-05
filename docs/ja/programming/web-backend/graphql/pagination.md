# ページネーション

GraphQL のページネーションには 2 つの主流方式がある。選び方はシンプルである：

| | Offset ページネーション | Cursor ページネーション |
| --- | --- | --- |
| 対応する SQL | `LIMIT 10 OFFSET 20` | `WHERE id > cursor LIMIT 10` |
| ページジャンプ | 可能（直接 5 ページ目に移動） | 不可（前/次ページのみ） |
| データ変動時 | 重複や欠落の可能性あり | 安定、影響を受けない |
| 使用シーン | 管理画面、データ量が少ない場合 | 無限スクロール、フィード、データ量が多い場合 |

---

## Offset ページネーション

`limit`（1 ページあたりの件数）と `offset`（スキップする件数）でデータの位置を特定する。SQL の `LIMIT + OFFSET` にそのまま対応する

```txt
1 ページ目: offset=0,  limit=3  → 1〜3 件目を取得
2 ページ目: offset=3,  limit=3  → 3 件スキップ、4〜6 件目を取得
3 ページ目: offset=6,  limit=3  → 6 件スキップ、7〜9 件目を取得
```

---

### Schema + Resolver

```graphql
type Query {
  posts(limit: Int = 10, offset: Int = 0): PostPage!
}

type PostPage {
  items: [Post!]!       # 現在ページのデータ
  totalCount: Int!      # 総件数（総ページ数の計算に使用）
  hasMore: Boolean!     # 次のページがあるか
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

クライアントクエリ：

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

### Offset のずれ問題

::: danger データ変動時に重複や欠落が発生する

ユーザーが 1 ページ目を見ている間に新しいデータが挿入されると、全てのデータの位置が 1 つ後ろにずれる。ユーザーが 2 ページ目に移動した時、`offset` が指す位置がずれてしまう：

```txt
初期: [A, B, C, D, E]      ユーザーが 1 ページ目を閲覧 → A, B

X を挿入: [X, A, B, C, D, E]  ユーザーが 2 ページ目に移動（offset=2）

期待: C, D
実際: B, C    ← B が重複した
```

データ変動が頻繁でなければ大きな問題にはならない。データ量が大きく頻繁な書き込みがあるシーンでは Cursor ページネーションを使用する
:::

---

## Cursor ページネーション

オフセットを使わず、**前ページの最後のデータの識別子**（cursor）を起点とする。途中にどれだけデータが挿入されても cursor が指すデータは変わらないため、ページ送りの結果が常に安定する

```txt
1 ページ目: "最初の 3 件をくれ"           → A, B, C（C の cursor = "abc"）
2 ページ目: "abc の後の 3 件をくれ"       → D, E, F
                                    ↑ 途中に新データが挿入されても D は C の後ろのまま
```

GraphQL コミュニティでは **Relay Connection 仕様**で Cursor ページネーションのデータ構造を定義している：

```txt
PostConnection                      ← 戻り値の型
├── edges[]                         ← データリスト（配列を直接返さない）
│   ├── node: Post                  ← 実際のデータオブジェクト
│   └── cursor: "abc123"            ← このデータのカーソル
└── pageInfo
    ├── hasNextPage: true           ← 次のページはあるか
    └── endCursor: "abc123"         ← 最後のデータのカーソル（次回リクエスト時にこれを渡す）
```

::: tip なぜ edges / node でラップして配列を直接返さないのか

各データに自身の cursor を付帯させる必要があるためである。`[Post]` を直接返すと cursor を置く場所がないので、`edge`（辺）で 1 層ラップする：`edge = { node: 実際のデータ, cursor: カーソル }`
:::

---

### Schema + Resolver

```graphql
type Query {
  posts(first: Int!, after: String): PostConnection!
  #      ↑ 何件取得       ↑ どの cursor の後から開始（未指定 = 先頭から）
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
      // after に値がある場合、その cursor の後から検索
      const query = after ? { _id: { $gt: decodeCursor(after) } } : {};
      // 1 件多く取得：first+1 件返ってきたら次のページがある
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

// cursor は Base64 でエンコードし、クライアントが内部形式（id やタイムスタンプなど）を知らず依存しないようにする
const encodeCursor = (id) => Buffer.from(id.toString()).toString("base64");
const decodeCursor = (cursor) =>
  Buffer.from(cursor, "base64").toString("utf-8");
```

クライアントクエリ：

```graphql
# 1 ページ目（after を渡さない）
query { posts(first: 10) { edges { node { id title } cursor } pageInfo { hasNextPage endCursor } } }

# 2 ページ目（前ページの endCursor を渡す）
query { posts(first: 10, after: "abc123") { edges { node { id title } cursor } pageInfo { hasNextPage endCursor } } }
```

> Apollo Client の `fetchMore` による無限スクロールの実装は [Apollo -- ページネーション](/ja/programming/web-backend/graphql/apollo#ページネーション-fetchmore) を参照
