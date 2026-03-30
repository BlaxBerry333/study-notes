# Node.js 实现

> ws 库（原生 WebSocket）与 Socket.IO（高级封装）两种方案对比

## 下载安装

::: code-group

```zsh [ws（原生）]
% npm install ws
% npm install -D @types/ws    # TypeScript 类型
```

```zsh [Socket.IO]
% npm install socket.io          # 服务端
% npm install socket.io-client   # 客户端
```

:::

---

## 最小示例

以一个简易聊天室为例，展示服务端 + 客户端完整实现

---

### ws 库

::: code-group

```ts [服务端 server.ts]
import { WebSocketServer, WebSocket } from "ws";

const wss = new WebSocketServer({ port: 3000 });

wss.on("connection", (ws, req) => {
  console.log("新客户端连接:", req.socket.remoteAddress);

  // 接收消息
  ws.on("message", (data) => {
    const message = data.toString();
    console.log("收到:", message);

    // 广播给所有客户端
    wss.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(message);
      }
    });
  });

  // 连接关闭
  ws.on("close", (code, reason) => {
    console.log(`客户端断开: ${code}`);
  });

  // 发送欢迎消息
  ws.send("Welcome!");
});

console.log("WebSocket server running on ws://localhost:3000");
```

```ts [客户端 client.ts（浏览器）]
const ws = new WebSocket("ws://localhost:3000");

// 连接建立
ws.onopen = () => {
  console.log("连接已建立");
  ws.send(JSON.stringify({ user: "Alice", text: "Hello!" }));
};

// 接收消息
ws.onmessage = (event) => {
  console.log("收到消息:", event.data);
};

// 连接关闭
ws.onclose = (event) => {
  console.log(`连接关闭: code=${event.code}, reason=${event.reason}`);
};

// 连接错误
ws.onerror = (error) => {
  console.error("连接错误:", error);
};
```

:::

---

### Socket.IO

::: code-group

```ts [服务端 server.ts]
import { Server } from "socket.io";

const io = new Server(3000, {
  cors: { origin: "*" },
});

io.on("connection", (socket) => {
  console.log("新客户端连接:", socket.id);

  // 加入房间
  socket.join("chat-room");

  // 监听自定义事件
  socket.on("chat:message", (msg) => {
    console.log("收到:", msg);
    // 广播给房间内其他人
    socket.to("chat-room").emit("chat:message", msg);
  });

  // 断开连接
  socket.on("disconnect", (reason) => {
    console.log("断开:", reason);
  });
});

console.log("Socket.IO server running on port 3000");
```

```ts [客户端 client.ts（浏览器）]
import { io } from "socket.io-client";

const socket = io("http://localhost:3000");

socket.on("connect", () => {
  console.log("连接已建立:", socket.id);
  socket.emit("chat:message", { user: "Alice", text: "Hello!" });
});

socket.on("chat:message", (msg) => {
  console.log("收到:", msg);
});

socket.on("disconnect", (reason) => {
  console.log("断开:", reason);
});
```

:::

::: warning ws vs Socket.IO 的本质区别

| 维度     | ws                   | Socket.IO                              |
| -------- | -------------------- | -------------------------------------- |
| 协议     | 标准 WebSocket 协议  | **自定义协议**（不兼容原生 WebSocket） |
| 传输层   | 只用 WebSocket       | WebSocket + HTTP 长轮询（自动降级）    |
| 重连     | 不支持               | 内置自动重连 + 指数退避                |
| 房间     | 不支持               | 内置房间/命名空间                      |
| 广播     | 手动遍历 clients     | `socket.to(room).emit()`               |
| 事件机制 | `onmessage` 单一事件 | 自定义事件名 `emit/on`                 |
| 包大小   | ~2KB                 | ~40KB（客户端）                        |

Socket.IO 客户端**不能连接**原生 WebSocket 服务器，反之亦然
:::

---

## 心跳检测

ws 库不内置心跳，需要手动实现。心跳用于检测"半死连接"（TCP 连接存在但实际不可达）

```ts
import { WebSocketServer, WebSocket } from "ws";

const wss = new WebSocketServer({ port: 3000 });

const HEARTBEAT_INTERVAL = 30_000; // 30 秒

wss.on("connection", (ws) => {
  let isAlive = true;

  // 收到 pong 说明连接存活
  ws.on("pong", () => {
    isAlive = true;
  });

  const timer = setInterval(() => {
    if (!isAlive) {
      ws.terminate(); // 无响应，强制断开（不走关闭握手）
      return;
    }
    isAlive = false;
    ws.ping(); // 发送 ping，等待 pong
  }, HEARTBEAT_INTERVAL);

  ws.on("close", () => {
    clearInterval(timer);
  });
});
```

::: tip `terminate()` vs `close()`

- `ws.close()` — 发送关闭帧，等待对方确认后断开（优雅关闭）
- `ws.terminate()` — 直接销毁底层 TCP 连接（强制关闭，用于清理死连接）
  :::

Socket.IO 内置心跳机制，通过配置即可：

```ts
const io = new Server(3000, {
  pingInterval: 25000, // 每 25 秒发一次 ping
  pingTimeout: 5000, // 5 秒内未收到 pong 则断开
});
```

---

## 与 Express/Koa 集成

