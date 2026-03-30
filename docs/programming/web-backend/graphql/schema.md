# Schema

> Schema 使用 SDL（Schema Definition Language）编写，定义 API 的数据结构，是服务端和客户端之间的契约

---

## 标量类型

GraphQL 内置 5 种标量类型（Scalar Type）

| 类型      | 说明                          | 示例             |
| --------- | ----------------------------- | ---------------- |
| `Int`     | 32 位有符号整数               | `42`             |
| `Float`   | 双精度浮点数                  | `3.14`           |
| `String`  | UTF-8 字符串                  | `"hello"`        |
| `Boolean` | 布尔值                        | `true` / `false` |
| `ID`      | 唯一标识符（序列化为 String） | `"abc123"`       |

---

### 自定义标量

```graphql
scalar DateTime
scalar JSON
```

```ts
import { GraphQLScalarType, Kind } from "graphql";

const dateTimeScalar = new GraphQLScalarType({
  name: "DateTime",
  description: "ISO 8601 日期时间格式",
  serialize(value) {
    return value.toISOString(); // 服务端 → 客户端
  },
  parseValue(value) {
    return new Date(value); // 客户端变量 → 服务端
  },
  parseLiteral(ast) {
    if (ast.kind === Kind.STRING) return new Date(ast.value); // 内联值 → 服务端
    return null;
  },
});
```

---

## 类型修饰符

::: warning `!` 和 `[]` 的含义

| 写法         | 含义               | 可为 null |
| ------------ | ------------------ | --------- |
| `String`     | 可空字符串         | 是        |
| `String!`    | 非空字符串         | 否        |
| `[String]`   | 可空列表，元素可空 | 都可空    |
| `[String!]`  | 可空列表，元素非空 | 列表可空  |
| `[String!]!` | 非空列表，元素非空 | 都不可空  |

:::

---

## 对象类型

对象类型（Object Type）定义一组字段，是 Schema 中最常用的类型

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

type Comment {
  id: ID!
  text: String!
  author: User!
}
```

---

## 枚举类型

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

## 输入类型

输入类型（Input Type）专用于参数传递，不能包含 Resolver

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

- `type` 定义**输出**结构（Resolver 返回的数据）
- `input` 定义**输入**结构（客户端传递的参数）
- 不能混用：`type` 不能作为参数类型，`input` 不能作为返回类型
:::

---

## 接口与联合类型

### 接口（Interface）

多个类型共享相同字段时使用

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

type Post implements Node & Timestamped {
  id: ID!
  title: String!
  createdAt: DateTime!
  updatedAt: DateTime!
}
```

---

### 联合类型（Union）

多个类型没有共同字段时使用

```graphql
union SearchResult = User | Post | Comment

type Query {
  search(keyword: String!): [SearchResult!]!
}
```

查询时使用内联 Fragment 按类型选择字段：

```graphql
query {
  search(keyword: "GraphQL") {
    ... on User {
      name
      email
    }
    ... on Post {
      title
      content
    }
    ... on Comment {
      text
    }
  }
}
```

::: tip Interface vs Union

- **Interface**：共享字段（如 `id`、`createdAt`），查询时可直接访问共享字段
- **Union**：无共同字段，查询时必须用内联 Fragment
:::

---

## Directive

指令用于修改查询或 Schema 的执行行为

---


### 内置 Directive

```graphql
# @include / @skip：条件控制字段
query GetUser($withPosts: Boolean!, $hideEmail: Boolean!) {
  user(id: "1") {
    name
    email @skip(if: $hideEmail)
    posts @include(if: $withPosts) {
      title
    }
  }
}

# @deprecated：标记废弃字段
type User {
  id: ID!
  name: String!
  username: String @deprecated(reason: "Use 'name' instead")
}
```

---

## 根类型

每个 Schema 必须定义 Query 根类型，Mutation 和 Subscription 可选

```graphql
type Query {
  user(id: ID!): User
  users(limit: Int = 10, offset: Int = 0): [User!]!
  search(keyword: String!): [SearchResult!]!
}

type Mutation {
  createUser(input: CreateUserInput!): User!
  updateUser(id: ID!, input: UpdateUserInput!): User!
  deleteUser(id: ID!): Boolean!
}

type Subscription {
  postCreated: Post!
  commentAdded(postId: ID!): Comment!
}
```

::: warning 注意

使用 Apollo Server 时，`schema { query: Query, mutation: Mutation }` 块可以省略，框架会自动识别名为 `Query`、`Mutation`、`Subscription` 的根类型
:::

---

## Schema 开发模式

Schema 的定义方式分为两种模式：

|             | Schema-First                                                                                                           | Code-First                                                                                     |
| ----------- | ---------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| 流程        | 先写 SDL → 工具生成类型/签名 → 实现 Resolver                                                                           | 先写代码（类/装饰器/函数）→ 框架自动生成 SDL                                                   |
| Schema 来源 | 手写 `.graphql` 文件                                                                                                   | 代码即 Schema，运行时导出                                                                      |
| 类型安全    | 依赖 codegen 生成类型                                                                                                  | 语言本身的类型系统保证                                                                         |
| 代表框架    | [Apollo Server](/programming/web-backend/graphql/apollo)、<br/>[gqlgen（Go）](/programming/web-backend/graphql/gqlgen) | Strawberry（Python）、<br/>Pothos（TypeScript） |
| 适用场景    | 团队协作先定契约、<br/>前后端分离各自迭代                                                                              | 快速开发、<br/>类型系统强的语言（Python 类型注解、TypeScript）                                 |

```txt
Schema-First:
  schema.graphql → codegen → types.ts → 实现 Resolver
                                        （签名已确定，填逻辑即可）

Code-First:
  Python class / TS 函数 → 框架生成 SDL → 对外暴露 Schema
                           （代码就是 Schema 的唯一真相源）
```

---

### codegen 的角色

codegen（如 `graphql-codegen`）在 Schema-First 模式中尤为关键——它读取 SDL 文件，自动生成服务端的 Resolver 类型签名和客户端的查询类型：

```txt
schema.graphql ──▶ graphql-codegen ──▶ 服务端：Resolver 参数/返回值类型
                                   ──▶ 客户端：Query/Mutation 的变量和返回类型
                                   ──▶ 客户端：类型安全的 useQuery/useMutation Hooks
```

客户端 codegen 的具体配置见 [Apollo — GraphQL Code Generator](/programming/web-backend/graphql/apollo#graphql-code-generator)

---

### tRPC 和 Zod 属于哪种？

tRPC + Zod 既不是 Schema-First 也不是 Code-First——它**跳过了 Schema 这一层**：

|          | GraphQL（Schema-First） | GraphQL（Code-First） | tRPC + Zod                             |
| -------- | ----------------------- | --------------------- | -------------------------------------- |
| 契约定义 | SDL 文件                | 代码生成 SDL          | **无 Schema**，TypeScript 类型即契约   |
| 类型传播 | codegen 生成类型        | 框架导出类型          | **直接推导**，零 codegen               |
| 验证     | 框架按 Schema 验证      | 框架按 Schema 验证    | Zod 在运行时验证，类型自动推导给客户端 |

tRPC 的思路是：既然前后端都是 TypeScript，服务端的 Zod schema 定义了输入验证，TypeScript 编译器直接把类型传播到客户端，不需要中间的 SDL 层。这也是它只能用于 TypeScript 全栈项目的原因
