# React 实现

> 原生 WebSocket Hook、Socket.IO Hook、实时聊天室、在线状态、协同编辑光标

## useWebSocket（自定义 Hook）

> 管理连接生命周期、自动重连、心跳检测

WebSocket 连接是**有副作用的长生命周期资源**，必须在组件卸载时正确关闭，否则会导致内存泄漏和意外的状态更新。封装成 Hook 后变成声明式，组件只关心「发送」和「收到的消息」

::: code-group

```tsx [使用例子]
function ChatRoom({ roomId }: { roomId: string }) {
  const { sendMessage, lastMessage, readyState } = useWebSocket(
    `ws://localhost:3000/chat?room=${roomId}`,
  );

  const [messages, setMessages] = useState<string[]>([]);
  const [input, setInput] = useState("");

  // 收到新消息时追加到列表
  useEffect(() => {
    if (lastMessage) {
      setMessages((prev) => [...prev, lastMessage]);
    }
  }, [lastMessage]);

  const handleSend = () => {
    if (input.trim()) {
      sendMessage(input);
      setInput("");
    }
  };

  return (
    <div>
      <div>状态: {readyState === WebSocket.OPEN ? "已连接" : "连接中..."}</div>
      <ul>
        {messages.map((msg, i) => (
          <li key={i}>{msg}</li>
        ))}
      </ul>
      <input value={input} onChange={(e) => setInput(e.target.value)} />
      <button onClick={handleSend} disabled={readyState !== WebSocket.OPEN}>
        发送
      </button>
    </div>
  );
}
```

```ts [实现代码]
import { useState, useEffect, useRef, useCallback } from "react";

// WebSocket 是浏览器原生全局对象，无需导入
// WebSocket.CONNECTING(0) / WebSocket.OPEN(1) / WebSocket.CLOSING(2) / WebSocket.CLOSED(3)

interface UseWebSocketOptions {
  reconnect?: boolean; // 是否自动重连（默认 true）
  maxRetries?: number; // 最大重试次数（默认 5）
  heartbeatInterval?: number; // 心跳间隔 ms（默认 30000，0 = 不发心跳）
  onOpen?: (event: Event) => void;
  onClose?: (event: CloseEvent) => void;
  onError?: (event: Event) => void;
}

interface UseWebSocketReturn {
  sendMessage: (data: string | ArrayBufferLike | Blob) => void;
  lastMessage: string | null;
  readyState: number;
  close: () => void;
}

