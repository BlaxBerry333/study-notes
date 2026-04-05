# Node.js 实现

> Express 服务端 + 浏览器客户端（原生 EventSource / fetch）完整示例

## 下载安装

```zsh
% npm install express
```

---

## 最小示例

以一个实时计数器为例，服务端每秒推送一次事件

::: code-group

```ts [服务端 server.ts]
import express from "express";

const app = express();

app.get("/api/events", (req, res) => {
  // 三个必要的 SSE 响应头
  res.writeHead(200, {
    "Content-Type": "text/event-stream", // 告诉浏览器这是 SSE
    "Cache-Control": "no-cache", // 禁止缓存
    Connection: "keep-alive", // 保持连接
  });

  // 发送事件的辅助函数
  const sendEvent = (event: string, data: unknown, id?: string) => {
    if (id) res.write(`id: ${id}\n`);
    if (event) res.write(`event: ${event}\n`);
    res.write(`data: ${JSON.stringify(data)}\n\n`); // 两个换行 = 事件结束
  };

  // 定时推送
  let count = 0;
  const timer = setInterval(() => {
    sendEvent(
      "message",
      { count: ++count, time: new Date().toISOString() },
      String(count),
    );
  }, 1000);

  // 客户端断开时清理（非常重要，否则内存泄漏）
  req.on("close", () => {
    clearInterval(timer);
  });
});

app.listen(3000, () => {
  console.log("SSE server running on http://localhost:3000");
});
```

```ts [客户端（EventSource）]
// 创建连接（浏览器原生 API）
const es = new EventSource("/api/events");

// 默认 message 事件
es.onmessage = (event) => {
  const data = JSON.parse(event.data);
  console.log("收到:", data);
};

// 监听自定义事件
es.addEventListener("notification", (event) => {
  console.log("通知:", JSON.parse(event.data));
});

// 连接建立
es.onopen = () => {
  console.log("连接已建立");
};

// 错误处理（浏览器会自动重连）
es.onerror = () => {
  if (es.readyState === EventSource.CLOSED) {
    console.log("连接已关闭");
  }
};

// 主动关闭（不会自动重连）
// es.close();
```

:::

::: warning 服务端必须监听 `req.on("close")`

客户端断开后，如果服务端不清理定时器/订阅等资源，这些资源会一直占用内存，最终导致**内存泄漏**。每一个 SSE 连接都需要在 `close` 事件中做清理
:::

---

## 携带认证

EventSource 不支持自定义请求头，需要认证时有两种方案

---

### 方案一：URL 传参

```ts
// 通过 query string 传递 token
const es = new EventSource("/api/events?token=xxx");
```

```ts
// 服务端验证
app.get("/api/events", (req, res) => {
  const token = req.query.token as string;
  if (!verifyToken(token)) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  // 返回非 200 或非 text/event-stream 时，EventSource 会触发 error 且不重连
  // ... SSE 逻辑
});
```

> 注意：Token 会暴露在 URL 中（浏览器历史记录、服务器日志），适合内部系统，不适合高安全要求场景

---

### 方案二：fetch + ReadableStream

```ts
async function fetchSSE(url: string, token: string) {
  const response = await fetch(url, {
    method: "POST", // 也可以用 POST
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "text/event-stream",
    },
  });

  if (!response.ok) throw new Error(`HTTP ${response.status}`);

  const reader = response.body!.getReader();
  const decoder = new TextDecoder();

  let buffer = ""; // 缓冲区处理跨 chunk 的事件

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });

    // 按 SSE 协议解析：事件以双换行分隔
    const events = buffer.split("\n\n");
    buffer = events.pop()!; // 最后一个可能不完整，留在缓冲区

    for (const event of events) {
      for (const line of event.split("\n")) {
        if (line.startsWith("data: ")) {
          const data = JSON.parse(line.slice(6));
          console.log("收到:", data);
        }
      }
    }
  }
}
```

::: warning fetch 方案的注意事项

| 维度          | EventSource | fetch + ReadableStream |
| ------------- | ----------- | ---------------------- |
| 自定义请求头  | 不支持      | 支持                   |
| HTTP 方法     | 只能 GET    | 任意                   |
| 自动重连      | 浏览器原生  | 需手动实现             |
| 事件解析      | 自动        | 需手动解析             |
| Last-Event-ID | 自动携带    | 需手动管理             |

fetch 方案更灵活但**失去了 SSE 的自动化优势**，适合需要认证或 POST 的场景（如 AI 聊天接口）
:::

---

## 多事件类型

服务端可以发送不同类型的事件，客户端按类型监听：

::: code-group

```ts [服务端]
app.get("/api/events", (req, res) => {
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
  });

  // 不同类型的事件
  res.write(`event: user:online\ndata: {"user": "Alice"}\n\n`);
  res.write(`event: chat:message\ndata: {"text": "Hello"}\n\n`);
  res.write(
    `event: system:alert\ndata: {"level": "warning", "msg": "CPU 90%"}\n\n`,
  );

  // 没有 event 字段 → 触发默认 message 事件
  res.write(`data: 普通消息\n\n`);
});
```

