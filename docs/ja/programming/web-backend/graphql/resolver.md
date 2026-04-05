# Resolver

> Resolver は Schema の各フィールドに対するデータ解決関数であり、「データをどう取得するか」を定義する

---

## 4 つの引数

```ts
const resolvers = {
  Type名: {
    フィールド名: (parent, args, context, info) => {
      // parent:  親オブジェクトの戻り値（ルートクエリ時は undefined）
      // args:    クライアントが渡したパラメータ
      // context: 全 Resolver で共有するコンテキスト（データベース、認証など）
      // info:    クエリの AST 情報（高度な用途向け）
      return データ;
    },
  },
};
```

::: warning Resolver の実行順序

GraphQL はルート型から再帰的に各フィールドを解決する。フィールドがオブジェクト型を返す場合、そのオブジェクトの子フィールドの解決が続行される。
あるフィールドに Resolver が定義されていない場合、GraphQL エンジンは**デフォルト Resolver**（`parent[fieldName]` を返す）を使用する
:::

---

## 完全な例

```ts
const resolvers = {
  // ルートクエリ
  Query: {
    user: async (_, { id }, { db }) => {
      return db.users.findById(id);
    },
    users: async (_, { limit, offset }, { db }) => {
      return db.users.find().skip(offset).limit(limit);
    },
  },

  // ルートミューテーション
  Mutation: {
    createUser: async (_, { input }, { db }) => {
      return db.users.create(input);
    },
    updateUser: async (_, { id, input }, { db }) => {
      return db.users.findByIdAndUpdate(id, input, { new: true });
    },
    deleteUser: async (_, { id }, { db }) => {
      await db.users.findByIdAndDelete(id);
      return true;
    },
  },

  // フィールドレベル Resolver（関連クエリ）
  User: {
    // parent は現在の User オブジェクト
    posts: async (parent, _, { db }) => {
      return db.posts.find({ authorId: parent.id });
    },
  },

  Post: {
    author: async (parent, _, { db }) => {
      return db.users.findById(parent.authorId);
    },
    comments: async (parent, _, { db }) => {
      return db.comments.find({ postId: parent.id });
    },
  },

  // Union / Interface には __resolveType が必要
  SearchResult: {
    __resolveType(obj) {
      if (obj.email) return "User";
      if (obj.title) return "Post";
      if (obj.text) return "Comment";
      return null;
    },
  },
};
```

---

## Context と認証

Context はサーバー起動時に設定し、リクエストごとに 1 回生成され、全ての Resolver で共有される。認証は通常 Context 内で行う：

```ts
const server = new ApolloServer({ typeDefs, resolvers });

const { url } = await startStandaloneServer(server, {
  context: async ({ req }) => {
    const token = req.headers.authorization?.replace("Bearer ", "");
    let user = null;
    if (token) {
      try {
        user = await verifyToken(token);
      } catch {
        // トークン無効
      }
    }
    return { user, db: database, loaders: createLoaders(database) };
  },
});
```

---

### Resolver 内での権限チェック

```ts
import { GraphQLError } from "graphql";

const resolvers = {
  Query: {
    me: (_, __, { user }) => {
      if (!user) {
        throw new GraphQLError("Authentication required", {
          extensions: { code: "UNAUTHENTICATED" },
        });
      }
      return user;
    },
  },
  Mutation: {
    deleteUser: async (_, { id }, { user, db }) => {
      if (!user) {
        throw new GraphQLError("Authentication required", {
          extensions: { code: "UNAUTHENTICATED" },
        });
      }
      if (user.role !== "ADMIN") {
        throw new GraphQLError("Admin access required", {
          extensions: { code: "FORBIDDEN" },
        });
      }
      return db.users.findByIdAndDelete(id);
    },
  },
};
```

::: warning よく使われるエラーコード規約

GraphQL には標準的なエラーコード仕様がない。以下は Apollo エコシステムでよく使われる `extensions.code` である：

| code | 意味 | 対応する HTTP |
| --- | --- | --- |
| `BAD_USER_INPUT` | パラメータ検証失敗 | 400 |
| `UNAUTHENTICATED` | 未ログイン / トークン無効 | 401 |
| `FORBIDDEN` | 権限不足 | 403 |
| `NOT_FOUND` | リソースが存在しない | 404 |
| `INTERNAL_SERVER_ERROR` | サーバー内部エラー | 500 |

:::

> クライアントでのトークン付与設定は [Apollo -- 認証トークンの付与](/ja/programming/web-backend/graphql/apollo#携帯認証-token) を参照
> エラーレスポンスの形式と部分成功の仕組みは [セキュリティとエラーハンドリング -- エラーハンドリング](/ja/programming/web-backend/graphql/security#エラーハンドリング) を参照

---

## Mutation の戻り値設計

::: tip 推奨：Payload 型を返す

`Boolean!` だけを返すのではなく、変更後のオブジェクトを含む Payload 型を返すことで、クライアントがキャッシュを直接更新できるようにする
:::

```graphql
# 非推奨
type Mutation {
  deleteUser(id: ID!): Boolean!
}

# 推奨：変更後のオブジェクトを返す
type Mutation {
  createUser(input: CreateUserInput!): CreateUserPayload!
}

type CreateUserPayload {
  user: User!
  success: Boolean!
  message: String
}
```
