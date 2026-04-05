# Schema

> Schema は SDL（Schema Definition Language）で記述し、API のデータ構造と操作インターフェースを定義する。サーバーとクライアント間の契約である

---

## スカラー型

GraphQL には 5 種類のスカラー型（Scalar Type）が組み込まれている

| 型        | 説明                          | 例               |
| --------- | ----------------------------- | ---------------- |
| `Int`     | 32 ビット符号付き整数         | `42`             |
| `Float`   | 倍精度浮動小数点数            | `3.14`           |
| `String`  | UTF-8 文字列                  | `"hello"`        |
| `Boolean` | 真偽値                        | `true` / `false` |
| `ID`      | 一意識別子（String としてシリアライズ） | `"abc123"`       |

---

### カスタムスカラー

```graphql
scalar DateTime
scalar JSON
```

```ts
import { GraphQLScalarType, Kind } from "graphql";

const dateTimeScalar = new GraphQLScalarType({
  name: "DateTime",
  description: "ISO 8601 日付時刻フォーマット",
  serialize(value) {
    return value.toISOString(); // サーバー → クライアント
  },
  parseValue(value) {
    return new Date(value); // クライアント変数 → サーバー
  },
  parseLiteral(ast) {
    if (ast.kind === Kind.STRING) return new Date(ast.value); // インライン値 → サーバー
    return null;
  },
});
```

---

## 型修飾子

::: warning `!` と `[]` の意味

| 記法         | 意味               | null 可 |
| ------------ | ------------------ | --------- |
| `String`     | null 許容の文字列  | はい      |
| `String!`    | 非 null 文字列     | いいえ    |
| `[String]`   | null 許容リスト、要素も null 許容 | 両方可    |
| `[String!]`  | null 許容リスト、要素は非 null | リストのみ可 |
| `[String!]!` | 非 null リスト、要素も非 null | 両方不可  |

:::

---

## オブジェクト型

オブジェクト型（Object Type）はフィールドの集合を定義する。Schema で最もよく使われる型である

```graphql
type User {
  id: ID!
  name: String!
  email: String!
  age: Int
  role: Role!
  posts: [Post!]!
  createdAt: DateTime!
}

type Post {
  id: ID!
  title: String!
  content: String!
  author: User!
  comments: [Comment!]!
  status: PostStatus!
}
```

---

## 列挙型

```graphql
enum Role {
  ADMIN
  EDITOR
  VIEWER
}

enum PostStatus {
  DRAFT
  PUBLISHED
  ARCHIVED
}
```

---

## 入力型

入力型（Input Type）はパラメータの受け渡し専用で、Resolver を含めることができない

```graphql
input CreateUserInput {
  name: String!
  email: String!
  age: Int
}

input UpdateUserInput {
  name: String
  email: String
  age: Int
}

type Mutation {
  createUser(input: CreateUserInput!): User!
  updateUser(id: ID!, input: UpdateUserInput!): User!
}
```

::: warning `type` vs `input`

- `type` は**出力**構造を定義する（Resolver が返すデータ）
- `input` は**入力**構造を定義する（クライアントが渡すパラメータ）
- 混用不可：`type` はパラメータ型として使えず、`input` は戻り値型として使えない
:::

---

## インターフェースとユニオン型

### インターフェース（Interface）

複数の型が同じフィールドを共有する場合に使用する

```graphql
interface Node {
  id: ID!
}

interface Timestamped {
  createdAt: DateTime!
  updatedAt: DateTime!
}

type User implements Node & Timestamped {
  id: ID!
  name: String!
  createdAt: DateTime!
  updatedAt: DateTime!
}
```

---

### ユニオン型（Union）

複数の型に共通フィールドがない場合に使用する

```graphql
union SearchResult = User | Post | Comment

type Query {
  search(keyword: String!): [SearchResult!]!
}
```

::: tip Interface vs Union

