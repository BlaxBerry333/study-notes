---
prev: false
next: false
---

# Protocol Buffers

> protobuf

Protocol Buffers 是 Google 开源的跨语言数据序列化格式和接口定义语言（IDL），通过 `.proto` 文件定义数据结构，编译生成多语言代码

::: warning 特点:

- 二进制序列化：体积比 JSON 小 3~10 倍，解析速度快数倍
- 跨语言代码生成：一份 `.proto` 文件生成 Go、Java、Python、TypeScript 等 10+ 语言的类型安全代码
- 强类型契约：字段类型、编号、嵌套关系在 `.proto` 中明确定义，编译期就能发现类型不匹配
- 向前/向后兼容：通过字段编号机制，新增或废弃字段不会破坏已部署的服务
:::

::: danger 局限性:

- **二进制不可读**：无法像 JSON 一样直接查看内容，调试需要专用工具（`protoc --decode`、Buf Studio）
- **需要编译步骤**：修改 `.proto` 后必须重新编译生成代码，增加开发流程复杂度
- **不适合浏览器直接消费**：前端通常用 JSON，protobuf 在浏览器端需要额外的序列化/反序列化库
:::

::: info 不只是 gRPC

protobuf 常与 [gRPC](/programming/web-backend/grpc/) 搭配使用，但它是**独立的序列化格式**，也广泛用于：

- 消息队列（Kafka、RabbitMQ 的消息体）
- 数据存储（代替 JSON/XML 作为持久化格式）
- 配置文件
- 任何需要跨语言类型安全数据交换的场景
:::

## 基础概念

| 概念 | 一句话说明 |
| --- | --- |
| `.proto` 文件 | 定义数据结构和服务接口的源文件 |
| Message | 数据结构定义（类似 JSON 中的 object、Go 中的 struct） |
| Service | RPC 服务接口定义（供 [gRPC](/programming/web-backend/grpc/) 等框架使用） |
| 字段编号 | 每个字段的唯一编号，是二进制编码的 key，一旦发布不能修改 |
| `protoc` | Protocol Buffers 编译器，将 `.proto` 编译为目标语言代码 |
| 语言插件 | `protoc` 的代码生成插件（如 `protoc-gen-go`、`protoc-gen-js`） |

## 下载安装

::: code-group

```zsh [macOS]
% brew install protobuf
```

```zsh [Linux]
% apt install -y protobuf-compiler
```

:::

还需要安装对应语言的代码生成插件：

| 语言 | 插件安装 |
| --- | --- |
| Go | `go install google.golang.org/protobuf/cmd/protoc-gen-go@latest` |
| Node.js | `npm install @grpc/proto-loader`<br/>或使用 `ts-proto`：`npm install ts-proto` |
| Python | `pip install grpcio-tools`（包含 protoc Python 插件） |

## 基本使用

```txt
① 编写 .proto 文件
┌──────────────────────────────────┐
│ syntax = "proto3";               │
│ message User {                   │
│   int32 id = 1;                  │
│   string name = 2;               │
│ }                                │
└──────────────────────────────────┘
                │
                ▼
② protoc 编译
┌──────────────────────────────────┐
│ protoc --go_out=. user.proto     │
│                                  │
│ 生成: user.pb.go                  │
│   → User struct + 序列化方法     │
└──────────────────────────────────┘
                │
                ▼
③ 在代码中使用生成的类型
┌──────────────────────────────────┐
│ u := &pb.User{Id: 1, Name: "A"} │
│ data, _ := proto.Marshal(u)      │
│ // data 是紧凑的二进制字节       │
└──────────────────────────────────┘
```

## 类型映射

| protobuf 类型 | Go | TypeScript | Python | 说明 |
| --- | --- | --- | --- | --- |
| `int32` | `int32` | `number` | `int` | 32 位整数 |
| `int64` | `int64` | `string` | `int` | 64 位整数（JS 用 string 避免精度丢失） |
| `float` | `float32` | `number` | `float` | 32 位浮点 |
| `double` | `float64` | `number` | `float` | 64 位浮点 |
| `bool` | `bool` | `boolean` | `bool` | 布尔值 |
| `string` | `string` | `string` | `str` | UTF-8 字符串 |
| `bytes` | `[]byte` | `Uint8Array` | `bytes` | 任意二进制数据 |

## Message 定义

```protobuf
syntax = "proto3";
package user;

// 枚举
enum Role {
  ROLE_UNSPECIFIED = 0;  // proto3 要求第一个值为 0
  ROLE_ADMIN = 1;
  ROLE_USER = 2;
}

// 消息
message User {
  int32 id = 1;           // 字段编号（不是默认值）
  string name = 2;
  string email = 3;
  Role role = 4;
  repeated string tags = 5;       // 数组
  optional string bio = 6;        // 可选字段
  map<string, string> meta = 7;   // 键值对
  Address address = 8;            // 嵌套消息
}

message Address {
  string city = 1;
  string street = 2;
}
```

::: warning 字段编号是永久标识

字段编号（`= 1`、`= 2`）是 protobuf 二进制编码的 key，一旦发布就**不能修改**。删除字段后应 `reserved` 该编号防止复用：

```protobuf
message User {
  reserved 3;          // 编号 3 已废弃，禁止复用
  reserved "email";    // 字段名也可以 reserved
  int32 id = 1;
  string name = 2;
  // string email = 3; ← 已删除
}
```

:::

## Service 定义

Service 用于定义 RPC 接口，供 [gRPC](/programming/web-backend/grpc/) 等框架使用：

```protobuf
service UserService {
  rpc GetUser(GetUserRequest) returns (User);
  rpc CreateUser(CreateUserRequest) returns (User);
  rpc ListUsers(ListUsersRequest) returns (stream User);
}

message GetUserRequest {
  int32 id = 1;
}

message CreateUserRequest {
  string name = 1;
  string email = 2;
}

message ListUsersRequest {
  int32 page = 1;
  int32 page_size = 2;
}
```

编译时使用对应的 gRPC 插件会额外生成服务端接口和客户端 Stub 代码（[详见](/programming/web-backend/grpc/#基本使用)）