将 WebSocket 服务挂载到已有 HTTP 服务器上，共享同一端口：

```ts
import express from "express";
import { createServer } from "http";
import { WebSocketServer } from "ws";

const app = express();
const server = createServer(app);

// HTTP 路由照常使用
app.get("/health", (req, res) => {
  res.json({ status: "ok" });
});

app.get("/", (req, res) => {
  res.send("HTTP 和 WebSocket 共享 3000 端口");
});

// WebSocket 挂载到同一 HTTP 服务器
const wss = new WebSocketServer({ server });

wss.on("connection", (ws) => {
  ws.on("message", (data) => {
    ws.send(`Echo: ${data}`);
  });
});

// 注意：用 server.listen() 而不是 app.listen()
server.listen(3000, () => {
  console.log("HTTP + WS server running on port 3000");
});
```

::: warning 核心要点

- 关键在于用 `createServer(app)` 创建 HTTP 服务器，再将其传给 `WebSocketServer`
- `app.listen()` 内部也是调用 `createServer()`，但拿不到 server 实例
- HTTP 请求走 Express 路由，WebSocket 升级请求走 ws 库，互不干扰
  :::

---

## 认证

WebSocket 握手是 HTTP 请求，之后就不再是 HTTP 了，因此认证要在**握手阶段**完成

---

### 方案一：URL 参数

```ts
// 客户端
const ws = new WebSocket("ws://localhost:3000?token=xxx");

// 服务端
import url from "url";

wss.on("connection", (ws, req) => {
  const { token } = url.parse(req.url!, true).query;
  if (!verifyToken(token as string)) {
    ws.close(1008, "Unauthorized");
    return;
  }
  // 认证通过...
});
```

---

### 方案二：Cookie

```ts
// 服务端（验证 Cookie）
wss.on("connection", (ws, req) => {
  const cookie = req.headers.cookie;
  const session = parseCookie(cookie); // 自定义解析
  if (!session?.userId) {
    ws.close(1008, "Unauthorized");
    return;
  }
  // 认证通过...
});
```

---

### 方案三：首条消息认证

```ts
// 客户端
ws.onopen = () => {
  ws.send(JSON.stringify({ type: "auth", token: "xxx" }));
};

// 服务端
wss.on("connection", (ws) => {
  let authenticated = false;

  ws.on("message", (data) => {
    const msg = JSON.parse(data.toString());

    if (!authenticated) {
      if (msg.type === "auth" && verifyToken(msg.token)) {
        authenticated = true;
        ws.send(JSON.stringify({ type: "auth:ok" }));
      } else {
        ws.close(1008, "Unauthorized");
      }
      return;
    }

    // 正常业务消息处理...
  });
});
```

::: tip 三种方案对比

| 方案     | 优点                   | 缺点                                  |
| -------- | ---------------------- | ------------------------------------- |
| URL 参数 | 简单                   | Token 暴露在 URL 中（会出现在日志里） |
| Cookie   | 浏览器自动携带         | 不适合跨域场景                        |
| 首条消息 | 灵活，支持任意认证逻辑 | 握手阶段未认证，存在短暂的未授权连接  |

:::

---

## 客户端自动重连

原生 WebSocket 不支持自动重连，常见封装模式（指数退避）：

```ts
function createReconnectingWS(url: string, maxRetries = 5) {
  let retries = 0;
  let ws: WebSocket;

  function connect() {
    ws = new WebSocket(url);

    ws.onopen = () => {
      console.log("连接已建立");
      retries = 0; // 连接成功，重置计数
    };

    ws.onclose = (event) => {
      // 1000 = 正常关闭，不重连
      if (event.code !== 1000 && retries < maxRetries) {
        const delay = Math.min(1000 * 2 ** retries, 30_000); // 1s → 2s → 4s → ... → 最大 30s
        console.log(`${delay}ms 后重连（第 ${retries + 1} 次）...`);
        setTimeout(connect, delay);
        retries++;
      }
    };

    ws.onmessage = (event) => {
      console.log("收到:", event.data);
    };
  }

  connect();

  return {
    get ws() {
      return ws;
    },
    close() {
      ws.close(1000, "Manual close");
    }, // 正常关闭，不触发重连
  };
}
```

::: warning 指数退避（Exponential Backoff）

重连间隔按 `2^n` 秒递增（1s → 2s → 4s → 8s → ...），避免大量客户端同时断线后瞬间全部重连导致服务端**连接风暴**

生产环境建议加上**随机抖动**（jitter）：`delay * (0.5 + Math.random() * 0.5)`，进一步分散重连请求
:::

---

## 消息协议设计

原生 WebSocket 只提供"发送字符串/二进制"的能力，业务层需要自行设计消息格式：

```ts
// 常见的 JSON 消息协议
interface WSMessage {
  type: string;     // 消息类型，类似事件名
  payload: unknown; // 消息数据
  id?: string;      // 消息 ID（用于请求-响应匹配）
}

// 示例
{ type: "chat:message", payload: { text: "Hello", room: "general" } }
{ type: "user:typing",  payload: { userId: "123" } }
{ type: "error",        payload: { code: 400, message: "Bad Request" } }
```

::: tip Socket.IO 内置了事件机制（`emit/on`），不需要手动设计消息协议，这也是它比原生 WebSocket 更方便的原因之一
:::
