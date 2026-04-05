# N+1 問題

N+1 は「ループ内で関連データを 1 件ずつクエリする」全てのシーンで発生する（REST や ORM でも起こり得る）

GraphQL では特に発生しやすい。各フィールドの Resolver が独立して実行されるため、ネストフィールドが本質的に逐次クエリの構造を形成するからである

## N+1 とは

リストを取得するクエリ（1 回）を実行した後、**リスト内の各結果に対して関連データを 1 件ずつクエリする**（N 回）。合計 1 + N 回のクエリが発生する。これが N+1 問題である

本来 1 回の `WHERE IN` バッチクエリで全ての関連データを取得できるはずが、N 回の独立したクエリになってしまう。データ量が増えるほどパフォーマンスが悪化する

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

GraphQL では各フィールドの Resolver が独立して実行されるため、`posts` の Resolver は各 user に対してそれぞれ 1 回ずつ呼ばれる：

```txt
users → SELECT * FROM users                           (1 回)
users[0].posts → SELECT * FROM posts WHERE userId = 1  (1 回目)
users[1].posts → SELECT * FROM posts WHERE userId = 2  (2 回目)
users[2].posts → SELECT * FROM posts WHERE userId = 3  (3 回目)
...
100 人のユーザー → 1 + 100 = 101 回のクエリ
```

---

## 解決策の比較

| 方式         | 原理                             | クエリ数    | 適用シーン                               |
| ------------ | -------------------------------- | ----------- | ---------------------------------------- |
| DataLoader   | 同一イベントループ内のクエリを自動バッチ化 | 2 回（1+1） | **大多数のプロジェクトで第一選択**、汎用的・制御可能・エコシステムが成熟 |
| JOIN プリロード | クエリ時に直接 LEFT JOIN で関連テーブルを結合 | 1 回        | 関連関係が固定でシンプルな場合。ただし過剰取得に注意 |
| 条件付き JOIN | `info` パラメータを解析し、必要に応じて JOIN | 1 回        | 実装コストが高く、極限の最適化が必要な場合のみ検討 |
| ORM 組み込み防護 | ORM が自動バッチ化（Prisma など） | 2 回        | 既に Prisma を使用しているプロジェクトはそのまま恩恵を受けられる |

---

## 方式 1: DataLoader

DataLoader がない場合、各 Resolver がそれぞれ独立してデータベースにクエリし、互いの存在を知らない：

```txt
Resolver 1: "userId=1 の posts が欲しい"  → SELECT * FROM posts WHERE userId = 1
Resolver 2: "userId=2 の posts が欲しい"  → SELECT * FROM posts WHERE userId = 2
Resolver 3: "userId=3 の posts が欲しい"  → SELECT * FROM posts WHERE userId = 3
```

DataLoader は **Resolver とデータベースの間にバッファリング層を挿入する**。Resolver はデータベースに直接クエリせず、要求を DataLoader に渡す（`.load(id)`）。DataLoader はすぐには実行せず、まず溜めておき、現在のラウンドで全ての Resolver が要求を提出し終わった後に、**1 回のバッチクエリにまとめる**：

```txt
Resolver 1: "userId=1 の posts が欲しい"  → DataLoader に渡す
Resolver 2: "userId=2 の posts が欲しい"  → DataLoader に渡す
Resolver 3: "userId=3 の posts が欲しい"  → DataLoader に渡す

                    ┌──────────────────────┐
                    │ DataLoader が 1 ラウンド分溜めた: │
                    │ userId = 1, 2, 3     │
                    └──────────┬───────────┘
                               ▼
              SELECT * FROM posts WHERE userId IN (1, 2, 3)
              （1 回のクエリで完了、DataLoader が結果を各 Resolver に分配）
```

```txt
改善前: 1 回の users クエリ + N 回の逐次 posts クエリ = N+1 回
改善後: 1 回の users クエリ + 1 回のバッチ posts クエリ = 2 回
```

::: details ダウンロードとインストール

```zsh
% npm install dataloader
```

:::

::: details Loader の作成