function useWebSocket(
  url: string,
  options: UseWebSocketOptions = {},
): UseWebSocketReturn {
  const {
    reconnect = true,
    maxRetries = 5,
    heartbeatInterval = 30_000,
    onOpen,
    onClose,
    onError,
  } = options;

  const [lastMessage, setLastMessage] = useState<string | null>(null);
  const [readyState, setReadyState] = useState<number>(WebSocket.CONNECTING);

  const wsRef = useRef<WebSocket | null>(null);
  const retriesRef = useRef(0);
  const heartbeatRef = useRef<ReturnType<typeof setInterval>>();
  const manualCloseRef = useRef(false); // 区分手动关闭和异常断开

  const connect = useCallback(() => {
    const ws = new WebSocket(url);
    wsRef.current = ws;

    ws.onopen = (event) => {
      setReadyState(WebSocket.OPEN);
      retriesRef.current = 0;
      onOpen?.(event);

      // 启动应用层心跳（浏览器无法发送协议层 Ping 帧，需要自行实现）
      // 服务端需配合处理 __ping__ 并回复 __pong__
      if (heartbeatInterval > 0) {
        heartbeatRef.current = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: "__ping__" }));
          }
        }, heartbeatInterval);
      }
    };

    ws.onmessage = (event) => {
      // 过滤心跳响应
      if (event.data === '{"type":"__pong__"}') return;
      setLastMessage(event.data);
    };

    ws.onclose = (event) => {
      setReadyState(WebSocket.CLOSED);
      clearInterval(heartbeatRef.current);
      onClose?.(event);

      // 非手动关闭 + 允许重连 + 未超过最大重试次数
      if (!manualCloseRef.current && reconnect && retriesRef.current < maxRetries) {
        const delay = Math.min(1000 * 2 ** retriesRef.current, 30_000);
        retriesRef.current++;
        setTimeout(connect, delay);
        setReadyState(WebSocket.CONNECTING);
      }
    };

    ws.onerror = (event) => {
      onError?.(event);
    };
  }, [url, reconnect, maxRetries, heartbeatInterval, onOpen, onClose, onError]);

  useEffect(() => {
    manualCloseRef.current = false;
    connect();

    return () => {
      manualCloseRef.current = true;
      clearInterval(heartbeatRef.current);
      wsRef.current?.close(1000, "Component unmounted");
    };
  }, [connect]);

  const sendMessage = useCallback(
    (data: string | ArrayBufferLike | Blob) => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(data);
      }
    },
    [],
  );

  const close = useCallback(() => {
    manualCloseRef.current = true;
    wsRef.current?.close(1000, "Manual close");
  }, []);

  return { sendMessage, lastMessage, readyState, close };
}
```

:::

::: tip

- **该用的场景**：任何需要 WebSocket 连接的 React 组件（聊天、实时数据、通知）
- **不该用的场景**：只需要服务端单向推送（用 SSE），或者一次性获取数据（用 HTTP）
- **为什么用 `useRef` 而不是 `useState` 存 ws 实例**：WebSocket 实例是**可变的外部资源**，不是 React 状态。用 `useState` 会导致每次重连触发不必要的重渲染，且 `setState` 是异步的，在事件回调中拿到的可能是旧值
- **为什么用 `manualCloseRef`**：区分组件卸载时的主动关闭和网络异常的被动断开，前者不应触发重连
:::

---

## useSocketIO（自定义 Hook）

> Socket.IO 事件订阅、房间、类型安全

Socket.IO 的 `socket` 实例需要全局共享（多个组件监听不同事件，但共用同一连接）。用 Context + Hook 实现：

::: code-group

```tsx [使用例子]
// 1. 在 App 中提供 Socket Context
function App() {
  return (
    <SocketProvider url="http://localhost:3000">
      <ChatRoom />
      <OnlineUsers />
    </SocketProvider>
  );
}

// 2. 在组件中使用
function ChatRoom() {
  const { socket, connected } = useSocket();
  const [messages, setMessages] = useState<Message[]>([]);

  // 监听事件（自动在卸载时取消订阅）
  useSocketEvent("chat:message", (msg: Message) => {
    setMessages((prev) => [...prev, msg]);
  });

  const sendMessage = (text: string) => {
    socket?.emit("chat:message", { text, user: "Alice" });
  };

  return (
    <div>
      <p>{connected ? "已连接" : "连接中..."}</p>
      {messages.map((m) => (
        <div key={m.id}>{m.user}: {m.text}</div>
      ))}
      <input onKeyDown={(e) => e.key === "Enter" && sendMessage(e.currentTarget.value)} />
    </div>
  );
}

function OnlineUsers() {
  const [users, setUsers] = useState<string[]>([]);

  useSocketEvent("users:update", (list: string[]) => {
    setUsers(list);
  });

  return (
    <aside>
      <h3>在线 ({users.length})</h3>
      {users.map((u) => <span key={u}>{u}</span>)}
    </aside>
  );
}
```

```tsx [实现代码]
import { createContext, useContext, useEffect, useRef, useState } from "react";
import { io, Socket } from "socket.io-client";

// ---------- Context ----------
interface SocketContextValue {
  socket: Socket | null;
  connected: boolean;
}

const SocketContext = createContext<SocketContextValue>({
  socket: null,
  connected: false,
});

// ---------- Provider ----------
export function SocketProvider({
  url,
  children,
}: {
  url: string;
  children: React.ReactNode;
}) {
  const [connected, setConnected] = useState(false);
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    const socket = io(url);
    socketRef.current = socket;

    socket.on("connect", () => setConnected(true));
    socket.on("disconnect", () => setConnected(false));

    return () => {
      socket.disconnect();
    };
  }, [url]);

  return (
    <SocketContext.Provider value={{ socket: socketRef.current, connected }}>
      {children}
    </SocketContext.Provider>
  );
}

// ---------- Hooks ----------
export function useSocket() {
  return useContext(SocketContext);
}

