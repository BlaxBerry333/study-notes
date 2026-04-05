---
prev: false
next: false
---

# GraphQL

GraphQL は API クエリ言語である——**バックエンドがデータ構造（Schema）を定義し、フロントエンドが必要なフィールドをオンデマンドでクエリする**

::: warning 特徴:

- 全てのリクエストを単一エンドポイント（通常 `POST /graphql`）で処理する
- クライアントが必要なフィールドを正確に指定し、Over-fetching（余分なフィールドの返却）や Under-fetching（1 つのページで複数の API を呼ぶ必要がある）を回避できる。モバイル端末の通信量削減や、複数クライアントで同一 API を共用するのに適している
- 強い型付けの Schema でデータ構造を定義し、API ドキュメントを兼ねる
- 組み込みの Subscription でリアルタイムデータ配信をサポートする

:::

::: danger 制約:

- ネストクエリが [N+1 問題](/ja/programming/web-backend/graphql/n-plus-one)を引き起こしやすく、DataLoader の導入が必須
- 全リクエストが `POST /graphql` のため HTTP キャッシュや CDN を活用できず、[クライアント側のキャッシュ](/ja/programming/web-backend/graphql/caching)が必要
- HTTP ステータスコードが常に `200` のため、ログや監視に追加対応が必要
- クライアントが任意のクエリを構築できるため、[深度制限・複雑度制限・永続化クエリ](/ja/programming/web-backend/graphql/security)を別途実装する必要がある
- サーバー側で Schema + Resolver + DataLoader + 権限制御を管理する必要があり、REST より重い
:::

::: info 適用シーン

- 複数クライアント（Web / Mobile）で同一 API を共用（GitHub API v4）
- モバイル端末の通信量削減
- データ関係が複雑なプロダクトで柔軟な組み合わせが必要（Shopify、Yelp）
- フロントエンドとバックエンドのチームが分離して各自イテレーションする

:::

```txt
┏━━━━━━━━━━ REST API ━━━━━━━━━━━┓
┃                               ┃
┃  GET /api/user/1              ┃  → { id, name, email, avatar, bio, ... }
┃  GET /api/user/1/posts        ┃  → [{ id, title, content, ... }, ...]
┃  GET /api/user/1/followers    ┃  → [{ id, name, ... }, ...]
┃                               ┃
┃  3 リクエスト                  ┃
┃  各々余分なフィールドを返す       ┃
┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛


┏━━━━━━━━━ GraphQL API ━━━━━━━━━┓
┃                               ┃
┃  POST /graphql                ┃    {
┃  query {                      ┃      user: {
┃    user(id: 1) {              ┃       name: "Alice",
┃      name                     ┃  →    posts: [{ title: "..." }],
┃      followers { name }       ┃       followers: [{ name: "..." }]
┃    }                          ┃      }
┃  }                            ┃    }
┃                               ┃
┃  1 リクエスト                   ┃
┃  必要なフィールドだけ返す         ┃
┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛
```

## 基本概念

