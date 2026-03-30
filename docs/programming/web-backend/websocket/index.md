---
prev: false
next: false
---

# WebSocket

WebSocket 是一种在单个 TCP 连接上进行全双工通信的协议，客户端和服务端可以随时互相推送数据

::: warning 特点:

- 全双工通信：客户端和服务端可以同时发送和接收数据，适合聊天、协同编辑、在线游戏
- 持久连接：一次握手后保持连接，避免 HTTP 反复建连的开销
- 低延迟：无需轮询，数据变化时即时推送
- 二进制支持：可传输文本和二进制数据（如 ArrayBuffer、Blob）
:::

::: danger 局限性:

- **有状态连接**：服务端需维护每个连接的内存，难以水平扩展，多服务器需引入消息中间件（Redis Pub/Sub 等）
- **无法利用 HTTP 缓存**（Cache-Control、ETag 等）
- **浏览器无法发送协议层 Ping**：前端心跳需用应用层消息模拟
- **无同源策略**：任何网页都能连接，必须在服务端验证 `Origin`
- 不需要双向实时通信的场景用 WebSocket 是过度设计，大多数"实时"场景 SSE 就够了
:::

::: info 适用场景
聊天室、在线游戏、协同编辑、实时交易——需要**双方随时互发消息**的场景
:::

```txt
┏━━━━━━━ HTTP 轮询（Polling）━━━━━━━━━━┓
┃                                     ┃
┃  Client ━━ GET /data ━━▶ Server     ┃  → 有数据就返回，没数据返回空
┃  Client ━━ GET /data ━━▶ Server     ┃  → 每隔 N 秒重复请求
┃  Client ━━ GET /data ━━▶ Server     ┃  → 大量无效请求，浪费带宽
┃                                     ┃
┃  单向：只能客户端主动请求               ┃
┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛


┏━━━━━━━━ WebSocket ━━━━━━━━━━━━━━━━━━┓
┃                                     ┃
┃  Client ━━ HTTP Upgrade ━━▶ Server  ┃  → 握手（仅一次）
┃  Client ◀━━━━ data ━━━━━▶ Server    ┃  → 双向实时通信
┃  Client ◀━━━━ data ━━━━━▶ Server    ┃  → 无需重复建连
┃                                     ┃
┃  双向：服务端也可以主动推送             ┃
┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛
```

## 基础概念

| 概念                  | 一句话说明                                                     |
| --------------------- | -------------------------------------------------------------- |
| 握手（Handshake）     | 客户端发送 HTTP Upgrade 请求，服务端返回 101 切换协议          |
| 帧（Frame）           | WebSocket 传输数据的最小单位，包含 opcode、payload 等          |
| 心跳（Ping/Pong）     | 定期发送控制帧检测连接是否存活                                 |
| 关闭（Close）         | 任一方发送关闭帧，双方完成四次挥手断开连接                     |
| 子协议（Subprotocol） | 在 WebSocket 之上约定的应用层协议（如 STOMP、GraphQL over WS） |

---

## 握手过程

::: warning 核心要点：WebSocket 握手基于 HTTP，但握手完成后就不再是 HTTP 了

- 握手阶段是**标准 HTTP 请求**，因此能通过 HTTP 代理和负载均衡
- 握手成功后协议**升级为 WebSocket**，后续通信走的是 WebSocket 帧，不再是 HTTP 报文
- 这就是为什么 WebSocket 的 URL 是 `ws://` 或 `wss://`，而不是 `http://`
:::

---

### 握手请求（客户端 → 服务端）

```http
GET /chat HTTP/1.1
Host: example.com
Upgrade: websocket
Connection: Upgrade
Sec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==
Sec-WebSocket-Version: 13
Sec-WebSocket-Protocol: chat, superchat
```

| 请求头                   | 说明                                             |
| ------------------------ | ------------------------------------------------ |
| `Upgrade: websocket`     | 请求将协议升级为 WebSocket                       |
| `Connection: Upgrade`    | 表示这是一个升级连接的请求                       |
| `Sec-WebSocket-Key`      | 随机生成的 Base64 编码字符串，用于验证服务端身份 |
| `Sec-WebSocket-Version`  | WebSocket 协议版本（固定为 `13`）                |
| `Sec-WebSocket-Protocol` | 可选，客户端支持的子协议列表                     |

---

### 握手响应（服务端 → 客户端）

```http
HTTP/1.1 101 Switching Protocols
Upgrade: websocket
Connection: Upgrade
Sec-WebSocket-Accept: s3pPLMBiTxaQ9kYGzzhZRbK+xOo=
```