- **Interface**：共通フィールドがある（`id`、`createdAt` など）。クエリ時に共通フィールドへ直接アクセスできる
- **Union**：共通フィールドがない。クエリ時にインライン Fragment（`... on Type { }`）が必須
:::

---

## 操作型

Schema には 3 種類のルート操作型を定義し、クライアントは対応する操作構文でリクエストを発行する

### Query

データの読み取り（GET に相当）

```graphql
type Query {
  user(id: ID!): User
  users(limit: Int = 10, offset: Int = 0): [User!]!
  search(keyword: String!): [SearchResult!]!
}
```

クライアントはクエリ時に必要なフィールドだけを選択し、ネストで関連データも取得できる：

```graphql
query GetUser($id: ID!) {
  user(id: $id) {
    name
    posts {           # ネストクエリで関連データを取得
      title
      comments { text }
    }
  }
}
```

---

### Mutation

データの変更（POST/PUT/DELETE に相当）

```graphql
type Mutation {
  createUser(input: CreateUserInput!): User!
  updateUser(id: ID!, input: UpdateUserInput!): User!
  deleteUser(id: ID!): Boolean!
}
```

```graphql
mutation CreateUser($input: CreateUserInput!) {
  createUser(input: $input) {
    id
    name
  }
}
```

::: warning Query vs Mutation の実行の違い

- **Query** の複数フィールドは**並列**実行できる
- **Mutation** の複数フィールドは**順序通り**に実行される（操作の順序性を保証するため）
:::

---

### Subscription

リアルタイム配信（WebSocket ベース）

```graphql
type Subscription {
  postCreated: Post!
  commentAdded(postId: ID!): Comment!
}
```

```graphql
subscription OnNewComment($postId: ID!) {
  commentAdded(postId: $postId) {
    text
    author { name }
  }
}
```

> サーバー側の実装は [Subscription](/ja/programming/web-backend/graphql/subscription) を参照

---

## クライアント構文

### 変数

`$` プレフィックスで定義し、JSON で別途渡す。動的な値をクエリ文字列から分離する

```graphql
query GetUsers($limit: Int = 10, $role: Role) {
  users(limit: $limit, role: $role) {
    name
  }
}
```

```json
{ "limit": 5, "role": "ADMIN" }
```

---

### エイリアス

同一フィールドを異なるパラメータで複数回クエリする際、エイリアスでキー名の衝突を回避する

```graphql
query {
  admin: user(id: "1") { name }
  editor: user(id: "2") { name }
}
# → { "admin": { "name": "Alice" }, "editor": { "name": "Bob" } }
```

---

### Fragment

フィールド選択セットの再利用

```graphql
fragment UserBasic on User {
  id
  name
  email
}

query {
  user(id: "1") { ...UserBasic }
  users { ...UserBasic }
}
```

Union / Interface 型ではインライン Fragment で具体的な型ごとにフィールドを選択する：

```graphql
query {
  search(keyword: "GraphQL") {
    ... on User { name email }
    ... on Post { title content }
  }
}
```

---

### Directive

`@` で始まり、フィールドの条件制御に使用する

```graphql
query GetUser($withPosts: Boolean!, $hideEmail: Boolean!) {
  user(id: "1") {
    name
    email @skip(if: $hideEmail)
    posts @include(if: $withPosts) { title }
  }
}
```

Schema 内で `@deprecated` を使って非推奨フィールドをマークすることもできる：

```graphql
type User {
  username: String @deprecated(reason: "Use 'name' instead")
}
```

---

## Schema 開発パターン

Schema は**バックエンドが定義する契約**であり（protobuf の `.proto` ファイルに相当）、API にどのデータ型と操作があるかを定義する。バックエンドには Schema を定義する 2 つの方法がある：

