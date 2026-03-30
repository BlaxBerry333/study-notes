# Apollo

> Apollo Server + Apollo Client 全栈 GraphQL 开发

## 下载安装

::: code-group

```zsh [服务端 Apollo Server]
% npm install @apollo/server graphql
```

```zsh [客户端 Apollo Client]
% npm install @apollo/client graphql
```

:::

---

## 最小示例

以一个用户管理的 CRUD 为例，展示前后端完整实现

::: code-group

```ts [服务端 server.ts]
import { ApolloServer } from "@apollo/server";
import { startStandaloneServer } from "@apollo/server/standalone";

// 1. 定义 Schema
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

// 2. 定义 Resolver
const users = [
  { id: "1", name: "Alice", email: "alice@example.com" },
  { id: "2", name: "Bob", email: "bob@example.com" },
];

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

// 3. 启动服务
const server = new ApolloServer({ typeDefs, resolvers });
const { url } = await startStandaloneServer(server, { listen: { port: 4000 } });
console.log(`Server ready at ${url}`);
```

```tsx [客户端 App.tsx]
import {
  ApolloClient,
  InMemoryCache,
  ApolloProvider,
  useQuery,
  useMutation,
  gql,
} from "@apollo/client";

// 1. 初始化 Apollo Client
const client = new ApolloClient({
  uri: "http://localhost:4000/graphql",
  cache: new InMemoryCache(),
});

// 2. 定义查询和变更
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

// 3. 在组件中使用
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

// 4. 包裹 Provider
export default function App() {
  return (
    <ApolloProvider client={client}>
      <UserList />
    </ApolloProvider>
  );
}
```

:::

启动服务端后访问 `http://localhost:4000` 即可使用 Apollo Sandbox 进行交互式查询调试

---

## 查询（useQuery）

```tsx
import { useQuery } from "@apollo/client";
import { GET_USERS, GET_USER } from "./graphql/queries";

// 基本查询
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

// 条件查询
function UserDetail({ userId }: { userId: string }) {
  const { data, loading } = useQuery(GET_USER, {
    variables: { id: userId },
    skip: !userId, // 条件跳过
  });

  if (loading) return <p>Loading...</p>;
  return <div>{data?.user.name}</div>;
}
```

---

### useQuery 常用配置

| 配置                        | 说明               |
| --------------------------- | ------------------ |
| `variables: { ... }`        | 查询参数           |
| `skip: true`                | 条件跳过查询       |
| `pollInterval: 5000`        | 轮询               |
| `fetchPolicy: "..."`        | 缓存策略（见下表） |
| `onCompleted: (data) => {}` | 查询完成回调       |
| `onError: (error) => {}`    | 错误回调           |

::: warning 缓存策略（fetchPolicy）

| 策略                | 说明                         |
| ------------------- | ---------------------------- |
| `cache-first`       | 默认。先读缓存，没有才发请求 |
| `cache-and-network` | 先返回缓存，同时发请求更新   |
| `network-only`      | 总是发请求，结果写入缓存     |
| `cache-only`        | 只读缓存，不发请求           |
| `no-cache`          | 总是发请求，结果不写入缓存   |

:::

---

## 延迟查询（useLazyQuery）

手动触发查询，适用于搜索、按钮点击等场景

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

## 变更（useMutation）

```tsx
import { useMutation } from "@apollo/client";
import { CREATE_USER, GET_USERS } from "./graphql/queries";

function CreateUserForm() {
  const [createUser, { loading, error }] = useMutation(CREATE_USER, {
    // 方式一：refetchQueries — 简单，但多一次请求
    refetchQueries: [{ query: GET_USERS }],

    // 方式二：update — 手动更新缓存，无需额外请求
    // update(cache, { data: { createUser: newUser } }) {
    //   const existing = cache.readQuery({ query: GET_USERS });
    //   cache.writeQuery({
    //     query: GET_USERS,
    //     data: { users: [...existing.users, newUser] },
    //   });
    // },

    // 方式三：optimisticResponse — 立即更新 UI，体验最快
    // optimisticResponse: {
    //   createUser: {
    //     __typename: "User",
    //     id: "temp-id",
    //     name: "预期的名字",
    //     email: "预期的邮箱",
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

::: tip Mutation 后更新数据的三种方式

| 方式         | API                           | 特点                  |
| ------------ | ----------------------------- | --------------------- |
| 重新获取     | `refetchQueries`              | 最简单，多一次请求    |
| 手动更新缓存 | `update` + `cache.writeQuery` | 无额外请求，精确控制  |
| 乐观更新     | `optimisticResponse`          | UI 即时响应，体验最佳 |

:::

---

## 分页（fetchMore）

通过 `typePolicies` 定义分页合并策略，`fetchMore` 只需传递新的 `variables`，缓存自动合并

```tsx
import { ApolloClient, InMemoryCache, useQuery, gql } from "@apollo/client";