| 概念         | 担当               | 一言で言うと                                                             | 詳細                                                        |
| ------------ | ------------------ | ------------------------------------------------------------------------ | ----------------------------------------------------------- |
| Schema       | **バックエンド**   | どのデータ型と操作インターフェースがあるかを定義（API の契約）           | [詳細](/ja/programming/web-backend/graphql/schema)          |
| Resolver     | **バックエンド**   | 各フィールドのデータ取得関数                                             | [詳細](/ja/programming/web-backend/graphql/resolver)        |
| Query        | **フロントエンド** | オンデマンドでデータをクエリ（GET に相当）                               | [詳細](/ja/programming/web-backend/graphql/schema#query)    |
| Mutation     | **フロントエンド** | オンデマンドでデータを変更（POST/PUT/DELETE に相当）                     | [詳細](/ja/programming/web-backend/graphql/schema#mutation) |
| Subscription | **フロントエンド** | リアルタイムデータ配信を購読（WebSocket）                                | [詳細](/ja/programming/web-backend/graphql/subscription)    |
| codegen      | **ツール**         | バックエンドの Schema を読み取り、フロントエンド用の TypeScript 型を生成 | [詳細](/ja/programming/web-backend/graphql/schema#codegen)  |

::: tip Schema と Query の関係

Schema と Query は構文が似ているが（どちらも波括弧で構造を記述する）、本質は全く異なる：

- **Schema**（バックエンドが記述）= 型定義。「どんなデータがあり、どんな型か」を宣言する。DB のテーブル定義 `CREATE TABLE` に相当
- **Query**（フロントエンドが記述）= クエリ文。Schema で定義されたフィールドから「今回欲しいもの」を選ぶ。`SELECT name, title FROM ...` に相当

```txt
Schema（型定義）          Query（リクエスト構造）   レスポンス（リクエスト通り返す）
┌─────────────────┐    ┌──────────────────┐    ┌───────────────────┐
│ type User {     │    │ query {          │    │ {                 │
│   id: ID!       │    │   user(id: "1") {│    │   user: {         │
│   name: String! │    │     name         │    │     name: "Alice" │
│   email: String!│ →  │     posts {      │ →  │     posts: [{     │
│   age: Int      │    │       title      │    │       title:"Hi"  │
│   posts: [Post!]│    │     }            │    │     }]            │
│   followers:... │    │   }              │    │   }               │
│   createdAt:... │    │ }                │    │ }                 │
│ }               │    └──────────────────┘    └───────────────────┘
└─────────────────┘     7 フィールドから 2 つ選択   選んだ 2 つだけ返す
```

Schema は API 全体で 1 つだけ（バックエンドが管理）、Query は多数（各ページ/コンポーネントが必要に応じて異なるクエリを書く）
:::

## ダウンロードとインストール

GraphQL 自体は仕様であり、具体的な実装を選択する必要がある：

| 実装                      | 言語       | 説明                                               | 実装                                               |
| ------------------------- | ---------- | -------------------------------------------------- | -------------------------------------------------- |
| Apollo（Server + Client） | TypeScript | 最も人気のフルスタック方式、エコシステムが充実     | [詳細](/ja/programming/web-backend/graphql/apollo) |
| gqlgen                    | Go         | Schema-First、型安全なコードを自動生成             | [詳細](/ja/programming/web-backend/graphql/gqlgen) |
| Strawberry                | Python     | Code-First、型アノテーションベース、FastAPI と連携 | --                                                 |
| Yoga + Pothos             | TypeScript | 軽量サーバー + Code-First Schema                   | --                                                 |
| Relay                     | TypeScript | Meta 公式クライアント、強い規約                    | --                                                 |
| urql                      | TypeScript | 軽量クライアント、拡張可能                         | --                                                 |

## 基本的な使い方

::: warning フロントエンドとバックエンドの分担

tRPC や protobuf と同様、**バックエンドが契約を定義し、フロントエンドが契約を消費する**：

```txt
protobuf:  バックエンドが .proto を記述 → protoc がコンパイル → フロントエンド・バックエンド各自の言語の型を取得
tRPC:      バックエンドが procedure を記述 → TS コンパイラ → フロントエンドが自動的に型を取得（codegen ゼロ）
GraphQL:   バックエンドが Schema を記述 → codegen が生成 → フロントエンドが TS 型を取得 + 自分でクエリ文を記述
```

GraphQL は tRPC/protobuf より一手間多い：フロントエンドは型を取得するだけでなく、**自分で Query/Mutation を書いてどのフィールドが欲しいかを指定する**必要がある。これが GraphQL の核心的な特徴であり、フロントエンドにクエリの自由度があるが、そのぶん codegen というステップが増える
:::

```txt
┏━━━━━━━━━━━━━━━━━━━━━━━━ バックエンド ━━━━━━━━━━━━━━━━━━━━━━━━━━┓
┃                                                              ┃
┃  ① Schema（契約を定義）       ② Resolver（ロジックを実装）       ┃
┃  ┌──────────────────────┐     ┌────────────────────────┐     ┃
┃  │ type User {          │     │ Query: {               │     ┃
┃  │   id: ID!            │     │   user: (_, {id}) =>   │     ┃
┃  │   name: String!      │ ──▶ │     db.findById(id)    │     ┃
┃  │   posts: [Post!]!    │     │ }                      │     ┃
┃  │ }                    │     │ User: {                │     ┃
┃  │ type Query {         │     │   posts: (parent) =>   │     ┃
┃  │   user(id: ID!): User│     │     db.findPosts(...)  │     ┃
┃  │ }                    │     │ }                      │     ┃
┃  └──────────┬───────────┘     └────────────────────────┘     ┃
┃             │                                                ┃
┗━━━━━━━━━━━━━│━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛
              │
     ③ codegen（Schema を読み取り、フロントエンド用の型を生成）
              │
┏━━━━━━━━━━━━━│━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓
┃             ▼                                                ┃
┃  ④ フロントエンドがクエリ文を記述                                ┃
┃  ┌──────────────────────────────────────────────────┐        ┃
┃  │ query {                    → { user: {           │        ┃
┃  │   user(id: "1") {              name: "Alice",    │        ┃
┃  │     name                       posts: [{         │        ┃
┃  │     posts { title }               title: "..."   │        ┃
┃  │   }                            }]                │        ┃
┃  │ }                           }}                   │        ┃
┃  └──────────────────────────────────────────────────┘        ┃
┃                                                              ┃
┃  フロントエンドが"どのフィールドが欲しいか"を決定                    ┃
┃  サーバーが"リクエストされたフィールドだけ返す"                      ┃
┃                                                              ┃
┗━━━━━━━━━━━━━━━━━━━━━━━━ フロントエンド ━━━━━━━━━━━━━━━━━━━━━━━━━┛
```

開発手順：

1. **バックエンドが Schema を定義** — SDL でデータ型と操作インターフェースを宣言する（[詳細](/ja/programming/web-backend/graphql/schema)）
2. **バックエンドが Resolver を実装** — Schema の各フィールドに対してデータ取得ロジックを書く（[詳細](/ja/programming/web-backend/graphql/resolver)）
3. **codegen で型を生成** — バックエンドの Schema を読み取り、フロントエンド用の TypeScript 型を生成する（[詳細](/ja/programming/web-backend/graphql/schema#codegen)）
4. **フロントエンドがクエリ文を記述** — Query/Mutation で必要なフィールドを指定する（[詳細](/ja/programming/web-backend/graphql/schema#操作型)）

## 議論とトレードオフ

GraphQL の核心的な強みは**クライアントの柔軟なクエリ**である。クライアントが欲しいフィールドを正確に指定し、1 回のリクエストで全ての関連データを取得できる。しかしこの柔軟性はタダではなく、一連のコストを伴う：

### GraphQL の実際のコスト

| コスト | 具体的な問題 |
| --- | --- |
| **N+1 問題** | ネストクエリが本質的に逐次クエリを引き起こすため、[DataLoader](/ja/programming/web-backend/graphql/n-plus-one) の導入が必須 |
| **キャッシュ** | 全リクエストが `POST /graphql` のため HTTP キャッシュと CDN が完全に無効になり、[Apollo Cache](/ja/programming/web-backend/graphql/caching) などクライアント側の方式が必須 |
| **セキュリティ** | クライアントが任意のクエリを構築できるため、[深度制限・複雑度制限](/ja/programming/web-backend/graphql/security)を別途実装する必要がある |
| **監視** | HTTP ステータスコードが常に 200 のため、従来の監視システムに追加対応が必要 |
| **サーバー側の複雑さ** | Schema + Resolver + DataLoader + 権限制御を管理し、フィールドを追加するたびに Resolver を書く必要がある |
| **開発フロー** | Schema 記述 → Resolver 実装 → codegen → Query 記述 → codegen で Hook 生成、1 フィールド変更で 4 箇所に影響 |

::: tip 重要な判断基準

**「クライアントの柔軟なクエリ」という能力がそのユースケースで不要な場合、上記のコストはすべて純粋なオーバーヘッドになる**

- GraphQL が適する場面：複数クライアントで API を共用、データ関係が複雑で柔軟な組み合わせが必要、フロントとバックが分離して各自イテレーション
- 柔軟なクエリが不要なら：TS フルスタックは [tRPC](/ja/programming/web-backend/trpc/) の方が低コスト、シンプルな CRUD / 公開 API は REST の方が成熟、マイクロサービス間通信は [gRPC](/ja/programming/web-backend/grpc/) の方が適している
:::

---

### GraphQL vs tRPC：どう選ぶか

どちらも REST の型安全問題を解決するが、アプローチが全く異なる：

| 観点 | GraphQL | [tRPC](/ja/programming/web-backend/trpc/) |
| --- | --- | --- |
| **言語と対象** | 任意の言語、サードパーティへの外部公開も可能 | **TypeScript のみ**、フロント・バックが同一言語・同一チーム |
| **クエリの柔軟性** | フロントが自由にフィールドを選択、異なるクライアントがオンデマンドでクエリ | サーバー側が返却内容を決定、フロントは呼び出すのみ |
| **開発コスト** | Schema → Resolver → codegen → Query、1 フィールド変更で 4 箇所に影響 | 関数を書けば API 完成、codegen ゼロ |
| **エラーとキャッシュ** | 常に 200 + `errors`、[Apollo Cache](/ja/programming/web-backend/graphql/caching) が必要 | 標準 HTTP ステータスコード + [TRPCError](/ja/programming/web-backend/trpc/error-handling)、TanStack Query でキャッシュ管理 |
| **リアルタイム通信** | [Subscription](/ja/programming/web-backend/graphql/subscription) を組み込みサポート（WebSocket） | subscription procedure をサポートするが、エコシステムは GraphQL ほど成熟していない |
| **エコシステム** | 成熟（Apollo/Relay/urql、豊富なツールチェーン） | 比較的小規模、Next.js / TanStack Query 周辺 |
| **適するシーン** | 外部 API、複数クライアント、多言語 | TS フルスタック社内プロジェクト、同一チーム |

::: tip 判断の仕方

1. **まず言語制約を確認**：非 TS クライアントやサードパーティが API を利用する → tRPC は選択肢から外れ、GraphQL 一択
2. **次にクエリの柔軟性が必要かを確認**：複数クライアントが異なるフィールドの組み合わせを必要とする → GraphQL、単一クライアントで固定構造 → tRPC の方が開発コストがはるかに低い

:::

---

### GraphQL vs REST：どう選ぶか

| 観点 | GraphQL | REST |
| --- | --- | --- |
| **データ取得** | クライアントがフィールドを正確に指定し、1 回のリクエストで関連データを取得。Over/Under-fetching なし | サーバー側が返却構造を決定し、余分なフィールドや複数回のリクエストが発生しやすい |
| **N+1 問題** | ネストクエリで本質的に発生、[DataLoader](/ja/programming/web-backend/graphql/n-plus-one) の導入が必須 | Controller 層で一括 JOIN、発生しない |
| **キャッシュ** | HTTP キャッシュ無効、[Apollo Cache](/ja/programming/web-backend/graphql/caching) が必要 | HTTP ネイティブキャッシュ + CDN |
| **セキュリティ** | クライアントが任意クエリを構築可能、[深度制限・複雑度制限](/ja/programming/web-backend/graphql/security)が必要 | エンドポイント固定、サーバーがクエリを完全制御 |
| **エラー処理** | 常に 200 + `errors` フィールド、[部分成功](/ja/programming/web-backend/graphql/security#部分成功)をサポート | HTTP ステータスコード（404/500 など） |
| **リアルタイム通信** | [Subscription](/ja/programming/web-backend/graphql/subscription) を組み込みサポート | SSE / WebSocket を別途導入する必要がある |
| **API 進化** | フィールド追加は既存クライアントに影響しない、バージョン番号不要 | バージョン管理が必要（v1/v2）または Header で制御 |
| **ファイルアップロード** | JSON はバイナリ非対応、[別途方式](/ja/programming/web-backend/graphql/file-upload)が必要 | multipart をネイティブサポート |
| **適するシーン** | 複数クライアントで柔軟にクエリ、データ関係が複雑、BFF で複数端末に提供 | シンプルな CRUD、公開 API、HTTP キャッシュ / CDN が必要、BFF で単一端末に提供 |

::: tip 判断の仕方

1. **まずクライアント数を確認**：複数クライアントが異なるフィールドの組み合わせを必要とする → GraphQL の柔軟なクエリに価値がある
2. **次にインフラ要件を確認**：HTTP キャッシュ / CDN / 標準的な監視が必要 → REST はエンドツーエンドで成熟しており、GraphQL は各項目に追加の方式が必要

:::