export function useSocketEvent<T = unknown>(event: string, handler: (data: T) => void) {
  const { socket } = useSocket();
  const handlerRef = useRef(handler);
  handlerRef.current = handler; // 始终使用最新的 handler，避免闭包陈旧

  useEffect(() => {
    if (!socket) return;

    const listener = (data: T) => handlerRef.current(data);
    socket.on(event, listener);

    return () => {
      socket.off(event, listener);
    };
  }, [socket, event]);
}
```

:::

::: tip

- **该用的场景**：需要房间、命名空间、事件机制的复杂实时应用
- **不该用的场景**：简单的单连接场景（用原生 `useWebSocket` 更轻量）
- **为什么用 `handlerRef`**：`handler` 可能每次渲染都是新函数（如内联箭头函数），如果直接传给 `socket.on`，每次重渲染都会解绑+重绑。`useRef` 保证 listener 引用不变，内部调用始终最新的 handler
- **为什么 Provider 只创建一次连接**：Socket.IO 连接是**全局资源**，多个组件应共享同一连接，而非各自创建
:::

---

## 实时聊天室（完整示例）

> 综合示例 — 消息收发、连接状态、用户列表、房间切换

::: code-group

```tsx [ChatApp.tsx]
import { useState, useEffect, useRef } from "react";
import { useWebSocket } from "./useWebSocket"; // 自定义 Hook，见本页上方

interface Message {
  id: string;
  user: string;
  text: string;
  timestamp: number;
}

function ChatApp({ userId }: { userId: string }) {
  const [room, setRoom] = useState("general");
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const listRef = useRef<HTMLDivElement>(null);

  const { sendMessage, lastMessage, readyState } = useWebSocket(
    `ws://localhost:3000/chat?user=${userId}&room=${room}`,
  );

  // 收到消息
  useEffect(() => {
    if (!lastMessage) return;
    try {
      const msg: Message = JSON.parse(lastMessage);
      setMessages((prev) => [...prev, msg]);
    } catch {
      // 忽略非 JSON 消息（如欢迎消息）
    }
  }, [lastMessage]);

  // 自动滚动到底部
  useEffect(() => {
    listRef.current?.scrollTo(0, listRef.current.scrollHeight);
  }, [messages]);

  // 切换房间时清空消息
  useEffect(() => {
    setMessages([]);
  }, [room]);

  const handleSend = () => {
    if (!input.trim() || readyState !== WebSocket.OPEN) return;
    const msg: Message = {
      id: crypto.randomUUID(),
      user: userId,
      text: input.trim(),
      timestamp: Date.now(),
    };
    sendMessage(JSON.stringify(msg));
    setMessages((prev) => [...prev, msg]); // 乐观更新
    setInput("");
  };

  const isConnected = readyState === WebSocket.OPEN;

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh" }}>
      {/* 房间切换 */}
      <nav>
        {["general", "tech", "random"].map((r) => (
          <button
            key={r}
            onClick={() => setRoom(r)}
            style={{ fontWeight: room === r ? "bold" : "normal" }}
          >
            #{r}
          </button>
        ))}
        <span>{isConnected ? "🟢 已连接" : "🔴 断开"}</span>
      </nav>

      {/* 消息列表 */}
      <div ref={listRef} style={{ flex: 1, overflow: "auto" }}>
        {messages.map((msg) => (
          <div key={msg.id}>
            <strong>{msg.user}</strong>: {msg.text}
            <small>{new Date(msg.timestamp).toLocaleTimeString()}</small>
          </div>
        ))}
      </div>

      {/* 输入框 */}
      <div>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSend()}
          placeholder={isConnected ? "输入消息..." : "正在重连..."}
          disabled={!isConnected}
        />
        <button onClick={handleSend} disabled={!isConnected}>
          发送
        </button>
      </div>
    </div>
  );
}
```

```ts [服务端 server.ts]
import { WebSocketServer, WebSocket } from "ws";
import { createServer } from "http";
import url from "url";

const server = createServer();
const wss = new WebSocketServer({ server });

// 房间管理
const rooms = new Map<string, Set<WebSocket>>();

wss.on("connection", (ws, req) => {
  const { room = "general", user = "anonymous" } = url.parse(req.url!, true).query as Record<
    string,
    string
  >;

  // 加入房间
  if (!rooms.has(room)) rooms.set(room, new Set());
  rooms.get(room)!.add(ws);

  console.log(`${user} joined #${room}`);

  // 转发消息给同房间的其他人
  ws.on("message", (data) => {
    const msg = data.toString();
    rooms.get(room)?.forEach((client) => {
      if (client !== ws && client.readyState === WebSocket.OPEN) {
        client.send(msg);
      }
    });
  });

  ws.on("close", () => {
    rooms.get(room)?.delete(ws);
    if (rooms.get(room)?.size === 0) rooms.delete(room);
  });
});

