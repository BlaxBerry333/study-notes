# Apollo

> Apollo Server + Apollo Client によるフルスタック GraphQL 開発

## ダウンロードとインストール

::: code-group

```zsh [サーバー側 Apollo Server]
% npm install @apollo/server graphql
```

```zsh [クライアント側 Apollo Client]
% npm install @apollo/client graphql
```

:::

---

## 最小構成の例

ユーザー管理の CRUD を例に、フロントエンドとバックエンドの完全な実装を示す

::: code-group

```ts [サーバー側 server.ts]
import { ApolloServer } from "@apollo/server";
import { startStandaloneServer } from "@apollo/server/standalone";

// 1. Schema を定義
const typeDefs = `#graphql
  type User {
    id: ID!
    name: String!
    email: String!
  }

  type Query {
    users: [User!]!
    user(id: ID!): User
  }

  type Mutation {
    createUser(name: String!, email: String!): User!
    deleteUser(id: ID!): Boolean!
  }
`;

const users = [
  { id: "1", name: "Alice", email: "alice@example.com" },
  { id: "2", name: "Bob", email: "bob@example.com" },
];

// 2. Resolver を定義
const resolvers = {
  Query: {
    users: () => users,
    user: (_, { id }) => users.find((u) => u.id === id),
  },
  Mutation: {
    createUser: (_, { name, email }) => {
      const newUser = { id: String(users.length + 1), name, email };
      users.push(newUser);
      return newUser;
    },
    deleteUser: (_, { id }) => {
      const index = users.findIndex((u) => u.id === id);
      if (index === -1) return false;
      users.splice(index, 1);
      return true;
    },
  },
};

// 3. サーバーを起動
const server = new ApolloServer({ typeDefs, resolvers });
const { url } = await startStandaloneServer(server, { listen: { port: 4000 } });
console.log(`Server ready at ${url}`);
```

```tsx [クライアント側 App.tsx]
import {
  ApolloClient,
  InMemoryCache,
  ApolloProvider,
  useQuery,
  useMutation,
  gql,
} from "@apollo/client";

// 1. Apollo Client を初期化
const client = new ApolloClient({
  uri: "http://localhost:4000/graphql",
  cache: new InMemoryCache(),
});

// 2. クエリとミューテーションを定義
const GET_USERS = gql`
  query GetUsers {
    users {
      id
      name
      email
    }
  }
`;

const CREATE_USER = gql`
  mutation CreateUser($name: String!, $email: String!) {
    createUser(name: $name, email: $email) {
      id
      name
      email
    }
  }
`;

// 3. コンポーネント内で使用
function UserList() {
  const { data, loading, error } = useQuery(GET_USERS);
  const [createUser] = useMutation(CREATE_USER, {
    refetchQueries: [{ query: GET_USERS }],
  });

  if (loading) return <p>Loading...</p>;
  if (error) return <p>Error: {error.message}</p>;

  return (
    <div>
      <ul>
        {data.users.map((user) => (
          <li key={user.id}>
            {user.name} ({user.email})
          </li>
        ))}
      </ul>
      <button
        onClick={() =>
          createUser({
            variables: { name: "Charlie", email: "charlie@example.com" },
          })
        }
      >
        Add User
      </button>
    </div>
  );
}

// 4. Provider でラップ
export default function App() {
  return (
    <ApolloProvider client={client}>
      <UserList />
    </ApolloProvider>
  );
}
```

:::

サーバー起動後、`http://localhost:4000` にアクセスすると Apollo Sandbox でインタラクティブなクエリデバッグができる

---

## クエリ（useQuery）

```tsx
import { useQuery } from "@apollo/client";
import { GET_USERS, GET_USER } from "./graphql/queries";

// 基本クエリ
function UserList() {
  const { data, loading, error } = useQuery(GET_USERS, {
    variables: { limit: 10 },
  });

  if (loading) return <p>Loading...</p>;
  if (error) return <p>Error: {error.message}</p>;

  return (
    <ul>
      {data.users.map((user) => (
        <li key={user.id}>{user.name}</li>
      ))}
    </ul>
  );
}

// 条件付きクエリ
function UserDetail({ userId }: { userId: string }) {
  const { data, loading } = useQuery(GET_USER, {
    variables: { id: userId },
    skip: !userId, // 条件付きスキップ
  });

  if (loading) return <p>Loading...</p>;
  return <div>{data?.user.name}</div>;
}
```

