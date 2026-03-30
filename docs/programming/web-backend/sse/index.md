---
prev: false
next: false
---

# SSE

SSE（Server-Sent Events）是一种基于 HTTP 的服务端单向推送技术，服务端可以持续向客户端发送事件流

::: warning 特点:

- 单向通信：仅服务端向客户端推送，适合通知、日志流、AI 流式输出
- 基于 HTTP：使用标准 HTTP 协议，无需协议升级，天然兼容代理和防火墙
- 自动重连：浏览器原生支持断线自动重连，并携带 `Last-Event-ID` 恢复
- 文本协议：数据格式为纯文本（`text/event-stream`），轻量易调试
:::

::: danger 局限性:

- **单向通信**：仅服务端推送，客户端发数据需另发 HTTP 请求
- **EventSource 只支持 GET**：不能发送 body，需要 POST 时必须用 fetch + ReadableStream 替代
- **不支持自定义请求头**：无法直接携带 `Authorization`，需通过 URL 传参或 fetch 替代
- **仅文本**：不支持二进制数据
- **HTTP/1.1 连接数限制**：每域名最多 6 个 SSE 连接，需 HTTP/2 多路复用解决
:::

::: info 适用场景
通知推送、实时数据面板、日志流、AI 流式输出——**服务端单向推送**的场景。客户端发数据用普通 HTTP 请求即可。选型对比见 [API 通信方式](/programming/web-backend/api-communication#实时通信选型)
:::

```txt
┏━━━━━━━━━━━━ WebSocket ━━━━━━━━━━━┓
┃                                    ┃
┃  Client ◀━━━━ data ━━━━━▶ Server   ┃  全双工，双向通信
┃                                    ┃
┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛


┏━━━━━━━━━━━━━━ SSE ━━━━━━━━━━━━━━━━┓
┃                                    ┃
┃  Client ◀━━━━ event ━━━━ Server    ┃  单向，服务端推送
┃  Client ◀━━━━ event ━━━━ Server    ┃  基于 HTTP，自动重连
┃  Client ◀━━━━ event ━━━━ Server    ┃  纯文本流
┃                                    ┃
┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛
```

## 基础概念

| 概念         | 一句话说明                                           |
| ------------ | ---------------------------------------------------- |
| EventSource  | 浏览器原生 API，用于接收 SSE 事件流                  |
| event stream | 服务端返回的 `text/event-stream` 格式数据流          |
| event        | 事件名称，客户端通过 `addEventListener` 监听指定事件 |
| data         | 事件携带的数据，支持多行                             |
| id           | 事件 ID，断线重连时通过 `Last-Event-ID` 请求头恢复   |
| retry        | 服务端指定客户端重连间隔（毫秒）                     |

---

## 工作原理

SSE 本质上就是一个**不会结束的 HTTP 响应**：

```txt
Client                                       Server
  │                                             │
  │─── GET /api/events ────────────────────────▶│  ① 普通 HTTP 请求
  │◀── 200 OK                                   │  ② 响应头：Content-Type: text/event-stream
  │    Content-Type: text/event-stream           │
  │                                             │
  │◀── data: {"msg": "hello"}\n\n ──────────────│  ③ 持续推送事件
  │◀── data: {"msg": "world"}\n\n ──────────────│     （响应不关闭）
  │◀── data: {"msg": "..."}\n\n ────────────────│
  │                                             │
  │    （连接断开）                               │  ④ 网络异常
  │                                             │
  │─── GET /api/events ────────────────────────▶│  ⑤ 浏览器自动重连
  │    Last-Event-ID: 3                          │     携带上次事件 ID
  │◀── 200 OK ...                               │  ⑥ 服务端从断点恢复
```

::: warning 核心要点：SSE 就是 HTTP，不是新协议

- 不需要协议升级（没有 `101 Switching Protocols`）
- 服务端只需设置正确的响应头，然后**不关闭响应**，持续写入数据
- 所有 HTTP 基础设施（代理、CDN、负载均衡）都天然支持
- 这也是为什么 SSE 比 WebSocket **简单得多**
:::

---

## 协议格式

SSE 使用纯文本格式，每个字段占一行，事件之间用空行分隔

```txt
event: message
data: {"text": "Hello"}
id: 1

event: notification
data: 新消息通知
id: 2

: 这是注释，会被忽略（常用于心跳保活）

data: 没有 event 字段时，触发默认 message 事件
id: 3

retry: 5000
data: 设置重连间隔为 5 秒
```

---

### 字段说明

| 字段     | 说明                                         | 是否必须         |
| -------- | -------------------------------------------- | ---------------- |
| `data`   | 事件数据，可以多行（最终用 `\n` 拼接）       | 是               |
| `event`  | 事件类型名，省略则为默认 `message`           | 否               |
| `id`     | 事件 ID，断线重连时通过 `Last-Event-ID` 恢复 | 否（但强烈建议） |
| `retry`  | 重连间隔（毫秒），客户端据此决定多久后重连   | 否               |
| `: 注释` | 以冒号开头的行，被忽略                       | —                |

::: warning 格式要点

- 每个字段格式为 `field: value`（冒号后有一个空格）
- `data` 可以有多行，最终会用 `\n` 拼接
- 事件之间用**空行**（`\n\n`）分隔，这是事件边界的标志
- 以 `:` 开头的行是注释，常用于**心跳保活**（防止代理因超时断开连接）
:::

---

### 多行 data 示例

```txt
data: 第一行
data: 第二行
data: 第三行

```

客户端收到的 `event.data` 为 `"第一行\n第二行\n第三行"`

---

## 基本使用

### 浏览器端（EventSource API）

```js
// 创建连接
const es = new EventSource("/api/events");

// 默认 message 事件（没有 event 字段的事件）
es.onmessage = (event) => {
  console.log("收到:", event.data);
  console.log("ID:", event.lastEventId);
};

// 监听自定义事件
es.addEventListener("notification", (event) => {
  const data = JSON.parse(event.data);
  console.log("通知:", data);
});

// 连接建立
es.onopen = () => {
  console.log("连接已建立");
};

// 错误处理
es.onerror = () => {
  // 不需要手动重连，浏览器会自动处理
  if (es.readyState === EventSource.CLOSED) {
    console.log("连接已永久关闭");
  } else {
    console.log("连接中断，浏览器正在重连...");
  }
};

// 主动关闭（调用后不会自动重连）
es.close();
```

::: warning `readyState` 三种状态

| 值  | 常量                     | 含义                   |
| --- | ------------------------ | ---------------------- |
| `0` | `EventSource.CONNECTING` | 连接中 / 重连中        |
| `1` | `EventSource.OPEN`       | 连接已建立             |
| `2` | `EventSource.CLOSED`     | 连接已关闭（不会重连） |

注意只有 `close()` 方法或服务端返回非 200 / 非 `text/event-stream` 才会进入 `CLOSED` 状态。网络中断只会进入 `CONNECTING`（重连中）
:::

---

### 服务端实现要点

```js
app.get("/api/events", (req, res) => {
  // 三个必要的响应头
  res.writeHead(200, {
    "Content-Type": "text/event-stream", // 告诉浏览器这是 SSE
    "Cache-Control": "no-cache", // 禁止缓存
    Connection: "keep-alive", // 保持连接
  });

  // 推送事件...
});
```

完整实现示例见 [Node.js 实现](/programming/web-backend/sse/sample-node)

---

## 断线重连机制

浏览器原生支持断线重连，且能从断点恢复：

---


### 工作流程

```txt
① 服务端发送事件时附带 id
   → id: 42\ndata: {...}\n\n

② 连接断开（网络异常）

③ 浏览器等待 retry 时间后自动重连（默认约 3 秒）

④ 重连请求自动携带请求头 Last-Event-ID: 42

⑤ 服务端读取 Last-Event-ID，从 43 开始继续推送
```

::: warning 核心要点

- `id` 字段是断点恢复的基础，**不发 id 就无法恢复**
- `retry` 字段可控制重连间隔，单位毫秒（`retry: 5000` = 5 秒）
- 重连时浏览器自动在请求头中带上 `Last-Event-ID`，无需手动处理
- 服务端需要能根据 `Last-Event-ID` 找到断点（内存队列、数据库、Redis 等）
- `close()` 关闭的连接**不会重连**
:::

实现示例见 [Node.js 实现 - 断线重连](/programming/web-backend/sse/sample-node#断线重连与-last-event-id)

---

## 实际应用场景

### AI 流式响应（如 ChatGPT）

AI 对话接口是 SSE 最典型的现代应用场景：

```txt
Client ─── POST /api/chat (普通 HTTP 请求) ──▶ Server
Client ◀── text/event-stream                   Server

data: {"token": "你"}
data: {"token": "好"}
data: {"token": "，"}
data: {"token": "我"}
data: {"token": "是"}
data: {"token": "AI"}
data: [DONE]
```

> 注意：这里实际用的是 `POST` + `fetch` + `ReadableStream`，而不是 `EventSource`（因为需要发送 body）。但**数据格式仍然遵循 SSE 协议**

---

### 其他常见场景

| 场景          | 说明                                     |
| ------------- | ---------------------------------------- |
| 通知推送      | 新消息、系统公告，服务端有通知就推       |
| 实时数据面板  | 监控仪表盘、股票行情，定时推送最新数据   |
| 构建/部署日志 | CI/CD 日志实时输出到浏览器               |
| 进度条        | 长时间任务（上传、转码、导出）的进度反馈 |
