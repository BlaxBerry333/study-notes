# セキュリティとエラーハンドリング

## クエリセキュリティ

### 問題

REST では各エンドポイントが固定構造を返し、サーバー側がクエリを完全に制御する。GraphQL はクエリ能力をクライアントに委譲するため、2 つのセキュリティリスクが生じる：

**1. 深いネスト攻撃** -- クライアントが無限にネストされたクエリを構築でき、各層で Resolver とデータベースクエリが実行される：

```graphql
# 悪意のあるクエリ：無限ネスト
query {
  user {
    posts {
      comments {
        author {
          posts {
            comments {
              author { ... }  # さらにネスト...
            }
          }
        }
      }
    }
  }
}
```

**2. 幅の爆発攻撃** -- ネストは 2 層だけだが、一度に 10000 ユーザー x 100 記事 = 100 万件のデータをクエリする：

```graphql
query {
  users(first: 10000) {
    posts(first: 100) {
      title
    }
  }
}
```

---

### 解決策

| 方式         | 何を防ぐか       | 原理                                         | 実装コスト             |
| ------------ | ---------------- | -------------------------------------------- | ---------------------- |
| 深度制限     | 無限ネスト       | ネスト階層を数え、超過したら拒否             | 低（1 行の設定）       |
| 複雑度制限   | 大量データ取得   | フィールドごとに重みを累加し、閾値超過で拒否 | 中（重みの調整が必要） |
| 永続化クエリ | 任意クエリの注入 | 事前登録されたクエリのみ許可                 | 中                     |

3 つを**同時に使用**すると最も効果的である：深度制限でネストを兜底し、複雑度制限で実際のコストを制御し、永続化クエリで悪意のあるクエリを根本から防ぐ

---

### 深度制限

クエリの最大ネスト階層を制限し、超過した場合は実行を即座に拒否する：

```ts
import depthLimit from "graphql-depth-limit";

const server = new ApolloServer({
  typeDefs,
  resolvers,
  validationRules: [depthLimit(10)], // 10 層を超えたら拒否
});
```

---

### 複雑度制限

各フィールドに重みを割り当て、クエリ実行前に総複雑度を計算し、閾値を超えたら拒否する：

```txt
query {
  users(first: 100) {    ← 複雑度: 100（リストフィールド × 件数）
    posts(first: 50) {   ← 複雑度: 100 × 50 = 5000
      title
    }
  }
}
総複雑度: 5100 → 閾値 1000 を超過、実行拒否
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

### 永続化クエリ

> Persisted Queries

通常、クライアントは毎回完全なクエリ文字列を送信する。永続化クエリはクエリをサーバーに事前登録し、クライアントはハッシュ値のみを送信する：

```txt
通常のリクエスト:
  → { query: "query { users { name posts { title } } }" }    完全な文字列、毎回転送

永続化クエリ:
  初回: → { hash: "abc123", query: "query { users { ... } }" }  サーバーがキャッシュ
  以降: → { hash: "abc123" }                                     ハッシュのみ送信
```

- **転送量の削減** -- 複雑なクエリ文字列は非常に長くなりうるが、ハッシュは固定 64 バイト
- **任意クエリの防止** -- 厳格モードでは登録済みのクエリのみ許可し、クライアントが悪意のあるクエリを構築できなくなる

```ts
const server = new ApolloServer({
  typeDefs,
  resolvers,
  persistedQueries: { ttl: 900 }, // 15 分間キャッシュ
});
```

---

### Introspection

Introspection はクライアントが Schema の完全な構造（すべての型、フィールド、引数）をクエリできる機能である。GraphQL Playground などのツールはこれに依存して自動補完やドキュメント閲覧を提供しており、開発段階では非常に有用である

しかし本番環境では Introspection を無効にすべきである。攻撃者が API の完全な構造を取得でき、悪意のあるクエリの構築に利用される恐れがある

Apollo Server 4 は `NODE_ENV=production` の場合、デフォルトで Introspection を無効にする。手動で無効にする方法：

```ts
const server = new ApolloServer({
  typeDefs,
  resolvers,
  introspection: false, // Schema クエリを禁止
});
```

---

### レート制限

深度制限と複雑度制限は単一クエリの悪意ある構築を防ぐものであり、レート制限は大量リクエストによるブルートフォース攻撃を防ぐものである

GraphQL はエンドポイントが `/graphql` の 1 つだけであるため、従来の URL ベースのレート制限は使えず、IP / ユーザー / クエリ複雑度に基づいて制限する必要がある。一般的な方法：`express-rate-limit`（IP ベースの制限）、`graphql-rate-limit`（フィールドレベルの制限）

```ts
// express-rate-limit：各 IP につき 15 分間で最大 100 リクエスト
import rateLimit from "express-rate-limit";

app.use("/graphql", rateLimit({ windowMs: 15 * 60 * 1000, max: 100 }));
```

---

## エラーハンドリング

### 現状：REST との違い

GraphQL のエラーメカニズムは REST と本質的に 2 つの違いがある：

**1. HTTP ステータスコードが常に 200** -- REST はステータスコードで成功・失敗を区別する（200、404、500）が、GraphQL は成功・失敗に関係なく常に 200 を返し、エラーはレスポンスボディの `errors` フィールドに格納される：

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

**2. 部分成功** -- REST は 1 リクエストが成功か失敗のどちらかである。GraphQL は 1 リクエストで複数フィールドをクエリし、一部のフィールドが失敗しても他のフィールドは正常に返される：

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

### 対処方法

**サーバー側**：Resolver 内で `GraphQLError` を使ってエラーコード付きのエラーをスローする。使い方は [Resolver -- 権限チェック](/ja/programming/web-backend/graphql/resolver#resolver-内での権限チェック) を参照

**クライアント側**：`data` と `errors` の両方のフィールドを確認する必要がある。`extensions.code` でエラー種別を判定し（ログインページへの遷移、メッセージ表示など）、`message` のテキストに依存しないこと。Apollo Client 使用時はフレームワークが自動的に解析する。[Apollo -- エラーハンドリング](/ja/programming/web-backend/graphql/apollo#エラーハンドリング) を参照