```ts [客户端]
const es = new EventSource("/api/events");

// 默认 message 事件（没有 event 字段的事件才会触发）
es.onmessage = (event) => {
  console.log("普通消息:", event.data);
};

// 监听特定事件（有 event 字段的事件不会触发 onmessage）
es.addEventListener("user:online", (event) => {
  console.log("用户上线:", JSON.parse(event.data));
});

es.addEventListener("chat:message", (event) => {
  console.log("聊天消息:", JSON.parse(event.data));
});

es.addEventListener("system:alert", (event) => {
  console.log("系统警告:", JSON.parse(event.data));
});
```

:::

::: warning `onmessage` 和 `addEventListener("message")` 的区别

- 没有 `event` 字段的事件 → 触发 `onmessage`
- `event: message` 的事件 → **也**触发 `onmessage`
- `event: xxx`（非 message）→ **不触发** `onmessage`，只能通过 `addEventListener("xxx")` 监听

简单说：`onmessage` 只响应**默认事件**（无 event 字段或 `event: message`），自定义事件必须用 `addEventListener`
:::

---

## 断线重连与 Last-Event-ID

浏览器 EventSource 断线后会自动重连，并在请求头中携带 `Last-Event-ID`，服务端据此恢复推送

```ts
app.get("/api/events", (req, res) => {
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
  });

  // 读取客户端上次收到的事件 ID
  const lastId = parseInt(req.headers["last-event-id"] as string) || 0;
  console.log("客户端断点:", lastId); // 首次连接为 0

  // 从上次断开的位置继续推送
  let count = lastId;
  const timer = setInterval(() => {
    count++;
    res.write(`id: ${count}\ndata: ${JSON.stringify({ count })}\n\n`);
  }, 1000);

  // 设置重连间隔为 3 秒（客户端据此决定多久后重连）
  res.write("retry: 3000\n\n");

  req.on("close", () => {
    clearInterval(timer);
  });
});
```

::: warning 断点恢复的前提条件

- 服务端发送事件时**必须包含 `id` 字段**，否则客户端重连时没有 `Last-Event-ID`
- 服务端需要能根据 ID **找到断点数据**（内存队列、数据库、Redis 等）
- 上面的示例是最简单的场景（自增 ID），实际项目中通常需要用消息队列缓存最近的事件
- `retry` 字段可控制客户端重连间隔，默认约 3 秒（各浏览器不同）

:::

---

## 心跳保活

某些代理服务器（如 Nginx）会在一段时间没有数据传输后**主动断开连接**。通过定期发送注释（以 `:` 开头的行）来保活：

```ts
app.get("/api/events", (req, res) => {
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
  });

  // 每 15 秒发送一次心跳（注释行，客户端会忽略）
  const heartbeat = setInterval(() => {
    res.write(": heartbeat\n\n");
  }, 15_000);

  // 业务事件推送...

  req.on("close", () => {
    clearInterval(heartbeat);
  });
});
```

> Nginx 默认 `proxy_read_timeout` 为 60 秒，心跳间隔应**小于**代理的超时时间

---

## AI 流式响应示例

以类 ChatGPT 的流式输出为例，使用 `POST` + `fetch`（因为需要发送请求体）：

::: code-group

```ts [服务端]
app.post("/api/chat", express.json(), async (req, res) => {
  const { message } = req.body;

  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
  });

  // 模拟 AI 逐字输出
  const reply = `你好，关于「${message}」我的回答是：这是一个很好的问题。`;
  for (const char of reply) {
    res.write(`data: ${JSON.stringify({ token: char })}\n\n`);
    await new Promise((r) => setTimeout(r, 50)); // 模拟延迟
  }

  // 发送结束标记
  res.write("data: [DONE]\n\n");
  res.end();
});
```

```ts [客户端]
async function chat(message: string) {
  const response = await fetch("/api/chat", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: "Bearer xxx",
    },
    body: JSON.stringify({ message }),
  });

  const reader = response.body!.getReader();
  const decoder = new TextDecoder();
  let output = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    const text = decoder.decode(value, { stream: true });
    for (const line of text.split("\n")) {
      if (line.startsWith("data: ")) {
        const payload = line.slice(6);
        if (payload === "[DONE]") {
          console.log("\n--- 输出完成 ---");
          return output;
        }
        const { token } = JSON.parse(payload);
        output += token;
        process.stdout.write(token); // 逐字显示
      }
    }
  }

  return output;
}
```

:::

::: warning 为什么 AI 接口用 SSE 而不是 WebSocket

- AI 对话是**请求-响应**模式，不是双向实时通信
- SSE 基于 HTTP，与现有基础设施（CDN、API 网关、认证中间件）**完全兼容**
- 用 WebSocket 需要额外管理连接状态，对于"发一句收一段"的场景是过度设计
- 前端只需要 `fetch` + `ReadableStream`，无需引入 WebSocket 库

:::
