---
prev: false
next: false
---

# tRPC

tRPC 是一个用于构建端到端的 API 数据传输框架，基于 TypeScript 保证类型安全

::: warning 特点:

- 端到端类型安全：服务端修改接口后客户端立即获得类型提示，无需 codegen 或 Schema 定义
- 客户端像调用本地函数一样调用服务端过程，无需定义 HTTP 方法和路径
- 同一页面中的多个 tRPC 请求自动合并为一个 HTTP 请求（batching）。与 GraphQL 的单端点不同——GraphQL 是在查询语言层面合并（一个 query 跨类型取数据），tRPC 是在传输层面合并（独立 procedure 的 HTTP 请求被自动合并）
- 与 TanStack Query 深度集成，开箱即用缓存、乐观更新、无限滚动等能力
:::

::: danger 局限性:

- **仅限 TypeScript**：前后端必须都是 TypeScript，无法服务非 TS 客户端（移动端原生、第三方）
- **前后端强耦合**：服务端类型变更直接传播到客户端，适合同一团队维护，不适合对外 API
- **生态较小**：相比 REST / GraphQL，社区工具、中间件、文档资源有限
- **调试不友好**：默认使用 SuperJSON 序列化（支持 `Date`、`Map` 等类型），加上 batching 合并响应，浏览器 DevTools Network 面板中的请求和响应内容基本不可读。可用 tRPC Panel 或临时切换 `httpLink` 单独请求来调试
:::

::: info 适用场景
TypeScript 全栈项目、前后端同一团队或 monorepo、追求最快开发速度和零配置类型安全
:::

```txt
┏━━━━━━━━ REST API Client ━━━━━┓ ┏━━━━━━━━━━━━ REST API Server ━━━━━━━━━━━━━━┓
┃                              ┃ ┃                                           ┃
┃ axios.get("/api/user")      ━━━━  GET  ━━━▶ /api/user   ━━▶ getUserList    ┃
┃ axios.get("/api/user/1")    ━━━━  GET  ━━━▶ /api/user/1 ━━▶ getUserById    ┃
┃ axios.post("/api/user")     ━━━━  POST ━━━▶ /api/user   ━━▶ createUser     ┃
┃ axios.put("/api/user/1")    ━━━━  PUT  ━━━▶ /api/user/1 ━━▶ updateUserById ┃
┃ axios.delete("/api/user/1") ━━━━ DELETE ━━▶ /api/user/1 ━━▶ deleteUserById ┃
┃                              ┃ ┃                                           ┃
┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛ ┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛


┏━━━━━━━━━ tRPC Client ━━━━━━━━┓ ┏━━━━━━━━━━━━━ tRPC Server ━━━━━━━━━━━━━━━━━┓
┃                              ┃ ┃                                           ┃
┃ trpcClient.getUserList     ━━━━━━━━━━━━▶   getUserList                     ┃
┃ trpcClient.getUserById     ━━━━━━━━━━━━▶   getUserById                     ┃
┃ trpcClient.createUser      ━━━━━━━━━━━━▶   createUser                      ┃
┃ trpcClient.updateUserById  ━━━━━━━━━━━━▶   updateUserById                  ┃
┃ trpcClient.deleteUserById  ━━━━━━━━━━━━▶   deleteUserById                  ┃
┃                              ┃ ┃                                           ┃
┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛ ┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛
```

## 基础概念

| 概念                 | 一句话说明                                           | 详细                                                         |
| -------------------- | ---------------------------------------------------- | ------------------------------------------------------------ |
| Router（路由器）     | 组织和注册所有 API 端点的容器                        | [详见](/programming/web-backend/trpc/sample-next#路由器)     |
| Procedure（过程）    | 单个 API 端点，分为 query（查询）和 mutation（变更） | [详见](/programming/web-backend/trpc/sample-next#过程)       |
| Context（上下文）    | 每个请求共享的数据（如 db、session）                 | [详见](/programming/web-backend/trpc/sample-next#上下文)     |
| Client（客户端对象） | 客户端调用服务端过程的类型安全代理                   | [详见](/programming/web-backend/trpc/sample-next#客户端对象) |

## 下载安装

```zsh
% npm install @trpc/server @trpc/client zod
```

## 基本使用

主要用于 Typescript 开发的全栈项目

首先在服务端定义路由器 Router（[详见](/programming/web-backend/trpc/sample-next#路由器)）、过程 Procedure（[详见](/programming/web-backend/trpc/sample-next#过程)）、上下文 Context（[详见](/programming/web-backend/trpc/sample-next#上下文)）

然后在客户端通过客户端对象 Client（[详见](/programming/web-backend/trpc/sample-next#客户端对象)）调用对应的过程进行数据传输

