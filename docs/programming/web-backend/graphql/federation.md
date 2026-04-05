---
prev: false
next: false
---

# Federation

Federation 是微服务架构下多个 GraphQL 服务合并为一个统一 API 的方案

## 为什么需要

微服务架构中每个服务有自己的 GraphQL Schema 和端点。前端不想知道"用户数据问 A 服务、订单数据问 B 服务"——它只想对着一个端点查所有数据

```txt
没有 Federation:

  Client ──▶ 用户服务  /graphql    ← 查用户
  Client ──▶ 订单服务  /graphql    ← 查订单
  Client ──▶ 商品服务  /graphql    ← 查商品
  （前端要知道每个服务的地址，自己拼数据）


有 Federation:

  Client ──▶ Gateway ──▶ 用户服务 (Subgraph)
                    ├──▶ 订单服务 (Subgraph)
                    └──▶ 商品服务 (Subgraph)
  （前端只对一个端点，Gateway 自动路由和合并）
```

---

## 架构

Apollo Federation 由一个 Gateway（Router）和多个 Subgraph 组成：

```txt
                    ┌─────────────┐
  Client ─────────▶ │   Gateway   │  ← 接收查询，拆解后分发给各 Subgraph
                    │  (Router)   │
                    └──────┬──────┘
                           │
              ┌────────────┼────────────┐
              ▼            ▼            ▼
        ┌──────────┐ ┌──────────┐ ┌──────────┐
        │  Users   │ │  Orders  │ │ Products │  ← 各 Subgraph 独立开发、独立部署
        │ Subgraph │ │ Subgraph │ │ Subgraph │
        └──────────┘ └──────────┘ └──────────┘
```

---

## 核心概念

| 概念 | 说明 |
| --- | --- |
| Gateway / Router | 统一入口，接收客户端请求后拆解分发给各 Subgraph，合并结果返回 |
| Subgraph | 各微服务暴露的 GraphQL 服务，独立维护自己那部分 Schema |
| `@key` | 标记实体的主键，Gateway 通过它跨 Subgraph 关联同一个实体 |
| `@external` | 声明"这个字段由别的 Subgraph 定义"，当前 Subgraph 只是引用 |
| `@requires` | 声明"要解析这个字段，需要先从别的 Subgraph 拿到某些字段" |

---

## 代码示例

两个 Subgraph 通过 `@key` 关联同一个 `User` 实体：

```graphql
# -------- Users Subgraph --------
# 定义 User 实体，@key 告诉 Gateway 用 id 来标识
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
# 扩展 User 实体，通过 @key 关联到 Users Subgraph 的 User
type User @key(fields: "id") {
  id: ID! @external          # id 由 Users Subgraph 定义，这里只是引用
  orders: [Order!]!          # 本服务负责的字段
}

type Order {
  id: ID!
  product: String!
  total: Float!
}
```

客户端可以一次查完：

```graphql
query {
  user(id: "1") {
    name          # ← Gateway 从 Users Subgraph 拿
    email         # ← Gateway 从 Users Subgraph 拿
    orders {      # ← Gateway 从 Orders Subgraph 拿
      product
      total
    }
  }
}
```

Gateway 自动处理跨服务的数据关联，Subgraph 各管各的

---

## 和 Schema Stitching 的区别

Schema Stitching 是网关层**手动拼接**各服务的 Schema，合并逻辑写在网关里；Federation 是各服务通过指令（`@key` 等）**声明式协作**，网关只负责编排，不写业务逻辑