| 响应头                    | 说明                                                                          |
| ------------------------- | ----------------------------------------------------------------------------- |
| `101 Switching Protocols` | 协议切换成功                                                                  |
| `Sec-WebSocket-Accept`    | 服务端用 `Sec-WebSocket-Key` + 固定 GUID 经 SHA-1 + Base64 计算得出，防止伪造 |

::: tip `Sec-WebSocket-Accept` 的计算

```
Sec-WebSocket-Accept = Base64(SHA1(Sec-WebSocket-Key + "258EAFA5-E914-47DA-95CA-C5AB0DC85B11"))
```

这不是为了加密，而是为了证明服务端确实理解 WebSocket 协议，不是一个普通的 HTTP 服务器意外响应了 101
:::

---

## 连接生命周期

```txt
Client                                    Server
  │                                          │
  │─── HTTP GET (Upgrade: websocket) ──────▶│  ① 握手请求
  │◀── HTTP 101 Switching Protocols ────────│  ② 握手响应
  │                                          │
  │◀═══════ 双向数据传输 ═══════════════════▶│  ③ 通信阶段
  │─── Ping ────────────────────────────────▶│  ④ 心跳检测
  │◀── Pong ─────────────────────────────────│
  │                                          │
  │─── Close Frame ─────────────────────────▶│  ⑤ 关闭连接
  │◀── Close Frame ──────────────────────────│
  │                                          │
```

---

## 数据帧格式

WebSocket 通过**帧（Frame）** 传输数据，每个帧的结构如下：

```txt
 0               1               2               3
 0 1 2 3 4 5 6 7 0 1 2 3 4 5 6 7 0 1 2 3 4 5 6 7 0 1 2 3 4 5 6 7
+-+-+-+-+-------+-+-------------+-------------------------------+
|F|R|R|R| opcode|M| Payload len |    Extended payload length    |
|I|S|S|S| (4)   |A|     (7)     |           (16/64)             |
|N|V|V|V|       |S|             |   (if payload len==126/127)   |
| |1|2|3|       |K|             |                               |
+-+-+-+-+-------+-+-------------+-------------------------------+
|     Masking-key (0 or 4 bytes)                                |
+---------------------------------------------------------------+
|     Payload Data                                              |
+---------------------------------------------------------------+
```

| 字段          | 说明                                                                 |
| ------------- | -------------------------------------------------------------------- |
| `FIN`         | 是否为消息的最后一帧（1 = 最后一帧）                                 |
| `opcode`      | 帧类型：`0x1` 文本、`0x2` 二进制、`0x8` 关闭、`0x9` Ping、`0xA` Pong |
| `MASK`        | 客户端发送的帧**必须**掩码（MASK=1），服务端发送的帧**不掩码**       |
| `Payload len` | 数据长度（7bit / 7+16bit / 7+64bit）                                 |

::: warning 核心要点

- 客户端 → 服务端的数据**必须掩码**，服务端 → 客户端**不掩码**（这是协议强制规定）
- 大消息会被分为多个帧传输（分片），接收端根据 `FIN` 位判断消息是否完整
- `Ping/Pong` 是控制帧，用于心跳检测，不携带业务数据
:::

---

## 心跳机制（Ping/Pong）

WebSocket 连接可能因为网络异常而"半死"（TCP 连接还在但实际已不可达），心跳检测用于发现并清理这类死连接

```txt
正常情况：
Client ─── Ping ──▶ Server
Client ◀── Pong ─── Server     ← 连接存活

异常情况：
Client ─── Ping ──▶ Server
（等待超时，无 Pong 响应）      ← 连接已死，主动断开
```

::: warning 核心要点

- Ping/Pong 是 WebSocket **协议层**的控制帧，不是应用层自己发 `{ type: "ping" }` 消息
- 收到 Ping **必须**回复 Pong（浏览器自动处理，但 Node.js 的 ws 库需要手动处理或依赖库内置行为）
- 心跳间隔一般 30~60 秒，过短浪费带宽，过长检测不及时
- **浏览器限制**：浏览器的 `WebSocket` API **无法**发送协议层 Ping 帧，因此前端通常用应用层消息（如 `{ type: "ping" }` ）模拟心跳，服务端需配合回复
:::

