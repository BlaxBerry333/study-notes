# Schema

> Schema 使用 SDL（Schema Definition Language）编写，定义 API 的数据结构和操作接口，是服务端和客户端之间的契约

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

::: tip Interface vs Union

- **Interface**：共享字段（如 `id`、`createdAt`），查询时可直接访问共享字段
- **Union**：无共同字段，查询时必须用内联 Fragment（`... on Type { }` ）
:::

---

## 操作类型

Schema 中定义三种根操作类型，客户端通过对应的操作语法发起请求

### Query

读取数据（类似 GET）

```graphql
type Query {
  user(id: ID!): User
  users(limit: Int = 10, offset: Int = 0): [User!]!
  search(keyword: String!): [SearchResult!]!
}
```

客户端查询时只选需要的字段，支持嵌套获取关联数据：

```graphql
query GetUser($id: ID!) {
  user(id: $id) {
    name
    posts {           # 嵌套查询关联数据
      title
      comments { text }
    }
  }
}
```

---

### Mutation

修改数据（类似 POST/PUT/DELETE）

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

::: warning Query vs Mutation 执行差异

- **Query** 中的多个字段可以**并行**执行
- **Mutation** 中的多个字段按**顺序**执行（保证操作顺序性）
:::

---

### Subscription

实时推送（基于 WebSocket）

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

> 服务端实现详见 [Subscription](/programming/web-backend/graphql/subscription)

---

## 客户端语法

### 变量

用 `$` 前缀定义，通过 JSON 单独传递，将动态值从查询字符串中分离

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

### 别名

同一字段不同参数查询多次时，用别名避免键名冲突

```graphql
query {
  admin: user(id: "1") { name }
  editor: user(id: "2") { name }
}
# → { "admin": { "name": "Alice" }, "editor": { "name": "Bob" } }
```

---

### Fragment

复用字段选择集

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

Union / Interface 类型用内联 Fragment 按具体类型选字段：

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

以 `@` 开头，用于条件控制字段

```graphql
query GetUser($withPosts: Boolean!, $hideEmail: Boolean!) {
  user(id: "1") {
    name
    email @skip(if: $hideEmail)
    posts @include(if: $withPosts) { title }
  }
}
```

Schema 中也可用 `@deprecated` 标记废弃字段：

```graphql
type User {
  username: String @deprecated(reason: "Use 'name' instead")
}
```

---

## Schema 开发模式

Schema 是**后端定义的契约**（类似 protobuf 的 `.proto` 文件），定义了 API 有哪些数据类型和操作。后端有两种方式来定义 Schema：

|             | Schema-First                                                                                                           | Code-First                                                                                     |
| ----------- | ---------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| 流程        | 后端先写 SDL → 工具生成类型/签名 → 实现 Resolver                                                                       | 后端先写代码（类/装饰器/函数）→ 框架自动生成 SDL                                               |
| Schema 来源 | 手写 `.graphql` 文件                                                                                                   | 代码即 Schema，运行时导出                                                                      |
| 类型安全    | 依赖 codegen 生成类型                                                                                                  | 语言本身的类型系统保证                                                                         |
| 代表框架    | [Apollo Server](/programming/web-backend/graphql/apollo)、<br/>[gqlgen（Go）](/programming/web-backend/graphql/gqlgen) | Strawberry（Python）、<br/>Pothos（TypeScript） |
| 适用场景    | 团队协作先定契约、<br/>前后端分离各自迭代                                                                              | 快速开发、<br/>类型系统强的语言（Python 类型注解、TypeScript）                                 |

```txt
Schema-First:
  后端写 schema.graphql → codegen → types.ts → 后端实现 Resolver
                                               （签名已确定，填逻辑即可）

Code-First:
  后端写 Python class / TS 函数 → 框架生成 SDL → 对外暴露 Schema
                                  （代码就是 Schema 的唯一真相源）
```

---

### codegen

codegen（如 `graphql-codegen`）解决的是**前端怎么拿到类型**的问题。它读取后端定义的 Schema，自动生成前后端都能用的 TypeScript 类型：

```txt
后端定义的 schema.graphql
         │
         ▼
    graphql-codegen
         │
    ┌────┴──────────────────────────────────────┐
    ▼                                           ▼
  后端用:                                      前端用:
  Resolver 参数/返回值类型                     Query/Mutation 的变量和返回类型
                                               类型安全的 useQuery/useMutation Hooks
```

::: warning 和 tRPC / protobuf 的对比

三者都是"后端定义契约 → 前端拿到类型"，区别在于前端拿到类型的方式：

| | 后端定义 | 前端怎么拿到类型 | 前端的自由度 |
| --- | --- | --- | --- |
| protobuf | `.proto` 文件 | `protoc` 编译 | 只能调用定义好的方法 |
| tRPC | TypeScript 函数 | TS 编译器直接推导（零 codegen） | 只能调用定义好的 procedure |
| GraphQL | Schema（SDL） | `graphql-codegen` 生成 | **可以自己写查询，按需选择字段** |

GraphQL 的 codegen 比 protobuf 的 `protoc` 多做了一件事：除了生成类型，还为前端写的每个 query/mutation 语句生成对应的类型化 Hook
:::

客户端 codegen 的具体配置见 [Apollo — GraphQL Code Generator](/programming/web-backend/graphql/apollo#graphql-code-generator)

---

## 语法速查

| 语法                  | 用途          | 示例                                          |
| --------------------- | ------------- | --------------------------------------------- |
| `query { }`           | 查询数据      | `query { users { name } }`                    |
| `mutation { }`        | 修改数据      | `mutation { createUser(...) { id } }`         |
| `subscription { }`    | 实时订阅      | `subscription { postCreated { title } }`      |
| `$变量名: 类型`       | 定义变量      | `query ($id: ID!) { user(id: $id) { name } }` |
| `别名: 字段`          | 字段别名      | `admin: user(id: "1") { name }`               |
| `fragment 名 on 类型` | 定义 Fragment | `fragment Info on User { id, name }`          |
| `...FragmentName`     | 展开 Fragment | `user { ...Info }`                            |
| `... on 类型 { }`     | 内联 Fragment | `... on User { name }`                        |
| `@include(if: $var)`  | 条件包含      | `posts @include(if: $withPosts) { title }`    |
| `@skip(if: $var)`     | 条件跳过      | `email @skip(if: $hide)`                      |