server.listen(3000);
```

:::

::: warning 乐观更新（Optimistic Update）

发送消息时**不等服务端确认**，先把消息显示在本地列表中，这样用户感受不到网络延迟。如果发送失败（readyState 变为 CLOSED），可以在 UI 上标记消息为"发送失败"并提供重试按钮
:::

---

## 在线状态指示器

> 显示当前连接状态、正在输入提示（typing indicator）

::: code-group

```tsx [使用例子]
function TypingIndicator({ roomId }: { roomId: string }) {
  const { typingUsers, startTyping, stopTyping } = useTypingStatus(roomId);

  return (
    <div>
      {/* 输入框绑定 */}
      <input
        onFocus={startTyping}
        onBlur={stopTyping}
        onChange={startTyping} // 每次按键重置计时器
      />

      {/* 显示谁在输入 */}
      {typingUsers.length > 0 && (
        <p>
          {typingUsers.length === 1
            ? `${typingUsers[0]} 正在输入...`
            : typingUsers.length <= 3
              ? `${typingUsers.join("、")} 正在输入...`
              : `${typingUsers.length} 人正在输入...`}
        </p>
      )}
    </div>
  );
}
```

```ts [实现代码]
import { useState, useEffect, useRef, useCallback } from "react";
import { useSocket, useSocketEvent } from "./useSocketIO"; // 自定义 Hook，见本页上方

