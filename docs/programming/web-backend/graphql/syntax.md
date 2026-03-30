# GraphQL 语法

## Query

读取数据，类似 REST 的 GET 请求

---


### 基本查询

```graphql
# 查询单个字段
query {
  hello
}
# → { "data": { "hello": "Hello, GraphQL!" } }

# 查询对象（选择需要的字段）
query {
  users {
    id
    name
  }
}
# → { "data": { "users": [{ "id": "1", "name": "Alice" }, ...] } }
```

---

### 带参数查询

```graphql
# 必需参数
query {
  user(id: "1") {
    name
    email
  }
}

# 可选参数 + 默认值（由 Schema 定义）
query {
  users(limit: 5, offset: 0) {
    name
  }
}

# 枚举参数
query {
  users(role: ADMIN) {
    name
    email
  }
}

# 对象参数（Input Type）
query {
  users(filter: { minAge: 18, maxAge: 30 }) {
    name
    age
  }
}
```

---

### 嵌套查询

一次请求获取关联数据，这是 GraphQL 最强大的特性

```graphql
query {
  user(id: "1") {
    name
    posts {
      title
      comments {
        text
        author {
          name
        }
      }
    }
  }
}
```

---

### 操作名称

为查询命名，便于调试和日志追踪（生产环境推荐始终命名）

```graphql
query GetUserWithPosts {
  user(id: "1") {
    name
    posts {
      title
    }
  }
}
```

---

## 变量

使用变量将动态值从查询字符串中分离，提高复用性和安全性

---


### 基本用法

```graphql
# 定义变量：$前缀 + 类型
query GetUser($userId: ID!) {
  user(id: $userId) {
    name
    email
  }
}
```

变量通过 JSON 单独传递：

```json
{ "userId": "1" }
```

---

### 默认值

```graphql
query GetUsers($limit: Int = 10, $offset: Int = 0) {
  users(limit: $limit, offset: $offset) {
    name
  }
}
```

---

### 用于复杂输入

```graphql
mutation CreateUser($input: CreateUserInput!) {
  createUser(input: $input) {
    id
    name
  }
}
```

```json
{
  "input": {
    "name": "Charlie",
    "email": "charlie@example.com",
    "age": 25
  }
}
```

---

## 别名

同一字段不同参数查询多次时，使用别名避免键名冲突

```graphql
query {
  admin: user(id: "1") {
    name
    role
  }
  editor: user(id: "2") {
    name
    role
  }
}
```

```json
{
  "data": {
    "admin": { "name": "Alice", "role": "ADMIN" },
    "editor": { "name": "Bob", "role": "EDITOR" }
  }
}
```

---

## Fragment

复用字段选择集，避免重复编写

---


### 命名 Fragment

```graphql
# 定义
fragment UserBasicInfo on User {
  id
  name
  email
}

fragment PostSummary on Post {
  id
  title
  createdAt
}

# 使用（...展开语法）
query {
  user(id: "1") {
    ...UserBasicInfo
    posts {
      ...PostSummary
    }
  }
}
```

---

### 内联 Fragment

用于 Interface 或 Union 类型，根据具体类型选择不同字段

```graphql
query SearchAll($keyword: String!) {
  search(keyword: $keyword) {
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

---

### Fragment 中使用变量

Fragment 可以访问查询中定义的变量

```graphql
query GetUser($showEmail: Boolean!) {
  user(id: "1") {
    ...UserInfo
  }
}

fragment UserInfo on User {
  name
  email @include(if: $showEmail)
}
```

---

## Mutation

创建、更新、删除数据，类似 REST 的 POST/PUT/DELETE

---


### 基本用法

```graphql
# 创建
mutation {
  createUser(input: { name: "Alice", email: "alice@example.com" }) {
    id
    name
  }
}

# 更新
mutation {
  updateUser(id: "1", input: { name: "Alice Updated" }) {
    id
    name
  }
}

# 删除
mutation {
  deleteUser(id: "1")
}
```

---

### 使用变量

```graphql
mutation CreateUser($input: CreateUserInput!) {
  createUser(input: $input) {
    id
    name
    email
  }
}
```

```json
{
  "input": {
    "name": "Charlie",
    "email": "charlie@example.com"
  }
}
```

---

### 多个 Mutation

多个 Mutation 按**顺序**执行（不同于 Query 可以并行）

```graphql
mutation SetupNewUser {
  createUser(input: { name: "Dave", email: "dave@example.com" }) {
    id
  }
  createPost(
    input: { title: "My First Post", content: "Hello!", authorId: "new" }
  ) {
    id
  }
}
```

::: warning Query vs Mutation 执行差异

- **Query** 中的多个字段可以**并行**执行
- **Mutation** 中的多个字段按**顺序**执行（保证操作顺序性）
- 如果需要事务性操作，应在单个 Mutation 的 Resolver 中处理
:::

---

### Input Type

参数多时用 Input Type 封装（推荐实践）

```graphql
# Schema 定义
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

> `type` 与 `input` 的区别、Mutation 返回值 Payload 设计详见 [Schema — 输入类型](/programming/web-backend/graphql/schema#输入类型) 和 [Resolver — Mutation 返回值设计](/programming/web-backend/graphql/resolver#mutation-返回值设计)

---

## Directive

指令以 `@` 开头，用于修改查询或 Schema 的执行行为

```graphql
# 查询中使用 @include 和 @skip 条件控制字段
query GetUser($withPosts: Boolean!, $hideEmail: Boolean!) {
  user(id: "1") {
    name
    email @skip(if: $hideEmail)
    posts @include(if: $withPosts) {
      title
    }
  }
}
```

> 内置指令完整列表和自定义 Directive 详见 [Schema — Directive](/programming/web-backend/graphql/schema#directive)

---

## Subscription

实时数据推送，基于 WebSocket 协议

---


### 语法

```graphql
# 订阅新文章
subscription OnPostCreated {
  postCreated {
    id
    title
    author {
      name
    }
  }
}

# 带参数订阅
subscription OnNewComment($postId: ID!) {
  commentAdded(postId: $postId) {
    id
    text
    author {
      name
    }
  }
}
```

> 服务端实现详见 [Subscription](/programming/web-backend/graphql/subscription)，客户端使用详见 [Apollo — 订阅](/programming/web-backend/graphql/apollo#订阅-usesubscription)

---

## 语法速查表

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
