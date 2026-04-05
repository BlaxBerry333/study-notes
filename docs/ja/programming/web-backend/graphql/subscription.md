# Subscription

Subscription は GraphQL の 3 番目のルート操作型（Query は読み取り、Mutation は書き込み、Subscription は購読）であり、サーバーからクライアントへリアルタイムにデータを配信するために使用する

## Query/Mutation との違い

Query と Mutation は**一問一答**のモデルである。クライアントが 1 つのリクエストを送り、サーバーが 1 つのレスポンスを返して接続が終了する。クライアントが「新しい記事があるか」を知りたい場合、ポーリング（数秒ごとに Query を送る）するしかない

Subscription は異なる。クライアントが「新しい記事を監視したい」と宣言すると、**接続が維持され**、サーバーは新しい記事がある時に自動的にプッシュする。クライアントが繰り返しリクエストする必要はない

```txt
Query/Mutation（HTTP リクエスト、一問一答）:

  Client ─── "ユーザー一覧をくれ" ──▶ Server
  Client ◀── [ユーザーデータ] ──────── Server
  （接続終了）


Subscription（WebSocket 長時間接続、継続的配信）:

  Client ─── "新しい記事を監視したい" ──▶ Server
  （接続維持...）
  Client ◀── 新記事 A ──────────── Server    ← 誰かが記事を投稿、サーバーが自動プッシュ
  （接続維持...）
  Client ◀── 新記事 B ──────────── Server    ← また誰かが記事を投稿
  （接続維持...クライアントが購読解除するまで）
```

::: warning 転送プロトコルの違い

- Query / Mutation は通常の **HTTP** リクエストを使用
- Subscription は **WebSocket** 長時間接続を使用（[詳細](/ja/programming/web-backend/websocket/)）
- 2 つの転送方式は同一の Apollo Server 内で共存し、クライアントは操作型に応じて自動的にプロトコルを選択する
:::

---

## 動作原理

Subscription は**パブリッシュ/サブスクライブ（Pub/Sub）モデル**に基づいており、核心は 3 つの役割である：

| 役割 | 何をするか | 例え |
| --- | --- | --- |
| 購読者（Subscriber） | クライアントが「あるイベントを監視したい」と宣言 | ある配信者をフォローする |
| 発行者（Publisher） | サーバーがデータ変更時にイベントを発行 | 配信者が新しい動画を投稿 |
| イベントバス（PubSub） | 仲介者、イベントを全ての購読者に配信する | プラットフォームの通知システム |

完全なフロー：

```txt
① クライアントが購読
   Client A ─── subscription { postCreated { title } } ───▶ Server
                                                              │
                                                         PubSub 登録:
                                                         Client A が "POST_CREATED" を監視

② Mutation がイベントをトリガー（任意のクライアントがトリガー可能）
   Client B ─── mutation { createPost(title: "Hello") } ──▶ Server
                                                              │
                                                         Resolver 実行:
                                                         1. データベースに保存
                                                         2. pubsub.publish("POST_CREATED", data)
                                                              │
                                                              ▼
③ PubSub が全購読者に配信
   Server ──▶ Client A: { data: { postCreated: { title: "Hello" } } }
```

---

## Schema 定義

Query、Mutation と同様に Schema 内で定義する。パラメータはフィルタリングに使用する。例えば特定の記事の新しいコメントだけを監視する場合：

```graphql
type Subscription {
  postCreated: Post!                     # 全ての新記事を監視
  commentAdded(postId: ID!): Comment!    # 指定した記事の新コメントだけを監視
}
```

---

## サーバー側の実装

2 つのステップが必要である：Mutation の Resolver で**イベントを発行**し、Subscription の Resolver で**監視を登録**する

```ts
import { PubSub } from "graphql-subscriptions";

// PubSub はイベントバスであり、イベントの発行と配信を担当する
const pubsub = new PubSub();

const resolvers = {
  // ① Mutation でイベントを発行
  Mutation: {
    createPost: async (_, { input }, { db }) => {
      const post = await db.posts.create(input);
      // データ書き込み成功後、イベントを発行して全購読者に通知
      pubsub.publish("POST_CREATED", { postCreated: post });
      return post;
    },

    addComment: async (_, { postId, input }, { db }) => {
      const comment = await db.comments.create({ ...input, postId });
      // postId ごとに異なるチャンネルに発行し、該当記事を購読しているクライアントだけに通知
      pubsub.publish(`COMMENT_ADDED_${postId}`, { commentAdded: comment });
      return comment;
    },
  },

  // ② Subscription で監視を登録
  Subscription: {
    postCreated: {
      // subscribe は非同期イテレータを返し、PubSub がイベントを受信すると自動的にクライアントにプッシュ
      subscribe: () => pubsub.asyncIterator(["POST_CREATED"]),
    },
    commentAdded: {
      // パラメータ付き：クライアントが渡した postId に応じて対応するチャンネルを監視
      subscribe: (_, { postId }) =>
        pubsub.asyncIterator([`COMMENT_ADDED_${postId}`]),
    },
  },
};
```

::: warning `publish` のデータ形式

`pubsub.publish` の第 2 引数は `{ フィールド名: データ }` の形式でなければならず、フィールド名は Schema で定義した Subscription のフィールド名と一致させる必要がある：

```ts
// Schema: postCreated: Post!
// ↓ フィールド名は "postCreated" でなければならない
pubsub.publish("POST_CREATED", { postCreated: post });
```

フィールド名を間違えてもエラーにはならないが、クライアントが受け取るデータは `null` になる
:::

---

## 本番環境

::: danger PubSub は開発環境専用

上記で使用した `PubSub` は**インメモリ**のイベントバスである。イベントは現在のプロセス内でのみ伝播する。本番環境では通常複数のサーバーインスタンスをデプロイするため、インスタンス A で発行されたイベントは、インスタンス B に接続しているクライアントには届かない：

```txt
Client A が Server 1 に接続 ──── POST_CREATED を購読
Client B が Server 2 で createPost を実行 ──── publish("POST_CREATED")
                                              │
                                         イベントは Server 2 のメモリ内のみ
                                         Server 1 は知らない → Client A は受信できない
```

本番環境では Redis などの分散ソリューションに置き換え、全インスタンスが同一のイベントバスを共有する：

| 方式 | パッケージ | 説明 |
| --- | --- | --- |
| Redis Pub/Sub | `graphql-redis-subscriptions` | 最もよく使われる、軽量 |
| Kafka | `graphql-kafka-subscriptions` | メッセージの永続化や遡及消費が必要な場合に使用 |

置き換え方法は 1 行変えるだけで、Resolver のコードは変更不要：

```ts
// 開発環境
const pubsub = new PubSub();

// 本番環境：Redis に置き換え
import { RedisPubSub } from "graphql-redis-subscriptions";
const pubsub = new RedisPubSub();  // 他のコードは一切変更なし
```

:::

> クライアント側の購読の使い方は [Apollo -- 購読](/ja/programming/web-backend/graphql/apollo#購読-usesubscription) を参照