// 在 cache 初始化时定义合并策略
const client = new ApolloClient({
  uri: "http://localhost:4000/graphql",
  cache: new InMemoryCache({
    typePolicies: {
      Query: {
        fields: {
          posts: {
            keyArgs: false, // 不按参数区分缓存
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

> 分页的服务端 Schema 和 Resolver 实现详见[分页](/programming/web-backend/graphql/pagination)

---

## 订阅（useSubscription）

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

> 服务端 Subscription 的 PubSub 实现详见 [Subscription](/programming/web-backend/graphql/subscription)

---

## 分离 .graphql 文件

实际项目中推荐将 GraphQL 操作从 `.ts` 中分离到独立的 `.graphql` 文件，便于管理和代码生成

---

### 目录结构

```txt
src/
├── graphql/
│   ├── queries/
│   │   └── user.graphql      # Query 定义
│   ├── mutations/
│   │   └── user.graphql      # Mutation 定义
│   └── fragments/
│       └── user.graphql      # Fragment 定义
├── generated/
│   └── graphql.ts            # 自动生成的类型和 Hooks
└── components/
    └── UserList.tsx
```

---

### .graphql 文件定义

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
      - typescript # 生成 TypeScript 类型
      - typescript-operations # 生成 Query/Mutation 的变量和返回类型
      - typescript-react-apollo # 生成 useQuery/useMutation 的类型安全 Hooks
    config:
      withHooks: true
```

```zsh
% npx graphql-codegen
```

---

### 使用生成的类型安全 Hooks

```tsx
// 不再需要手写 gql`` 和手动定义类型
import { useGetUsersQuery, useCreateUserMutation } from "../generated/graphql";

function UserList() {
  // 返回值自动带有完整类型推断
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
          // user.name、user.email 等字段有完整的类型提示
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

::: tip .graphql 文件 vs gql 模板字符串

|          | `gql` 模板字符串     | `.graphql` 文件 + Codegen   |
| -------- | -------------------- | --------------------------- |
| 类型安全 | 手动定义或 `as` 断言 | 自动生成，完全类型安全      |
| IDE 支持 | 需插件高亮           | 原生语法高亮、自动补全      |
| 复用性   | 需导出常量           | `#import` 语法引入 Fragment |
| 构建优化 | 运行时解析           | 编译时处理，产物更小        |
| 适用场景 | 小项目、快速原型     | 中大型项目（推荐）          |

:::

---

## 与 TanStack Query 搭配

Apollo Client 也可以搭配 TanStack Query 使用 — Apollo 仅作为 GraphQL 请求层，缓存和状态管理交给 TanStack Query。适合项目中已有 TanStack Query 或团队更熟悉其心智模型的场景

<!-- TODO: TanStack Query + Apollo 的详细用法待补充到前端文档中 -->

| 场景                                            | 推荐方案                |
| ----------------------------------------------- | ----------------------- |
| 新项目，重度使用 GraphQL                        | Apollo Client 原生      |
| 项目已有 TanStack Query，部分接口迁移到 GraphQL | TanStack Query + Apollo |
| 需要 Subscription 实时推送                      | Apollo Client 原生      |
| 需要规范化缓存（同一对象自动同步）              | Apollo Client 原生      |

---

## 缓存设计

GraphQL 所有请求都是 `POST /graphql`，无法利用 HTTP 缓存，因此缓存必须在客户端实现。主流方案有两种思路：

| 维度     | 规范化缓存（Apollo）                                       | 文档缓存（urql）                                        |
| -------- | ---------------------------------------------------------- | ------------------------------------------------------- |
| 存储方式 | 将响应拆解为独立对象，以 `__typename:id` 为 key 扁平存储   | 以**查询 + 变量**为 key，整份响应作为 value 存储        |
| 自动同步 | 同一对象只存一份，任何查询更新了该对象，所有引用处自动更新 | 不自动同步，Mutation 后通过标记相关查询失效触发重新获取 |
| 精确度   | 高——对象级别更新，不会多余请求                             | 较低——按查询粒度失效，可能触发不必要的重新获取          |
| 复杂度   | 高——需要返回 `id` + `__typename`，缓存合并策略需手动配置   | 低——开箱即用，极少需要手动配置                          |
| 适用场景 | 数据关系复杂、多处引用同一对象、需要乐观更新               | 数据关系简单、追求轻量和快速集成                        |

::: warning 选哪个？
大多数项目选 **Apollo**（生态最大、功能最全）。如果项目数据关系简单、团队追求轻量，**urql** 的文档缓存上手成本更低。核心区别：规范化缓存用"拆对象"换精确更新，文档缓存用"整份存"换实现简单
:::

---

### 规范化缓存（InMemoryCache）

Apollo Client 的 `InMemoryCache` 将响应数据拆解为独立对象，以 `__typename:id` 为 key 存储

```txt
# 查询结果
{
  user(id: "1") {
    id
    name
    posts {
      id
      title
    }
  }
}

# Apollo 缓存中的存储结构
{
  "User:1": { __typename: "User", id: "1", name: "Alice", posts: ["Post:1", "Post:2"] },
  "Post:1": { __typename: "Post", id: "1", title: "Hello" },
  "Post:2": { __typename: "Post", id: "2", title: "World" },
  "ROOT_QUERY": { "user({\"id\":\"1\"})": { __ref: "User:1" } }
}
```

这意味着：

- 同一对象只存储一份，任何查询更新了 `User:1`，所有引用它的组件都会自动更新
- Mutation 返回的对象如果包含 `id` + `__typename`，缓存会自动合并更新

---

### 手动操作缓存

```ts
import { useApolloClient } from "@apollo/client";

function SomeComponent() {
  const client = useApolloClient();

  // 读取缓存
  const data = client.readQuery({ query: GET_USERS });

  // 写入缓存
  client.writeQuery({
    query: GET_USERS,
    data: { users: [...data.users, newUser] },
  });

  // 驱逐特定对象
  client.cache.evict({ id: "User:1" });
  client.cache.gc(); // 垃圾回收无引用对象
}
```

---

## 携带认证 Token

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