function useTypingStatus(roomId: string) {
  const { socket } = useSocket();
  const [typingUsers, setTypingUsers] = useState<string[]>([]);
  const typingTimerRef = useRef<ReturnType<typeof setTimeout>>();

  // 监听他人的输入状态
  useSocketEvent("typing:start", (user: string) => {
    setTypingUsers((prev) => (prev.includes(user) ? prev : [...prev, user]));
  });

  useSocketEvent("typing:stop", (user: string) => {
    setTypingUsers((prev) => prev.filter((u) => u !== user));
  });

  // 通知自己正在输入（防抖：停止输入 2 秒后自动发 stop）
  const startTyping = useCallback(() => {
    clearTimeout(typingTimerRef.current);
    socket?.emit("typing:start", roomId);

    typingTimerRef.current = setTimeout(() => {
      socket?.emit("typing:stop", roomId);
    }, 2000);
  }, [socket, roomId]);

  const stopTyping = useCallback(() => {
    clearTimeout(typingTimerRef.current);
    socket?.emit("typing:stop", roomId);
  }, [socket, roomId]);

  // 组件卸载时通知停止输入
  useEffect(() => {
    return () => {
      clearTimeout(typingTimerRef.current);
      socket?.emit("typing:stop", roomId);
    };
  }, [socket, roomId]);

  return { typingUsers, startTyping, stopTyping };
}
```

:::

::: tip

- **防抖策略**：每次按键重置 2 秒计时器，超时后自动发送 `typing:stop`。这样不需要每次按键都发网络请求，又能在用户停止输入后及时更新状态
- **去重**：`setTypingUsers` 中先检查是否已存在，避免同一用户重复出现
:::

---

## 实时数据面板

> 股票行情、监控数据等 — 高频更新 + 节流渲染

高频推送（如每 100ms 一条）时，不应每条消息都触发 React 重渲染。用 `useRef` 缓冲数据，用 `requestAnimationFrame` 批量更新：

::: code-group

```tsx [使用例子]
function StockDashboard() {
  const prices = useRealtimeData<Record<string, number>>(
    "ws://localhost:3000/stocks",
    {}, // 初始值
  );

  return (
    <table>
      <thead>
        <tr><th>股票</th><th>价格</th></tr>
      </thead>
      <tbody>
        {Object.entries(prices).map(([symbol, price]) => (
          <tr key={symbol}>
            <td>{symbol}</td>
            <td>{price.toFixed(2)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
```

```ts [实现代码]
import { useState, useEffect, useRef } from "react";

function useRealtimeData<T>(url: string, initialData: T): T {
  const [data, setData] = useState<T>(initialData);
  const bufferRef = useRef<T>(initialData);
  const rafRef = useRef<number>();

  useEffect(() => {
    const ws = new WebSocket(url);

    ws.onmessage = (event) => {
      const parsed = JSON.parse(event.data);

      // 合并到缓冲区（不触发渲染）
      bufferRef.current = { ...bufferRef.current, ...parsed };

      // 用 rAF 批量更新（每帧最多更新一次 ≈ 60fps）
      if (!rafRef.current) {
        rafRef.current = requestAnimationFrame(() => {
          setData({ ...bufferRef.current });
          rafRef.current = undefined;
        });
      }
    };

    return () => {
      ws.close();
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [url]);

  return data;
}
```

:::

::: tip

- **该用的场景**：服务端推送频率 > React 渲染频率（>16ms/条）的场景
- **不该用的场景**：低频推送（每秒几条以下）直接 `setState` 就行，不需要缓冲
- **为什么用 `requestAnimationFrame` 而不是 `setTimeout` 节流**：rAF 与浏览器渲染帧同步，保证每帧只更新一次且不丢帧。`setTimeout` 可能和渲染周期错位，造成视觉上的卡顿或跳帧
- **为什么用 `useRef` 做缓冲**：`useRef` 修改不触发重渲染，适合做高频写入的中间存储
:::

---

## 协同编辑光标

> 实时显示其他用户的光标位置（类似 Figma / Google Docs）

::: code-group

```tsx [使用例子]
function CollaborativeEditor() {
  const { cursors, updateCursor } = useCursors("doc-123");

  return (
    <div
      style={{ position: "relative", width: "100%", height: "100vh" }}
      onMouseMove={(e) => {
        updateCursor({ x: e.clientX, y: e.clientY });
      }}
    >
      {/* 编辑器内容 */}
      <textarea style={{ width: "100%", height: "100%" }} />

      {/* 其他用户的光标 */}
      {Object.entries(cursors).map(([userId, cursor]) => (
        <div
          key={userId}
          style={{
            position: "absolute",
            left: cursor.x,
            top: cursor.y,
            pointerEvents: "none",
            transition: "all 0.1s ease-out", // 平滑移动
          }}
        >
          <svg width="16" height="16" viewBox="0 0 16 16">
            <path d="M0 0 L16 6 L6 16 Z" fill={cursor.color} />
          </svg>
          <span
            style={{
              background: cursor.color,
              color: "white",
              padding: "2px 6px",
              borderRadius: 4,
              fontSize: 12,
            }}
          >
            {cursor.name}
          </span>
        </div>
      ))}
    </div>
  );
}
```

```ts [实现代码]
import { useState, useEffect, useRef, useCallback } from "react";

interface CursorInfo {
  x: number;
  y: number;
  color: string;
  name: string;
}

function useCursors(docId: string) {
  const [cursors, setCursors] = useState<Record<string, CursorInfo>>({});
  const wsRef = useRef<WebSocket | null>(null);
  const throttleRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    const ws = new WebSocket(`ws://localhost:3000/cursors?doc=${docId}`);
    wsRef.current = ws;

    ws.onmessage = (event) => {
      const { type, userId, ...data } = JSON.parse(event.data);

      if (type === "cursor:move") {
        setCursors((prev) => ({
          ...prev,
          [userId]: data as CursorInfo,
        }));
      }

      if (type === "cursor:leave") {
        setCursors((prev) => {
          const next = { ...prev };
          delete next[userId];
          return next;
        });
      }
    };

    return () => ws.close();
  }, [docId]);

  // 节流发送（每 50ms 最多一次，避免高频鼠标事件淹没网络）
  const updateCursor = useCallback((pos: { x: number; y: number }) => {
    if (throttleRef.current) return;
    throttleRef.current = setTimeout(() => {
      throttleRef.current = undefined;
    }, 50);

    wsRef.current?.send(JSON.stringify({ type: "cursor:move", ...pos }));
  }, []);

  return { cursors, updateCursor };
}
```

:::

::: tip

- **节流 50ms**：鼠标 `mousemove` 可以每秒触发数百次，50ms 节流后 ≈ 20fps，对光标显示已足够流畅
- **CSS `transition`**：光标位置虽然是离散更新的（每 50ms 一次），但加上 `transition: all 0.1s ease-out` 后视觉上是平滑移动的
- **清理离开的光标**：用户断开连接时，服务端应广播 `cursor:leave` 事件，前端从 state 中移除该光标
:::