---

### useQuery の主な設定

| 設定                        | 説明                       |
| --------------------------- | -------------------------- |
| `variables: { ... }`        | クエリパラメータ           |
| `skip: true`                | 条件付きスキップ           |
| `pollInterval: 5000`        | ポーリング                 |
| `fetchPolicy: "..."`        | キャッシュ戦略（下記参照） |
| `onCompleted: (data) => {}` | クエリ完了コールバック     |
| `onError: (error) => {}`    | エラーコールバック         |

> キャッシュ戦略（fetchPolicy）の詳細は [キャッシュ — 読取策略](/ja/programming/web-backend/graphql/caching#読取策略-fetchpolicy)を参照

---

## 遅延クエリ（useLazyQuery）

手動でクエリをトリガーする。検索やボタンクリックなどのシーンに適している

```tsx
import { useLazyQuery } from "@apollo/client";
import { GET_USER } from "./graphql/queries";

function SearchUser() {
  const [getUser, { data, loading }] = useLazyQuery(GET_USER);

  return (
    <div>
      <button onClick={() => getUser({ variables: { id: "1" } })}>
        Search
      </button>
      {loading && <p>Loading...</p>}
      {data && <p>{data.user.name}</p>}
    </div>
  );
}
```

---

## ミューテーション（useMutation）

```tsx
import { useMutation } from "@apollo/client";
import { CREATE_USER, GET_USERS } from "./graphql/queries";

function CreateUserForm() {
  const [createUser, { loading, error }] = useMutation(CREATE_USER, {
    // 方式 1：refetchQueries -- シンプルだが追加リクエストが発生
    refetchQueries: [{ query: GET_USERS }],

    // 方式 2：update -- キャッシュを手動更新、追加リクエスト不要
    // update(cache, { data: { createUser: newUser } }) {
    //   const existing = cache.readQuery({ query: GET_USERS });
    //   cache.writeQuery({
    //     query: GET_USERS,
    //     data: { users: [...existing.users, newUser] },
    //   });
    // },

    // 方式 3：optimisticResponse -- UI を即座に更新、体感最速
    // optimisticResponse: {
    //   createUser: {
    //     __typename: "User",
    //     id: "temp-id",
    //     name: "予想される名前",
    //     email: "予想されるメール",
    //   },
    // },
  });

  const handleSubmit = async () => {
    await createUser({
      variables: { input: { name: "Charlie", email: "charlie@example.com" } },
    });
  };

  return (
    <div>
      <button onClick={handleSubmit} disabled={loading}>
        {loading ? "Creating..." : "Create User"}
      </button>
      {error && <p>Error: {error.message}</p>}
    </div>
  );
}
```

::: tip Mutation 後のデータ更新 3 つの方式

| 方式               | API                           | 特徴                             |
| ------------------ | ----------------------------- | -------------------------------- |
| 再取得             | `refetchQueries`              | 最もシンプル、追加リクエストあり |
| キャッシュ手動更新 | `update` + `cache.writeQuery` | 追加リクエストなし、精密制御     |
| 楽観的更新         | `optimisticResponse`          | UI 即時反映、体感最良            |

詳細な比較とコード例は [キャッシュ — Mutation 後のキャッシュ更新](/ja/programming/web-backend/graphql/caching#mutation-後のキャッシュ更新)を参照

:::

---

## ページネーション（fetchMore）

`typePolicies` でページネーションのマージ戦略を定義すると、`fetchMore` は新しい `variables` を渡すだけでキャッシュが自動的にマージされる

```tsx
import { ApolloClient, InMemoryCache, useQuery, gql } from "@apollo/client";

// キャッシュ初期化時にマージ戦略を定義
const client = new ApolloClient({
  uri: "http://localhost:4000/graphql",
  cache: new InMemoryCache({
    typePolicies: {
      Query: {
        fields: {
          posts: {
            keyArgs: false, // パラメータでキャッシュを区別しない
            merge(existing, incoming) {
              return {
                ...incoming,
                items: [...(existing?.items ?? []), ...incoming.items],
              };
            },
          },
        },
      },
    },
  }),
});

const GET_POSTS = gql`
  query GetPosts($offset: Int!, $limit: Int!) {
    posts(offset: $offset, limit: $limit) {
      items {
        id
        title
      }
      totalCount
      hasMore
    }
  }
`;

function PostList() {
  const { data, loading, fetchMore } = useQuery(GET_POSTS, {
    variables: { offset: 0, limit: 10 },
  });

  if (loading) return <p>Loading...</p>;

  return (
    <div>
      {data.posts.items.map((post) => (
        <div key={post.id}>{post.title}</div>
      ))}
      {data.posts.hasMore && (
        <button
          onClick={() =>
            fetchMore({ variables: { offset: data.posts.items.length } })
          }
        >
          Load More
        </button>
      )}
    </div>
  );
}
```

> ページネーションのサーバー側 Schema と Resolver の実装は[ページネーション](/ja/programming/web-backend/graphql/pagination)を参照

---

## サブスクリプション（useSubscription）

Subscription は WebSocket で通信するため、`GraphQLWsLink` の追加設定が必要であり、`split` で HTTP リクエストと WebSocket リクエストを振り分ける：

```ts
import { ApolloClient, InMemoryCache, HttpLink, split } from "@apollo/client";
import { GraphQLWsLink } from "@apollo/client/link/subscriptions";
import { createClient } from "graphql-ws";
import { getMainDefinition } from "@apollo/client/utilities";

const httpLink = new HttpLink({ uri: "http://localhost:4000/graphql" });

const wsLink = new GraphQLWsLink(
  createClient({ url: "ws://localhost:4000/graphql" }),
);

// Query/Mutation は HTTP、Subscription は WebSocket
const splitLink = split(
  ({ query }) => {
    const definition = getMainDefinition(query);
    return (
      definition.kind === "OperationDefinition" &&
      definition.operation === "subscription"
    );
  },
  wsLink,
  httpLink,
);

const client = new ApolloClient({
  link: splitLink,
  cache: new InMemoryCache(),
});
```

::: warning graphql-ws のインストールが必要

```zsh
% npm install graphql-ws
```

`subscriptions-transport-ws` は非推奨であり、`graphql-ws` を使用する
:::

---

### useSubscription

```tsx
import { useSubscription, gql } from "@apollo/client";

const ON_POST_CREATED = gql`
  subscription OnPostCreated {
    postCreated {
      id
      title
      author {
        name
      }
    }
  }
`;

function NewPostFeed() {
  const { data, loading } = useSubscription(ON_POST_CREATED);

  if (loading) return <p>Waiting for new posts...</p>;
  return <p>New post: {data.postCreated.title}</p>;
}
```

> サーバー側 Subscription の PubSub 実装は [Subscription](/ja/programming/web-backend/graphql/subscription) を参照

---

## .graphql ファイルの分離

実際のプロジェクトでは、GraphQL の操作を `.ts` から独立した `.graphql` ファイルに分離することを推奨する。管理とコード生成がしやすくなる

---

### ディレクトリ構造

```txt
src/
├── graphql/
│   ├── queries/
│   │   └── user.graphql      # Query 定義
│   ├── mutations/
│   │   └── user.graphql      # Mutation 定義
│   └── fragments/
│       └── user.graphql      # Fragment 定義
├── generated/
│   └── graphql.ts            # 自動生成された型と Hooks
└── components/
    └── UserList.tsx
```

---

### .graphql ファイルの定義

::: code-group

```graphql [graphql/fragments/user.graphql]
fragment UserFields on User {
  id
  name
  email
}
```

```graphql [graphql/queries/user.graphql]
#import "../fragments/user.graphql"

query GetUsers {
  users {
    ...UserFields
  }
}

query GetUser($id: ID!) {
  user(id: $id) {
    ...UserFields
  }
}
```

```graphql [graphql/mutations/user.graphql]
#import "../fragments/user.graphql"

mutation CreateUser($input: CreateUserInput!) {
  createUser(input: $input) {
    ...UserFields
  }
}

mutation DeleteUser($id: ID!) {
  deleteUser(id: $id)
}
```

:::

---

### GraphQL Code Generator

```zsh
% npm install -D @graphql-codegen/cli @graphql-codegen/typescript @graphql-codegen/typescript-operations @graphql-codegen/typescript-react-apollo
```

```yaml
# codegen.yml
schema: "http://localhost:4000/graphql"
documents: "src/graphql/**/*.graphql"
generates:
  src/generated/graphql.ts:
    plugins:
      - typescript # TypeScript の型を生成
      - typescript-operations # Query/Mutation の変数と戻り値型を生成
      - typescript-react-apollo # 型安全な useQuery/useMutation Hooks を生成
    config:
      withHooks: true
```

```zsh
% npx graphql-codegen
```

---

### 生成された型安全な Hooks の使用

```tsx
// gql`` を手書きしたり型を手動定義する必要がなくなる
import { useGetUsersQuery, useCreateUserMutation } from "../generated/graphql";

function UserList() {
  // 戻り値に完全な型推論が自動的に付く
  const { data, loading, error } = useGetUsersQuery();
  const [createUser] = useCreateUserMutation({
    refetchQueries: ["GetUsers"],
  });

  if (loading) return <p>Loading...</p>;
  if (error) return <p>Error: {error.message}</p>;

  return (
    <div>
      <ul>
        {data?.users.map((user) => (
          // user.name、user.email などのフィールドに完全な型補完がある
          <li key={user.id}>
            {user.name} ({user.email})
          </li>
        ))}
      </ul>
      <button
        onClick={() =>
          createUser({
            variables: {
              input: { name: "Charlie", email: "charlie@example.com" },
            },
          })
        }
      >
        Add User
      </button>
    </div>
  );
}
```

::: tip .graphql ファイル vs gql テンプレート文字列

|              | `gql` テンプレート文字列               | `.graphql` ファイル + Codegen          |
| ------------ | -------------------------------------- | -------------------------------------- |
| 型安全       | 手動定義 or `as` アサーション          | 自動生成、完全な型安全                 |
| IDE サポート | プラグインでハイライト                 | ネイティブの構文ハイライト・自動補完   |
| 再利用性     | 定数をエクスポート                     | `#import` 構文で Fragment を取り込み   |
| ビルド最適化 | ランタイムでパース                     | コンパイル時に処理、成果物がより小さい |
| 適用シーン   | 小規模プロジェクト、素早いプロトタイプ | 中大規模プロジェクト（推奨）           |

:::

---

## TanStack Query との併用

Apollo Client は TanStack Query と組み合わせて使うこともできる。Apollo は GraphQL リクエスト層としてのみ使い、キャッシュと状態管理は TanStack Query に任せる。プロジェクトに既に TanStack Query がある場合や、チームがそのメンタルモデルに慣れている場合に適している

<!-- TODO: TanStack Query + Apollo の詳細な使い方はフロントエンドのドキュメントに追記予定 -->

| シーン                                                                 | 推奨方式                 |
| ---------------------------------------------------------------------- | ------------------------ |
| 新規プロジェクト、GraphQL をヘビーに使用                               | Apollo Client ネイティブ |
| プロジェクトに既に TanStack Query があり、一部の API を GraphQL に移行 | TanStack Query + Apollo  |
| Subscription のリアルタイム配信が必要                                  | Apollo Client ネイティブ |
| 正規化キャッシュが必要（同一オブジェクトの自動同期）                   | Apollo Client ネイティブ |

---

> キャッシュ設計（正規化キャッシュ vs ドキュメントキャッシュ、fetchPolicy、Mutation 後のキャッシュ更新、手動操作）の詳細は [キャッシュ](/ja/programming/web-backend/graphql/caching)を参照

---

## 認証トークンの付与

```ts
import { ApolloClient, InMemoryCache, createHttpLink } from "@apollo/client";
import { setContext } from "@apollo/client/link/context";

const httpLink = createHttpLink({ uri: "http://localhost:4000/graphql" });

const authLink = setContext((_, { headers }) => ({
  headers: {
    ...headers,
    authorization: localStorage.getItem("token")
      ? `Bearer ${localStorage.getItem("token")}`
      : "",
  },
}));

const client = new ApolloClient({
  link: authLink.concat(httpLink),
  cache: new InMemoryCache(),
});
```
