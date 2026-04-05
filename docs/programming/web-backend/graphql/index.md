---
prev: false
next: false
---

# GraphQL

GraphQL 是一种 API 查询语言——**后端定义数据结构（Schema），前端按需查询所需字段**

::: warning 特点:

- 所有请求通过单一端点（通常为 `POST /graphql`）处理
- 客户端精确指定所需字段，避免 Over-fetching（返回多余字段）和 Under-fetching（一个页面要调多个接口），适合移动端省流量、多客户端共用一套 API
- 使用强类型 Schema 定义数据结构，自带 API 文档
- 内置 Subscription 支持实时数据推送

:::

::: danger 局限性:

- 嵌套查询容易触发 [N+1 问题](/programming/web-backend/graphql/n-plus-one)，必须引入 DataLoader
- 所有请求 `POST /graphql`，无法利用 HTTP 缓存和 CDN，需要[客户端缓存方案](/programming/web-backend/graphql/caching)
- HTTP 状态码始终 `200`，日志和监控需额外适配
- 客户端可构造任意查询，需要额外实现[深度限制、复杂度限制、持久化查询](/programming/web-backend/graphql/security)
- 服务端要维护 Schema + Resolver + DataLoader + 权限控制，比 REST 重
:::

::: info 适用场景

- 多客户端 ( Web / Mobile ) 共用一套 API（GitHub API v4）
- 移动端省流量
- 数据关系复杂的产品需要灵活组合（Shopify、Yelp）
- 前后端团队分离各自迭代

:::

```txt
┏━━━━━━━━━━ REST API ━━━━━━━━━━━┓
┃                               ┃
┃  GET /api/user/1              ┃  → { id, name, email, avatar, bio, ... }
┃  GET /api/user/1/posts        ┃  → [{ id, title, content, ... }, ...]
┃  GET /api/user/1/followers    ┃  → [{ id, name, ... }, ...]
┃                               ┃
┃  3 个请求，每个可能返回多余字段    ┃
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
┃  1 个请求，只返回所需字段         ┃
┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛
```

## 基础概念

