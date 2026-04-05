# API 通信方式

## 数据请求方式

四种方案解决不同问题，先看选型结论：

::: warning 怎么选

- **对外公开 API / 简单 CRUD** → **REST**（最成熟、生态最全）
- **多客户端灵活查询（Web + Mobile 共用 API）** → **[GraphQL](/programming/web-backend/graphql/)**
- **TypeScript 全栈内部项目** → **[tRPC](/programming/web-backend/trpc/)**（零配置类型安全，开发最快）
- **微服务间通信 / 高性能 / 多语言互调** → **[gRPC](/programming/web-backend/grpc/)**

:::

---

### REST

最传统的方案。每个资源一个 URL，用 HTTP 方法（GET/POST/PUT/DELETE）表示操作

- 接口定义：URL + HTTP 方法（`GET /api/users/1`）
- 类型安全：需要额外工具（OpenAPI + codegen）
- 缓存：HTTP 原生缓存 + CDN，生态最成熟
- 适用：公开 API、简单 CRUD、需要 HTTP 缓存的场景

---

### [GraphQL](/programming/web-backend/graphql/)

客户端精确指定要什么字段，一次请求拿到所有关联数据

- 接口定义：Schema（SDL）+ 单一端点（`POST /graphql`）
- 类型安全：Schema 自带类型，可 codegen 生成客户端类型
- 缓存：不支持 HTTP 缓存，需要客户端方案（Apollo Cache）
- 适用：多客户端共用 API、数据关系复杂、前端需要灵活组合

---

### [tRPC](/programming/web-backend/trpc/)

客户端直接调用服务端函数，TypeScript 编译器自动推导类型

- 接口定义：就是 TypeScript 函数，没有中间层
- 类型安全：**零配置端到端类型安全**，不需要 Schema 和 codegen
- 缓存：依赖 TanStack Query
- 局限：**仅限 TypeScript**，不能服务非 TS 客户端

---

### [gRPC](/programming/web-backend/grpc/)

基于 HTTP/2 + Protocol Buffers 的高性能 RPC 框架

- 接口定义：`.proto` 文件（强类型契约），codegen 生成多语言代码
- 类型安全：[protobuf](/programming/web-backend/protobuf/) codegen 多语言类型安全
- 缓存：不支持 HTTP 缓存
- 适用：微服务内部通信、高吞吐低延迟、流式传输、多语言服务互调

---

### 对比速查

| 维度     | REST               | GraphQL        | tRPC           | gRPC             |
| -------- | ------------------ | -------------- | -------------- | ---------------- |
| 数据获取 | 服务端决定返回结构 | 客户端指定字段 | 调用服务端函数 | 调用 Stub 方法   |
| 多语言   | 任意               | 任意           | 仅 TS          | 10+ 语言         |
| 缓存     | HTTP 原生          | 需客户端方案   | TanStack Query | 不支持           |
| 浏览器   | 原生支持           | 原生支持       | 原生支持       | 需 gRPC-Web 代理 |

---

## 实时通信选型

::: warning 怎么选

- 大多数"实时"场景其实只需要 **SSE** — 通知推送、实时数据面板、AI 流式输出都是服务端单向推送，客户端发数据用普通 HTTP 请求即可
- 只有**双方需要随时互发消息**的场景（聊天室、在线游戏、协同编辑）才真正需要 **WebSocket**
- **HTTP 轮询**仅在基础设施不支持长连接或实时性要求极低时使用

:::

---

### HTTP 轮询

> Polling

客户端每隔 N 秒发一次请求问"有新数据吗"，最简单但最浪费

- 通信方向：客户端主动请求（单向）
- 实现复杂度：低
- 适用：兼容性要求高、实时性要求低

---

### [SSE](/programming/web-backend/sse/)

> Server-Sent Events

服务端通过一个不关闭的 HTTP 响应持续推送数据

- 通信方向：服务端 → 客户端（单向）
- 协议：普通 HTTP（`http://` / `https://`）
- 浏览器原生支持自动重连和断点恢复（`Last-Event-ID`）
- 数据格式：仅文本
- 适用：通知推送、日志流、AI 流式输出

---

### [WebSocket](/programming/web-backend/websocket/)

客户端和服务端通过协议升级建立全双工连接，双方可以随时互发消息

- 通信方向：全双工（双向）
- 协议：`ws://` / `wss://`（HTTP 握手后升级）
- 需要手动实现重连逻辑
- 数据格式：文本 + 二进制
- 适用：聊天、游戏、协同编辑

---

### 对比速查

| 维度     | HTTP 轮询        | SSE             | WebSocket                   |
| -------- | ---------------- | --------------- | --------------------------- |
| 通信方向 | 客户端主动       | 服务端 → 客户端 | 全双工                      |
| 连接方式 | 短连接           | 长连接（HTTP）  | 长连接（协议升级）          |
| 头部开销 | 每次完整 HTTP 头 | 仅首次          | 握手后 2~14 字节            |
| 自动重连 | 不适用           | 浏览器原生      | 需手动实现                  |
| 跨域     | CORS             | CORS            | 无同源限制（需验证 Origin） |
| 二进制   | 不支持           | 不支持          | 支持（ArrayBuffer / Blob） |
| 扩展性   | 无状态，天然扩展  | HTTP 基础设施支持 | 有状态，需 Redis Pub/Sub 等 |

::: tip 游戏连携服务的选型

游戏场景通常包含多种实时需求，不同需求适合不同方案：

| 需求 | 方案 | 理由 |
| --- | --- | --- |
| 游戏状态同步（操作 ↔ 服务器） | **WebSocket** | 双向低延迟，支持二进制数据 |
| 排行榜 / 活动公告推送 | **SSE** | 服务端单向推送，HTTP 基础设施天然兼容 |
| 好友在线状态 | **WebSocket** | 需要双向（上报自己状态 + 接收好友状态变化） |
| 历史记录 / 成就查询 | **REST / tRPC** | 普通数据请求，不需要实时 |

不要对所有需求都用 WebSocket——维护成本高、扩展复杂。**按需求拆分：实时双向用 WebSocket，单向推送用 SSE，普通查询用 HTTP**

:::