- 服务端（Node.js）：使用协议层 `ws.ping()` — 见 [Node.js 实现 - 心跳检测](/programming/web-backend/websocket/sample-node#心跳检测)
- 浏览器端（React）：使用应用层消息模拟 — 见 [React 实现 - useWebSocket](/programming/web-backend/websocket/sample-react#usewebsocket-—-原生-websocket-封装)

---

## 基本使用

服务端常用 [ws](https://github.com/websockets/ws) 库（原生协议）或 [Socket.IO](https://socket.io/)（高级封装），详见 [Node.js 实现](/programming/web-backend/websocket/sample-node)

浏览器端使用原生 `WebSocket` API：

```js
const ws = new WebSocket("ws://localhost:3000");

ws.onopen = () => {
  ws.send("Hello"); // 发送文本
  ws.send(new Blob(["binary data"])); // 发送二进制
  ws.send(JSON.stringify({ type: "join", room: 1 })); // 发送 JSON
};

ws.onmessage = (event) => {
  console.log("收到:", event.data); // string 或 Blob
};

ws.onclose = (event) => {
  console.log(`关闭: code=${event.code}, reason=${event.reason}`);
  // event.wasClean 表示是否正常关闭
};

ws.onerror = (error) => {
  console.error("错误:", error);
};

// readyState: 0=CONNECTING, 1=OPEN, 2=CLOSING, 3=CLOSED
console.log(ws.readyState);

// 主动关闭
ws.close(1000, "Normal closure");
```

::: warning `readyState` 四种状态

| 值  | 常量                   | 含义                 |
| --- | ---------------------- | -------------------- |
| `0` | `WebSocket.CONNECTING` | 连接中，尚未建立     |
| `1` | `WebSocket.OPEN`       | 连接已建立，可通信   |
| `2` | `WebSocket.CLOSING`    | 关闭中，已发送关闭帧 |
| `3` | `WebSocket.CLOSED`     | 已关闭或连接失败     |

发送数据前**必须检查** `readyState === 1`，否则会抛异常
:::

---

## 安全性

### wss:// 加密

`ws://` 是明文传输，生产环境必须使用 `wss://`（WebSocket over TLS），等同于 HTTPS 对 HTTP 的关系

```txt
ws://example.com/chat     → 明文，不安全
wss://example.com/chat    → TLS 加密，生产环境必须使用
```

---

### 常见安全问题

| 问题                         | 说明                                                         | 防御                                                           |
| ---------------------------- | ------------------------------------------------------------ | -------------------------------------------------------------- |
| 跨站 WebSocket 劫持（CSWSH） | 恶意页面向你的 WS 服务发起连接，浏览器会自动带上 Cookie      | 验证 `Origin` 请求头，拒绝非白名单来源                         |
| 认证                         | WebSocket 握手是 HTTP，之后就不是了，不能每次带 Cookie/Token | 在握手阶段验证（URL 参数、Cookie），或连接后首条消息发送 Token |
| DoS                          | 恶意客户端发送大量连接或超大消息                             | 限制并发连接数、限制消息大小、速率限制                         |

::: warning 核心要点：WebSocket 没有同源策略

HTTP 有 CORS 限制，但 WebSocket **没有同源策略**，任何网页都可以向任意 WebSocket 服务发起连接。因此**必须在服务端验证 `Origin` 头**
:::

---

## 关闭状态码

| 状态码 | 含义         | 常见场景                   |
| ------ | ------------ | -------------------------- |
| `1000` | 正常关闭     | 主动调用 `ws.close()`      |
| `1001` | 端点离开     | 页面跳转、服务端关闭       |
| `1002` | 协议错误     | 收到不符合协议的帧         |
| `1003` | 数据类型错误 | 收到不支持的数据类型       |
| `1006` | 异常关闭     | 没有收到关闭帧（网络断开） |
| `1008` | 违反策略     | 消息违反服务端策略         |
| `1009` | 消息过大     | 超出服务端最大消息限制     |
| `1011` | 意外错误     | 服务端遇到意外情况         |

> `1006` 不能通过代码手动发送，只在连接异常断开时由浏览器自动设置

---

## 扩展性问题

当 WebSocket 应用需要扩展到多台服务器时，会面临一个核心问题：

```txt
用户 A 连接到 Server 1
用户 B 连接到 Server 2

用户 A 给用户 B 发消息 → 消息只在 Server 1，Server 2 收不到
```

---

### 解决方案：消息中间件

```txt
Server 1 ──publish──▶ Redis Pub/Sub ──subscribe──▶ Server 2
                          │
                          ▼
                      Server 3, 4, ...
```

常见方案：

| 方案                       | 说明                                                             |
| -------------------------- | ---------------------------------------------------------------- |
| Redis Pub/Sub              | 最常用，简单高效，Socket.IO 有官方 Redis Adapter                 |
| Kafka / RabbitMQ           | 需要消息持久化或复杂路由时使用                                   |
| 粘性会话（Sticky Session） | 负载均衡器将同一用户始终路由到同一服务器，但不能解决跨服务器通信 |

::: warning 核心要点

- 单台服务器的 WebSocket 连接数受限于内存和文件描述符，通常上限约 **数万到十万级**
- 水平扩展时**必须引入消息中间件**，否则不同服务器上的用户无法互相通信
- Socket.IO 提供了 `@socket.io/redis-adapter`，可以开箱即用地解决这个问题
:::
