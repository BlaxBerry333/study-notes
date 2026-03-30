---
prev: false
next: false
---

# GraphQL

GraphQL 是一个由客户端精确定义所需数据结构的 API 查询语言。REST 在大型应用中痛点明显：接口数量爆炸、Over-fetching（返回多余字段）、Under-fetching（一个页面要调多个接口）。GraphQL 用单一端点 + 客户端按需查询一次性解决，特别适合移动端（省流量）和多客户端（一套 API 服务所有端）

::: warning 特点:

- 所有请求通过单一端点（通常为 `POST /graphql`）处理
- 客户端精确指定所需字段，避免 Over/Under-fetching，适合多资源灵活组合、移动端减少传输量
- 使用强类型 Schema 定义数据结构，自带 API 文档
- 内置 Subscription 支持实时数据推送
:::

::: danger 局限性:

- 嵌套查询容易触发 [N+1 问题](/programming/web-backend/graphql/n-plus-one)，必须引入 DataLoader
- 所有请求 `POST /graphql`，无法利用 HTTP 缓存和 CDN，需要客户端缓存方案
- 客户端可构造任意查询，需要额外实现[深度限制、复杂度限制、持久化查询](/programming/web-backend/graphql/performance)
- 服务端要维护 Schema + Resolver + DataLoader + 权限控制，比 REST 重
- HTTP 状态码始终 200，日志和监控需额外适配
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

| 概念         | 一句话说明                       | 详细                                                              |
| ------------ | -------------------------------- | ----------------------------------------------------------------- |
| Schema       | 定义 API 的数据结构与操作接口    | [详见](/programming/web-backend/graphql/schema)                   |
| Resolver     | 每个字段如何获取数据的函数       | [详见](/programming/web-backend/graphql/resolver)                 |
| Query        | 读取数据（类似 GET）             | [详见](/programming/web-backend/graphql/syntax#query)             |
| Mutation     | 修改数据（类似 POST/PUT/DELETE） | [详见](/programming/web-backend/graphql/syntax#mutation)          |
| Subscription | 实时数据推送（WebSocket）        | [详见](/programming/web-backend/graphql/subscription)             |

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

```txt
┏━━━━━━━━━━━━━━━━━━━━ 客户端 ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓
┃                                                          ┃
┃  ① 操作语法（Query / Mutation / Subscription）            ┃
┃  ┌──────────────────────────────────────────────────┐    ┃
┃  │ query {                    → { user: {           │    ┃
┃  │   user(id: "1") {              name: "Alice",    │    ┃
┃  │     name                       posts: [{         │    ┃
┃  │     posts { title }               title: "..."   │    ┃
┃  │   }                            }]                │    ┃
┃  │ }                           }}                   │    ┃
┃  └──────────────────────────────────────────────────┘    ┃
┃                                                          ┃
┃  "我要哪些字段"                  "只返回我要的"              ┃
┃                                                          ┃
┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛
                           │
                    POST /graphql
                           │
┏━━━━━━━━━━━━━━━━━━━━ 服务端 ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓
┃                                                           ┃
┃  ② Schema（类型定义）          ③ Resolver（数据获取）        ┃
┃  ┌──────────────────────┐     ┌────────────────────────┐  ┃
┃  │ type User {          │     │ Query: {               │  ┃
┃  │   id: ID!            │     │   user: (_, {id}) =>   │  ┃
┃  │   name: String!      │ ──▶ │     db.findById(id)    │  ┃
┃  │   posts: [Post!]!    │     │ }                      │  ┃
┃  │ }                    │     │ User: {                │  ┃
┃  │ type Query {         │     │   posts: (parent) =>   │  ┃
┃  │   user(id: ID!): User│     │     db.findPosts(...)  │  ┃
┃  │ }                    │     │ }                      │  ┃
┃  └──────────────────────┘     └────────────────────────┘  ┃
┃                                                           ┃
┃  "有哪些数据、什么结构"         "每个字段怎么取数据"            ┃
┃                                                           ┃
┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛
```

开发步骤：

1. **定义 Schema** — 用 SDL 声明数据类型和操作接口（[详见](/programming/web-backend/graphql/schema)）
2. **实现 Resolver** — 为 Schema 中的每个字段编写数据获取逻辑（[详见](/programming/web-backend/graphql/resolver)）
3. **客户端查询** — 用操作语法请求所需字段（[详见](/programming/web-backend/graphql/syntax)）

## 争议与取舍

GraphQL 的优势是**客户端灵活查询**，当场景不需要这个灵活性时，复杂度就变成了纯成本（具体问题见顶部局限性框）

| 不适合 GraphQL 的场景 | 替代方案           | 原因                                                                       |
| --------------------- | ------------------ | -------------------------------------------------------------------------- |
| TS 全栈内部项目       | **tRPC**           | 零配置类型安全，不需要 Schema 定义和 codegen，开发成本远低于 GraphQL       |
| 简单 CRUD / 公开 API  | **REST + OpenAPI** | HTTP 原生缓存、CDN、监控全链路成熟；OpenAPI codegen 补齐了类型安全短板     |
| BFF 聚合层            | **REST 聚合**      | BFF 本身就是服务端代码，直接调下游 REST 再组装，比维护 GraphQL Schema 简单 |
| 微服务间通信          | **gRPC / REST**    | 服务间不需要客户端灵活查询，gRPC 的强类型 + 高性能 + 流式传输更合适        |