|             | Schema-First                                                                                                           | Code-First                                                                                     |
| ----------- | ---------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| フロー      | バックエンドが先に SDL を記述 → ツールが型/シグネチャを生成 → Resolver を実装                                            | バックエンドが先にコード（クラス/デコレータ/関数）を記述 → フレームワークが SDL を自動生成      |
| Schema のソース | 手書きの `.graphql` ファイル                                                                                           | コードが Schema そのもの、ランタイムでエクスポート                                              |
| 型安全      | codegen による型生成に依存                                                                                              | 言語自体の型システムが保証                                                                     |
| 代表的なフレームワーク | [Apollo Server](/ja/programming/web-backend/graphql/apollo)、<br/>[gqlgen（Go）](/ja/programming/web-backend/graphql/gqlgen) | Strawberry（Python）、<br/>Pothos（TypeScript） |
| 適用シーン  | チーム協業で先に契約を定める、<br/>フロントエンドとバックエンドの分離で各自イテレーション                                | 高速開発、<br/>型システムが強い言語（Python 型アノテーション、TypeScript）                      |

```txt
Schema-First:
  バックエンドが schema.graphql を記述 → codegen → types.ts → バックエンドが Resolver を実装
                                                              （シグネチャ確定済み、ロジックを埋めるだけ）

Code-First:
  バックエンドが Python class / TS 関数を記述 → フレームワークが SDL を生成 → 外部に Schema を公開
                                                （コードが Schema の唯一の信頼源）
```

---

### codegen

codegen（`graphql-codegen` など）が解決するのは**フロントエンドがどうやって型を取得するか**という問題である。バックエンドが定義した Schema を読み取り、フロントエンド・バックエンド双方で使える TypeScript 型を自動生成する：

```txt
バックエンドが定義した schema.graphql
         │
         ▼
    graphql-codegen
         │
    ┌────┴──────────────────────────────────────┐
    ▼                                           ▼
  バックエンド用:                               フロントエンド用:
  Resolver のパラメータ/戻り値型               Query/Mutation の変数と戻り値型
                                               型安全な useQuery/useMutation Hooks
```

::: warning tRPC / protobuf との比較

三者とも「バックエンドが契約を定義 → フロントエンドが型を取得」だが、フロントエンドが型を取得する方法が異なる：

| | バックエンドの定義 | フロントエンドの型取得方法 | フロントエンドの自由度 |
| --- | --- | --- | --- |
| protobuf | `.proto` ファイル | `protoc` でコンパイル | 定義済みのメソッドしか呼べない |
| tRPC | TypeScript 関数 | TS コンパイラが直接推論（codegen ゼロ） | 定義済みの procedure しか呼べない |
| GraphQL | Schema（SDL） | `graphql-codegen` で生成 | **自分でクエリを書き、フィールドをオンデマンドで選択できる** |

GraphQL の codegen は protobuf の `protoc` より一つ多くのことをする：型の生成に加え、フロントエンドが書いた各 query/mutation 文に対応する型付き Hook も生成する
:::

クライアント側 codegen の具体的な設定は [Apollo — GraphQL Code Generator](/ja/programming/web-backend/graphql/apollo#graphql-code-generator) を参照

---

## 構文早見表

| 構文                  | 用途          | 例                                            |
| --------------------- | ------------- | --------------------------------------------- |
| `query { }`           | データクエリ  | `query { users { name } }`                    |
| `mutation { }`        | データ変更    | `mutation { createUser(...) { id } }`         |
| `subscription { }`    | リアルタイム購読 | `subscription { postCreated { title } }`      |
| `$変数名: 型`         | 変数定義      | `query ($id: ID!) { user(id: $id) { name } }` |
| `エイリアス: フィールド` | フィールドエイリアス | `admin: user(id: "1") { name }`               |
| `fragment 名 on 型`   | Fragment 定義 | `fragment Info on User { id, name }`          |
| `...FragmentName`     | Fragment 展開 | `user { ...Info }`                            |
| `... on 型 { }`       | インライン Fragment | `... on User { name }`                        |
| `@include(if: $var)`  | 条件付き包含  | `posts @include(if: $withPosts) { title }`    |
| `@skip(if: $var)`     | 条件付きスキップ | `email @skip(if: $hide)`                      |
