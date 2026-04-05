---
prev: false
next: false
---

# gRPC

> Google Remote Procedure Call

gRPC 是 Google 开源的高性能 RPC 框架，基于 HTTP/2 + [Protocol Buffers](/programming/web-backend/protobuf/) 实现跨语言的服务间通信

::: warning 特点:

- 基于 HTTP/2：多路复用、头部压缩、双向流，单连接可并行处理大量请求
- 使用 [protobuf](/programming/web-backend/protobuf/) 作为默认序列化格式，体积比 JSON 小 3~10 倍，解析速度快数倍
- 强类型契约：通过 `.proto` 文件定义服务接口，自动生成多语言客户端和服务端代码（[详见](/programming/web-backend/protobuf/#service-定义)）
- 原生支持四种通信模式：Unary、Server Streaming、Client Streaming、Bidirectional Streaming
- 多语言支持：官方支持 Go、Java、C++、Python、Node.js、Rust 等 10+ 语言
:::

::: danger 局限性:

- **浏览器不能直接调用**：浏览器不支持 HTTP/2 Trailer，需要 gRPC-Web 代理（Envoy 等）中转，且 gRPC-Web 不支持 Client Streaming 和 Bidirectional Streaming
- **protobuf 是二进制格式**：不可读，调试需要专用工具（grpcurl、Postman gRPC、Buf Studio），无法用浏览器 DevTools 直接查看
- **不能利用 HTTP 缓存和 CDN**：所有请求走 HTTP/2 POST，无法使用 GET 缓存机制
- **学习曲线高**：需要学习 [protobuf 语法](/programming/web-backend/protobuf/)、代码生成流程、流式通信模型
- **不适合对外公开 API**：第三方客户端集成成本高于 REST
:::

```txt
┏━━━━━━━━━━ REST API ━━━━━━━━━━━┓
┃                               ┃
┃  Client ━━ JSON ━━▶ Server    ┃  HTTP/1.1
┃                               ┃  文本格式，可读
┃  POST /api/users              ┃  每个请求独立连接
┃  { "name": "Alice" }          ┃
┃                               ┃
┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛


┏━━━━━━━━━━ gRPC ━━━━━━━━━━━━━━━┓
┃                               ┃
┃  Client ━━ protobuf ━━▶ Server┃  HTTP/2
┃                               ┃  二进制格式，体积小
┃  UserService.CreateUser()     ┃  多路复用，单连接并行
┃  { name: "Alice" }            ┃
┃                               ┃
┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛
```

::: tip 选型建议

**选 gRPC**：微服务内部通信、高吞吐低延迟场景、需要流式传输、多语言服务互调

**选 REST**：面向浏览器/第三方的公开 API、简单 CRUD、需要 HTTP 缓存/CDN

**选 [GraphQL](/programming/web-backend/graphql/)**：多客户端灵活查询、前端需要按需获取字段

**选 [tRPC](/programming/web-backend/trpc/)**：TypeScript 全栈项目、前后端同一团队
:::

## 基础概念

| 概念 | 一句话说明 |
| --- | --- |
| Channel | 客户端与服务端之间的 HTTP/2 连接，可复用 |
| Stub（客户端存根） | 从 `.proto` 自动生成的客户端代理对象，调用方式像本地函数 |
| Metadata | 请求/响应的附加信息（类似 HTTP Header），用于传递认证 Token、追踪 ID 等 |
| Interceptor | 拦截器，在 RPC 调用前后插入逻辑（类似中间件），用于日志、认证、重试等 |
| Deadline / Timeout | 客户端设置的请求超时时间，超时后自动取消，防止请求无限等待 |

protobuf 相关概念（Message、Service、字段编号等）[详见](/programming/web-backend/protobuf/)

## 下载安装

需要安装两部分：protobuf 编译器（[详见](/programming/web-backend/protobuf/#下载安装)）和对应语言的 gRPC 库

| 实现 | 语言 | 安装 |
| --- | --- | --- |
| `google.golang.org/grpc` | Go | `go install google.golang.org/grpc/cmd/protoc-gen-go-grpc@latest` |
| `@grpc/grpc-js` | Node.js | `npm install @grpc/grpc-js @grpc/proto-loader` |
| `grpcio` | Python | `pip install grpcio grpcio-tools` |
| `io.grpc` | Java | Gradle/Maven 依赖 `io.grpc:grpc-netty` |
| `tonic` | Rust | `cargo add tonic prost` |

## 基本使用

```txt
① 定义 .proto 文件（详见 protobuf）
┌──────────────────────────────────┐
│ service UserService {            │
│   rpc GetUser(GetUserReq)        │
│       returns (User);            │
│ }                                │
│ message GetUserReq { int32 id }  │
│ message User { string name }     │
└──────────────────────────────────┘
                │
                ▼
② protoc 编译生成代码
┌──────────────────────────────────┐
│ protoc --go_out=. --go-grpc_out=.│
│   user.proto                     │
│                                  │
│ 生成:                             │
│   user.pb.go       ← 消息类型    │
│   user_grpc.pb.go  ← 服务接口    │
└──────────────────────────────────┘
                │
        ┌───────┴───────┐
        ▼               ▼
③ 服务端实现          ④ 客户端调用
┌────────────────┐  ┌─────────────────────┐
│ 实现接口方法    │  │ conn := grpc.Dial() │
│ func GetUser() │  │ client.GetUser(     │
│   → 查数据库    │  │   {id: 1}           │
│ 注册到 Server   │  │ )                   │
│ 监听端口        │  │ → { name: "Alice" } │
└────────────────┘  └─────────────────────┘
```

开发步骤：

1. **定义 `.proto` 文件** — 用 protobuf 语法声明 Message 和 Service（[详见](/programming/web-backend/protobuf/#service-定义)）
2. **编译生成代码** — 用 `protoc` + gRPC 语言插件自动生成客户端 Stub 和服务端接口代码
3. **实现服务端** — 实现生成的接口，编写业务逻辑，启动 gRPC Server 监听端口
4. **调用客户端** — 通过生成的 Stub 像调用本地函数一样发起 RPC 请求

## 四种通信模式

### Unary RPC

> 一元调用

最基本的模式，客户端发一个请求，服务端返回一个响应（类似普通 HTTP 请求）

```protobuf
rpc GetUser(GetUserRequest) returns (User);
```

```txt
Client ─── Request ───▶ Server
Client ◀── Response ─── Server
```

---

### Server Streaming RPC

> 服务端流

客户端发一个请求，服务端返回一个数据流（多条响应）。适合服务端需要推送大量数据的场景（日志流、搜索结果逐条返回）

```protobuf
rpc ListUsers(ListUsersRequest) returns (stream User);
```

```txt
Client ─── Request ──────────▶ Server
Client ◀── Response 1 ──────── Server
Client ◀── Response 2 ──────── Server
Client ◀── Response 3 ──────── Server
Client ◀── (stream closed) ─── Server
```

---

### Client Streaming RPC

> 客户端流

客户端发送一个数据流（多条请求），服务端在接收完后返回一个响应。适合客户端需要批量上传的场景（文件上传、批量数据导入）

```protobuf
rpc UploadLogs(stream LogEntry) returns (UploadResult);
```

```txt
Client ─── Request 1 ──────▶ Server
Client ─── Request 2 ──────▶ Server
Client ─── Request 3 ──────▶ Server
Client ─── (stream closed) ▶ Server
Client ◀── Response ──────── Server
```

---

### Bidirectional Streaming RPC

> 双向流

客户端和服务端都可以随时发送数据流，双方独立读写。适合实时双向通信场景（聊天、实时协作）

```protobuf
rpc Chat(stream ChatMessage) returns (stream ChatMessage);
```

```txt
Client ─── Message 1 ──▶ Server
Client ◀── Message A ─── Server
Client ─── Message 2 ──▶ Server
Client ◀── Message B ─── Server
Client ─── Message 3 ──▶ Server
Client ◀── Message C ─── Server
```

## 错误处理

gRPC 使用自己的状态码体系（不同于 HTTP 状态码）：

| gRPC 状态码 | 含义 | 对应 HTTP | 使用场景 |
| --- | --- | --- | --- |
| `OK` (0) | 成功 | 200 | — |
| `INVALID_ARGUMENT` (3) | 参数错误 | 400 | 字段校验失败 |
| `NOT_FOUND` (5) | 资源不存在 | 404 | 查询不到记录 |
| `ALREADY_EXISTS` (6) | 资源已存在 | 409 | 唯一约束冲突 |
| `PERMISSION_DENIED` (7) | 权限不足 | 403 | 无权操作 |
| `UNAUTHENTICATED` (16) | 未认证 | 401 | Token 缺失或失效 |
| `RESOURCE_EXHAUSTED` (8) | 资源耗尽 | 429 | 限流 |
| `INTERNAL` (13) | 内部错误 | 500 | 未处理异常 |
| `UNAVAILABLE` (14) | 服务不可用 | 503 | 服务暂时不可达，可重试 |
| `DEADLINE_EXCEEDED` (4) | 超时 | 504 | 请求超过 Deadline |
| `UNIMPLEMENTED` (12) | 未实现 | 501 | 方法未实现 |

::: warning 核心要点

- `UNAVAILABLE` 表示暂时故障，客户端**应该重试**（带退避策略）
- `INTERNAL` 表示服务端 bug，客户端**不应该重试**
- 始终设置 **Deadline**，防止请求无限等待。未设置 Deadline 的请求可能永远挂起，占用服务端资源
:::

## gRPC vs REST

| 维度 | gRPC | REST |
| --- | --- | --- |
| 协议 | HTTP/2 | HTTP/1.1（也可用 HTTP/2） |
| 序列化 | [protobuf](/programming/web-backend/protobuf/)（二进制） | JSON（文本） |
| 接口定义 | `.proto` 文件（强类型契约） | OpenAPI/Swagger（可选） |
| 代码生成 | 原生支持多语言 codegen | 需第三方工具 |
| 流式传输 | 原生四种模式 | 不支持（需 SSE / WebSocket） |
| 浏览器支持 | 需要 gRPC-Web 代理 | 原生支持 |
| 可读性 | 二进制，需工具解析 | JSON 可直接阅读 |
| 性能 | 更高（二进制 + HTTP/2 多路复用） | 较低（文本 + 短连接） |
| 缓存 | 不支持 HTTP 缓存 | 原生 HTTP 缓存 |
| 适用场景 | 微服务内部、高性能、多语言 | 面向浏览器、公开 API |
