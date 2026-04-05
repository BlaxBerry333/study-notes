---
prev: false
next: false
---

# Federation

Federation はマイクロサービスアーキテクチャにおいて、複数の GraphQL サービスを一つの統一 API に統合するソリューションである

## なぜ必要か

マイクロサービスでは各サービスが独自の GraphQL Schema とエンドポイントを持つ。フロントエンドは「ユーザーデータは A サービス、注文データは B サービス」と把握したくない——一つのエンドポイントで全データを取得したい

```txt
Federation なし:

  Client ──▶ ユーザーサービス  /graphql    ← ユーザー取得
  Client ──▶ 注文サービス      /graphql    ← 注文取得
  Client ──▶ 商品サービス      /graphql    ← 商品取得
  （フロントが各サービスのアドレスを知り、自分でデータを結合）


Federation あり:

  Client ──▶ Gateway ──▶ ユーザーサービス (Subgraph)
                    ├──▶ 注文サービス (Subgraph)
                    └──▶ 商品サービス (Subgraph)
  （フロントは一つのエンドポイントのみ、Gateway が自動的にルーティング・統合）
```

---

## アーキテクチャ

Apollo Federation は一つの Gateway（Router）と複数の Subgraph で構成される：

```txt
                    ┌─────────────┐
  Client ─────────▶ │   Gateway   │  ← クエリを受信し、分解して各 Subgraph に分配
                    │  (Router)   │
                    └──────┬──────┘
                           │
              ┌────────────┼────────────┐
              ▼            ▼            ▼
        ┌──────────┐ ┌──────────┐ ┌──────────┐
        │  Users   │ │  Orders  │ │ Products │  ← 各 Subgraph は独立開発・独立デプロイ
        │ Subgraph │ │ Subgraph │ │ Subgraph │
        └──────────┘ └──────────┘ └──────────┘
```

---

## コア概念

| 概念 | 説明 |
| --- | --- |
| Gateway / Router | 統一エントリポイント。クライアントのリクエストを分解し各 Subgraph に分配、結果を統合して返す |
| Subgraph | 各マイクロサービスが公開する GraphQL サービス。自分の担当部分の Schema を独立管理 |
| `@key` | エンティティの主キーを指定。Gateway がこれを使い、Subgraph 間で同一エンティティを関連付ける |
| `@external` | 「このフィールドは別の Subgraph で定義されている」と宣言。現在の Subgraph は参照のみ |
| `@requires` | 「このフィールドを解決するには、先に別の Subgraph から特定フィールドを取得する必要がある」と宣言 |

---

## コード例

二つの Subgraph が `@key` で同一の `User` エンティティを関連付ける：

```graphql
# -------- Users Subgraph --------
# User エンティティを定義。@key で Gateway に id で識別することを伝える
type User @key(fields: "id") {
  id: ID!
  name: String!
  email: String!
}

type Query {
  user(id: ID!): User
}
```

```graphql
# -------- Orders Subgraph --------
# User エンティティを拡張。@key で Users Subgraph の User と関連付ける
type User @key(fields: "id") {
  id: ID! @external          # id は Users Subgraph で定義済み、ここは参照のみ
  orders: [Order!]!          # 本サービスが担当するフィールド
}

type Order {
  id: ID!
  product: String!
  total: Float!
}
```

クライアントは一度のクエリで全てを取得できる：

```graphql
query {
  user(id: "1") {
    name          # ← Gateway が Users Subgraph から取得
    email         # ← Gateway が Users Subgraph から取得
    orders {      # ← Gateway が Orders Subgraph から取得
      product
      total
    }
  }
}
```

Gateway がサービス間のデータ関連付けを自動処理し、各 Subgraph は自分の担当のみ管理する

---

## Schema Stitching との違い

Schema Stitching はゲートウェイ層で各サービスの Schema を**手動で結合**し、統合ロジックをゲートウェイに記述する方式。Federation は各サービスがディレクティブ（`@key` 等）で**宣言的に協調**し、ゲートウェイはオーケストレーションのみ担当しビジネスロジックを持たない