| 概念         | 谁负责   | 一句话说明                                  | 详细                                                     |
| ------------ | -------- | ------------------------------------------- | -------------------------------------------------------- |
| Schema       | **后端** | 定义有哪些数据类型和操作接口（API 的契约）  | [详见](/programming/web-backend/graphql/schema)          |
| Resolver     | **后端** | 每个字段如何获取数据的函数                  | [详见](/programming/web-backend/graphql/resolver)        |
| Query        | **前端** | 按需查询数据（类似 GET）                    | [详见](/programming/web-backend/graphql/schema#query)    |
| Mutation     | **前端** | 按需修改数据（类似 POST/PUT/DELETE）        | [详见](/programming/web-backend/graphql/schema#mutation) |
| Subscription | **前端** | 订阅实时数据推送（WebSocket）               | [详见](/programming/web-backend/graphql/subscription)    |
| codegen      | **工具** | 读取后端 Schema，为前端生成 TypeScript 类型 | [详见](/programming/web-backend/graphql/schema#codegen)  |

::: tip Schema 和 Query 的关系

Schema 和 Query 语法看起来很像（都用花括号描述结构），但本质完全不同：

- **Schema**（后端写）= 类型定义，声明"有什么数据、什么类型"，类似数据库建表 `CREATE TABLE`
- **Query**（前端写）= 查询语句，从 Schema 定义的字段中"挑这次要哪些"，类似 `SELECT name, title FROM ...`

```txt
Schema（类型定义）        Query（请求结构）         响应（按请求返回）
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
└─────────────────┘     从 7 个字段里选了 2 个    只返回选的 2 个
```

Schema 整个 API 只有一份（后端维护），Query 有很多份（每个页面/组件按需写不同的查询）
:::

## 下载安装

GraphQL 本身是规范，需要选择具体实现：

| 实现                      | 语言       | 说明                                   | 实装                                            |
| ------------------------- | ---------- | -------------------------------------- | ----------------------------------------------- |
| Apollo（Server + Client） | TypeScript | 最流行的全栈方案，生态完善             | [详见](/programming/web-backend/graphql/apollo) |
| gqlgen                    | Go         | Schema-First，自动生成类型安全代码     | [详见](/programming/web-backend/graphql/gqlgen) |
| Strawberry                | Python     | Code-First，基于类型注解，搭配 FastAPI | —                                               |
| Yoga + Pothos             | TypeScript | 轻量服务端 + Code-First Schema         | —                                               |
| Relay                     | TypeScript | Meta 官方客户端，强约定                | —                                               |
| urql                      | TypeScript | 轻量客户端，可扩展                     | —                                               |

## 基本使用

::: warning 前后端分工

和 tRPC、protobuf 一样，**后端定义契约，前端消费契约**：

```txt
protobuf:  后端写 .proto    → protoc 编译  → 前后端各拿到自己语言的类型
tRPC:      后端写 procedure → TS 编译器    → 前端自动拿到类型（零 codegen）
GraphQL:   后端写 Schema    → codegen 生成 → 前端拿到 TS 类型 + 自己写查询语句
```

GraphQL 比 tRPC/protobuf 多一步：前端除了拿到类型，还要**自己写 Query/Mutation 指定要哪些字段**。这是 GraphQL 的核心特点——前端有查询自由度，但也因此多了 codegen 这一步
:::

```txt
┏━━━━━━━━━━━━━━━━━━━━━━━━ 后端 ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓
┃                                                              ┃
┃  ① Schema（后端定义契约）      ② Resolver（后端实现逻辑）        ┃
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
     ③ codegen（读取 Schema，生成前端类型）
              │
┏━━━━━━━━━━━━━│━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓
┃             ▼                                                ┃
┃  ④ 前端写查询语句                                              ┃
┃  ┌──────────────────────────────────────────────────┐        ┃
┃  │ query {                    → { user: {           │        ┃
┃  │   user(id: "1") {              name: "Alice",    │        ┃
┃  │     name                       posts: [{         │        ┃
┃  │     posts { title }               title: "..."   │        ┃
┃  │   }                            }]                │        ┃
┃  │ }                           }}                   │        ┃
┃  └──────────────────────────────────────────────────┘        ┃
┃                                                              ┃
┃  前端决定"我要哪些字段"                                         ┃
┃  服务端"只返回请求的字段"                                        ┃
┃                                                              ┃
┗━━━━━━━━━━━━━━━━━━━━━━━━ 前端 ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛
```

开发步骤：

1. **后端定义 Schema** — 用 SDL 声明数据类型和操作接口（[详见](/programming/web-backend/graphql/schema)）
2. **后端实现 Resolver** — 为 Schema 中的每个字段编写数据获取逻辑（[详见](/programming/web-backend/graphql/resolver)）
3. **codegen 生成类型** — 读取后端 Schema，为前端生成 TypeScript 类型（[详见](/programming/web-backend/graphql/schema#codegen)）
4. **前端写查询语句** — 用 Query/Mutation 指定需要的字段（[详见](/programming/web-backend/graphql/schema#操作类型)）

## 争议与取舍

GraphQL 的核心优势是**客户端灵活查询**——客户端精确指定要什么字段，一次请求拿到所有关联数据。但这个灵活性不是免费的，它带来了一系列成本：

### GraphQL 的真实成本

| 成本 | 具体问题 |
| --- | --- |
| **N+1 问题** | 嵌套查询天然触发逐条查询，必须引入 [DataLoader](/programming/web-backend/graphql/n-plus-one) |
| **缓存** | 所有请求 `POST /graphql`，HTTP 缓存和 CDN 完全失效，必须用 [Apollo Cache](/programming/web-backend/graphql/caching) 等客户端方案 |
| **安全** | 客户端可构造任意查询，必须额外实现[深度限制、复杂度限制](/programming/web-backend/graphql/security) |
| **监控** | HTTP 状态码始终 200，传统监控体系需要额外适配 |
| **服务端复杂度** | 维护 Schema + Resolver + DataLoader + 权限控制，每新增一个字段都要写 Resolver |
| **开发流程** | 后端写 Schema → Resolver → codegen → 前端写 Query → codegen 再生成 Hook，改一个字段要动 4 处 |

::: tip 关键判断

**当场景不需要"客户端灵活查询"这个能力时，上面这些成本就变成了纯开销**

- 适合 GraphQL：多客户端共用 API、数据关系复杂需要灵活组合、前后端分离各自迭代
- 不需要灵活查询时：TS 全栈项目用 [tRPC](/programming/web-backend/trpc/) 成本更低，简单 CRUD / 公开 API 用 REST 更成熟，微服务间通信用 [gRPC](/programming/web-backend/grpc/) 更合适
:::

---

### GraphQL vs tRPC：怎么选

都解决了 REST 的类型安全问题，但思路完全不同：

| 维度 | GraphQL | [tRPC](/programming/web-backend/trpc/) |
| --- | --- | --- |
| **语言和受众** | 任意语言，可对外暴露给第三方 | **仅 TypeScript**，前后端同语言同团队 |
| **查询灵活度** | 前端自由选字段，不同客户端按需查询 | 服务端决定返回什么，前端只能调用 |
| **开发成本** | Schema → Resolver → codegen → Query，改一个字段动 4 处 | 写个函数就是 API，零 codegen |
| **错误和缓存** | 始终 200 + `errors`，需要 [Apollo Cache](/programming/web-backend/graphql/caching) | 标准 HTTP 状态码 + [TRPCError](/programming/web-backend/trpc/error-handling)，TanStack Query 管缓存 |
| **实时通信** | 内置 [Subscription](/programming/web-backend/graphql/subscription)（WebSocket） | 支持 subscription procedure，生态不如 GraphQL 成熟 |
| **生态** | 成熟（Apollo/Relay/urql、大量工具链） | 较小，围绕 Next.js / TanStack Query |
| **适合场景** | 对外 API、多客户端、多语言 | TS 全栈内部项目、同一团队 |

::: tip 怎么判断

1. **先看语言限制**：有非 TS 客户端或第三方要消费 API → tRPC 直接排除，选 GraphQL
2. **再看是否需要灵活查询**：多客户端需要不同字段组合 → GraphQL；单客户端固定结构 → tRPC 开发成本低得多

:::

---

### GraphQL vs REST：怎么选

| 维度 | GraphQL | REST |
| --- | --- | --- |
| **数据获取** | 客户端精确指定字段，一次请求拿关联数据，无 Over/Under-fetching | 服务端决定返回结构，可能多余字段或需要多次请求 |
| **N+1 问题** | 嵌套查询天然触发，必须引入 [DataLoader](/programming/web-backend/graphql/n-plus-one) | Controller 层一次性 JOIN，不存在 |
| **缓存** | HTTP 缓存失效，需要 [Apollo Cache](/programming/web-backend/graphql/caching) | HTTP 原生缓存 + CDN |
| **安全** | 客户端可构造任意查询，需要[深度限制、复杂度限制](/programming/web-backend/graphql/security) | 端点固定，服务端完全控制查询 |
| **错误处理** | 始终 200 + `errors` 字段，支持[部分成功](/programming/web-backend/graphql/security#部分成功) | HTTP 状态码（404/500 等） |
| **实时通信** | 内置 [Subscription](/programming/web-backend/graphql/subscription) | 需要额外引入 SSE / WebSocket |
| **API 演进** | 新增字段不影响旧客户端，不需要版本号 | 需要版本控制（v1/v2）或 Header |
| **文件上传** | JSON 不支持二进制，需要[额外方案](/programming/web-backend/graphql/file-upload) | 原生支持 multipart |
| **适合场景** | 多客户端灵活查询、数据关系复杂、BFF 服务多端 | 简单 CRUD、公开 API、需要 HTTP 缓存/CDN、BFF 服务单端 |

::: tip 怎么判断

1. **先看客户端数量**：多客户端需要不同字段组合 → GraphQL 的灵活查询有价值
2. **再看基础设施需求**：需要 HTTP 缓存/CDN/标准监控 → REST 全链路成熟，GraphQL 每项都要额外方案

:::