```ts
import DataLoader from "dataloader";

function createLoaders(db) {
  return {
    // userId でバッチ的に posts をロード
    postsLoader: new DataLoader(async (userIds: readonly string[]) => {
      // 1 回のクエリ：SELECT * FROM posts WHERE userId IN (...)
      const posts = await db.posts.find({ userId: { $in: userIds } });
      // userId でグループ化し、入力順序通りに返す
      return userIds.map((id) => posts.filter((p) => p.userId === id));
    }),
  };
}
```

:::

::: details Context への注入

リクエストごとに新しい DataLoader インスタンスを生成する：

```ts
const { url } = await startStandaloneServer(server, {
  context: async ({ req }) => ({
    db: database,
    loaders: createLoaders(database),
  }),
});
```

:::

::: details Resolver での使用

```ts
const resolvers = {
  User: {
    posts: (parent, _, { loaders }) => {
      // 複数ユーザーの posts リクエストが自動的に 1 回のバッチクエリにまとめられる
      return loaders.postsLoader.load(parent.id);
    },
  },
};
```

:::

::: warning DataLoader の重要なルール

- **リクエストごとに新しいインスタンスを生成する**（Context 内で `new`）-- リクエストをまたいで再利用しないこと
- バッチ関数の**戻り値の順序は入力の順序と一致しなければならない**
- DataLoader のキャッシュは**リクエストレベル**であり、リクエスト終了時に自動的に解放される

:::

---

## 方式 2: JOIN プリロード

ルートフィールドのクエリ時に直接関連テーブルを JOIN し、1 回のクエリで全データを取得する。関連関係が固定でシンプルなシーン（例：user に常に profile が必要）に適している

```txt
改善後（JOIN）:
  SELECT * FROM users LEFT JOIN posts ON users.id = posts.userId    (1 回)
```

```ts
// TypeORM の例（userRepository = dataSource.getRepository(User)）
const resolvers = {
  Query: {
    users: () => userRepository.find({ relations: ["posts"] }),
  },
};
```

::: danger 問題
クライアントが `posts` フィールドをクエリしていなくても JOIN が実行されるため、GraphQL の「必要なものだけ取得する」原則に反し、データベースリソースが無駄になる。したがって**関連データがほぼ常に必要なシーン**にのみ適しており、それ以外は DataLoader か条件付き JOIN を使うべきである
:::

---

## 方式 3: 条件付き JOIN

方式 2 の改良版。Resolver の第 4 引数 `info`（`GraphQLResolveInfo`）を解析して、クライアントが実際にどのフィールドをリクエストしているかを判定し、必要に応じて JOIN するかどうかを決定する：

```ts
// TypeORM の簡易例（Fragment などの複雑なケースは未対応）
const resolvers = {
  Query: {
    users: (_, __, ___, info) => {
      // クライアントが posts フィールドをクエリしているかチェック
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

クライアントが `posts` をクエリした場合のみ JOIN し、していなければ JOIN しない。ただし `info` の手動解析は煩雑で（Fragment やネスト階層への対応が必要）、実際のプロジェクトではヘルパーライブラリを使うことが多い：

| ライブラリ | 説明 |
| --- | --- |
| `graphql-parse-resolve-info` | `info` から構造化されたフィールドツリーを抽出し、Fragment とネストに対応 |
| `graphql-fields` | より軽量で、フィールド名のネストオブジェクトを返す |

---

## 方式 4: ORM 組み込み防護

一部の ORM には自動バッチ化メカニズムが組み込まれている。原理は DataLoader と同様（同一 tick 内のクエリを自動的にまとめる）だが、手動で Loader を作成する必要がない

---

### Prisma

Prisma Client には dataloader が組み込まれており、同一 tick 内の複数の `findUnique` を自動的に 1 回のバッチクエリにまとめる：

```ts
const resolvers = {
  Post: {
    author: (parent) => {
      // 一見逐次クエリに見えるが、Prisma が自動的に WHERE id IN (...) にまとめる
      return prisma.user.findUnique({ where: { id: parent.authorId } });
    },
  },
};
```

::: tip Prisma の自動バッチ化条件
同一 tick 内で、同じ `where` と `include` パラメータの `findUnique` 呼び出しが自動的にまとめられる。注意：`findMany` は自動バッチ化されない。`findUnique` のみが対象である
:::
