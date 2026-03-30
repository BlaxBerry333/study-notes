# TanStack Query 集成

::: tip 为什么要集成
原生 WebSocket + `useState` 存在两套状态管理不统一、缺少缓存/自动失效、多组件共享需手动管理等问题。TanStack Query 本身不支持 WebSocket，但通过**手动更新 queryCache** 可以把实时推送的数据同步到缓存中，让所有订阅了该 queryKey 的组件自动更新
:::

## 下载安装

```zsh
% npm install @tanstack/react-query
```

---

## 核心思路

```txt
┌──────────────┐     HTTP GET        ┌──────────┐
│  useQuery()  │ ──────────────────▶ │  Server  │   ① 首次加载走 HTTP
│  (缓存 + UI) │ ◀───── JSON ─────── │          │
└──────┬───────┘                     └────┬─────┘
       │                                  │
       │  queryClient.setQueryData()      │ WebSocket push
       │ ◀─────── 实时更新缓存 ──────────  │         ② 后续增量走 WS
       │                                  │
└──────┴──────────────────────────────────┘
```

::: warning 核心要点

- `useQuery` 负责**初始加载**和**缓存管理**（首次渲染时通过 HTTP 拿全量数据）
- WebSocket 负责**增量更新**（连接建立后，服务端推送变更数据）
- 通过 `queryClient.setQueryData()` 将 WebSocket 收到的数据**同步到 TanStack Query 缓存**
- 所有使用了同一 `queryKey` 的组件自动重渲染，不需要手动 `setState`
:::

---

## 实时列表（基础用法）

最常见的模式：HTTP 加载初始数据 + WebSocket 推送新增/更新/删除

::: code-group

```tsx [使用例子]
function MessageList({ roomId }: { roomId: string }) {
  const { data: messages = [], isLoading } = useMessagesQuery(roomId);

  // WebSocket 自动同步到 queryCache，组件自动更新
  useMessagesSubscription(roomId);

  if (isLoading) return <p>加载中...</p>;

  return (
    <ul>
      {messages.map((msg) => (
        <li key={msg.id}>
          <strong>{msg.user}</strong>: {msg.text}
          <small>{new Date(msg.timestamp).toLocaleTimeString()}</small>
        </li>
      ))}
    </ul>
  );
}
```

```ts [实现代码]
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef } from "react";

interface Message {
  id: string;
  user: string;
  text: string;
  timestamp: number;
}

// ① HTTP 查询：加载初始数据
function useMessagesQuery(roomId: string) {
  return useQuery({
    queryKey: ["messages", roomId],
    queryFn: async () => {
      const res = await fetch(`/api/rooms/${roomId}/messages`);
      return res.json() as Promise<Message[]>;
    },
    staleTime: Infinity, // WebSocket 会负责更新，不需要自动 refetch
  });
}

// ② WebSocket 订阅：增量同步到 queryCache
function useMessagesSubscription(roomId: string) {
  const queryClient = useQueryClient();
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    const ws = new WebSocket(`ws://localhost:3000/rooms/${roomId}`);
    wsRef.current = ws;

    ws.onmessage = (event) => {
      const { type, data } = JSON.parse(event.data);

      switch (type) {
        case "message:new":
          // 追加新消息
          queryClient.setQueryData<Message[]>(
            ["messages", roomId],
            (old = []) => [...old, data],
          );
          break;

        case "message:update":
          // 更新已有消息
          queryClient.setQueryData<Message[]>(
            ["messages", roomId],
            (old = []) =>
              old.map((msg) =>
                msg.id === data.id ? { ...msg, ...data } : msg,
              ),
          );
          break;

        case "message:delete":
          // 删除消息
          queryClient.setQueryData<Message[]>(
            ["messages", roomId],
            (old = []) => old.filter((msg) => msg.id !== data.id),
          );
          break;
      }
    };

    return () => ws.close();
  }, [roomId, queryClient]);
}
```

:::

::: tip

- **`staleTime: Infinity`**：告诉 TanStack Query "不要自动 refetch"，因为 WebSocket 会负责更新。否则切换标签页回来时会触发一次不必要的 HTTP 请求
- **`setQueryData` 的 updater 函数**：接收旧缓存数据，返回新数据。TanStack Query 自动触发所有订阅了该 queryKey 的组件重渲染
- **为什么不直接 `invalidateQueries`**：invalidate 会触发 HTTP refetch（拉全量），适合偶尔刷新。对于高频实时更新，直接操作缓存更高效
:::

---

## 乐观更新 + WebSocket 确认

发送消息时先乐观更新 UI，再通过 WebSocket 发送。服务端确认后，WebSocket 推送会自动覆盖乐观数据

::: code-group

```tsx [使用例子]
function ChatInput({ roomId }: { roomId: string }) {
  const [input, setInput] = useState("");
  const { mutate: sendMessage, isPending } = useSendMessage(roomId);

  const handleSend = () => {
    if (!input.trim()) return;
    sendMessage(input.trim());
    setInput("");
  };

  return (
    <div>
      <input
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && handleSend()}
      />
      <button onClick={handleSend} disabled={isPending}>
        发送
      </button>
    </div>
  );
}
```

```ts [实现代码]
import { useMutation, useQueryClient } from "@tanstack/react-query";

function useSendMessage(roomId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (text: string) => {
      const res = await fetch(`/api/rooms/${roomId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      return res.json() as Promise<Message>;
    },

    // 乐观更新：发送前先更新 UI
    onMutate: async (text) => {
      await queryClient.cancelQueries({ queryKey: ["messages", roomId] });

      const previous = queryClient.getQueryData<Message[]>([
        "messages",
        roomId,
      ]);

      const optimisticMessage: Message = {
        id: `temp-${Date.now()}`, // 临时 ID
        user: "me",
        text,
        timestamp: Date.now(),
      };

      queryClient.setQueryData<Message[]>(["messages", roomId], (old = []) => [
        ...old,
        optimisticMessage,
      ]);

      return { previous };
    },

    // 发送失败：回滚到乐观更新前的数据
    onError: (_err, _text, context) => {
      if (context?.previous) {
        queryClient.setQueryData(["messages", roomId], context.previous);
      }
    },

    // 不需要 onSuccess / onSettled 中 invalidate
    // 因为 WebSocket 推送的 "message:new" 事件会自动更新缓存
    // 服务端分配的真实 ID 会覆盖临时 ID
  });
}
```

:::

::: warning 乐观更新 + WebSocket 的协作流程

```txt
① 用户点击发送
② onMutate → 乐观插入临时消息（id: "temp-xxx"）→ UI 立即显示
③ mutationFn → POST /api/messages → 服务端保存并广播
④ WebSocket 推送 "message:new"（id: "real-xxx"）
⑤ setQueryData 追加真实消息 → 列表中出现两条？
```

解决重复：服务端广播时可以**排除发送者本人**，或者客户端在 WebSocket handler 中检查 `temp-` 前缀的消息是否已被真实消息替换
:::

---

## 实时数据面板 + 缓存

股票行情、监控数据等高频推送场景：HTTP 加载初始快照 + WebSocket 增量更新

::: code-group

```tsx [使用例子]
function StockDashboard() {
  const { data: stocks = {}, isLoading } = useStocksQuery();
  useStocksSubscription();

  if (isLoading) return <p>加载中...</p>;

  return (
    <table>
      <thead>
        <tr>
          <th>代码</th>
          <th>价格</th>
          <th>涨跌</th>
        </tr>
      </thead>
      <tbody>
        {Object.entries(stocks).map(([symbol, info]) => (
          <tr key={symbol}>
            <td>{symbol}</td>
            <td>{info.price.toFixed(2)}</td>
            <td style={{ color: info.change >= 0 ? "green" : "red" }}>
              {info.change >= 0 ? "+" : ""}
              {info.change.toFixed(2)}%
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
```

```ts [实现代码]
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef } from "react";

interface StockInfo {
  price: number;
  change: number;
}

type StockMap = Record<string, StockInfo>;

// ① HTTP：加载初始快照
function useStocksQuery() {
  return useQuery({
    queryKey: ["stocks"],
    queryFn: async () => {
      const res = await fetch("/api/stocks");
      return res.json() as Promise<StockMap>;
    },
    staleTime: Infinity,
  });
}

// ② WebSocket：增量更新
function useStocksSubscription() {
  const queryClient = useQueryClient();
  const bufferRef = useRef<StockMap>({});
  const rafRef = useRef<number>();

  useEffect(() => {
    const ws = new WebSocket("ws://localhost:3000/stocks");

    ws.onmessage = (event) => {
      const update: StockMap = JSON.parse(event.data);

      // 合并到缓冲区（不立即触发渲染）
      Object.assign(bufferRef.current, update);

      // 用 rAF 批量刷新缓存（每帧最多一次）
      if (!rafRef.current) {
        rafRef.current = requestAnimationFrame(() => {
          const buffered = { ...bufferRef.current };
          bufferRef.current = {};
          rafRef.current = undefined;

          queryClient.setQueryData<StockMap>(["stocks"], (old = {}) => ({
            ...old,
            ...buffered,
          }));
        });
      }
    };

    return () => {
      ws.close();
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [queryClient]);
}
```

:::

::: tip

- **rAF 缓冲**：股票数据可能每 100ms 推一次，直接 `setQueryData` 会导致每秒触发 10+ 次重渲染。用 `requestAnimationFrame` 将多次更新合并为每帧一次（≈60fps）
- **`staleTime: Infinity`**：同上，WebSocket 负责更新，不需要自动 refetch
- **初始快照的必要性**：WebSocket 只推增量变更，连接建立时可能错过之前的数据。HTTP 提供完整快照作为基线
:::

---

## 连接状态同步

把 WebSocket 连接状态也纳入 TanStack Query 管理，任何组件都可以读取：

::: code-group

```tsx [使用例子]
// 任意组件中读取连接状态
function ConnectionIndicator() {
  const status = useWSStatus();

  return (
    <span>
      {status === "connected" && "🟢 已连接"}
      {status === "connecting" && "🟡 连接中"}
      {status === "disconnected" && "🔴 已断开"}
    </span>
  );
}

// 另一个组件也能读取同一状态
function SendButton() {
  const status = useWSStatus();
  return <button disabled={status !== "connected"}>发送</button>;
}
```

```ts [实现代码]
import { useQuery, useQueryClient } from "@tanstack/react-query";

type WSStatus = "connecting" | "connected" | "disconnected";

// 读取连接状态
function useWSStatus(): WSStatus {
  const { data = "connecting" } = useQuery<WSStatus>({
    queryKey: ["ws-status"],
    enabled: false, // 不发请求，仅作为共享状态容器
    initialData: "connecting",
  });
  return data;
}

// 在 WebSocket 连接管理处更新状态
function useWSStatusSync(ws: WebSocket | null) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!ws) return;

    const setStatus = (status: WSStatus) => {
      queryClient.setQueryData(["ws-status"], status);
    };

    ws.addEventListener("open", () => setStatus("connected"));
    ws.addEventListener("close", () => setStatus("disconnected"));

    return () => {
      setStatus("disconnected");
    };
  }, [ws, queryClient]);
}
```

:::

::: warning 把 TanStack Query 当作"全局共享状态"

`useQuery({ enabled: false })` 不会发起请求，此时 queryCache 就是一个**类型安全的全局状态容器**。与 Zustand/Redux 相比：

- 不需要额外引入状态库
- 天然支持 devtools（React Query Devtools）
- 状态和服务端数据用同一套工具管理，心智模型统一
:::

---

## 断线恢复策略

WebSocket 断线重连后，缓存中的数据可能已过时。三种恢复策略：

---


### 策略一：重连后 invalidate（推荐）

```ts
ws.onopen = () => {
  if (isReconnection) {
    // 重连后让 TanStack Query 重新 fetch 全量数据
    queryClient.invalidateQueries({ queryKey: ["messages", roomId] });
  }
};
```

---

### 策略二：服务端推送全量快照

```ts
ws.onmessage = (event) => {
  const { type, data } = JSON.parse(event.data);

  if (type === "snapshot") {
    // 服务端在重连时主动推送全量数据
    queryClient.setQueryData(["messages", roomId], data);
  }
};
```

---

### 策略三：基于序号的增量补偿

```ts
// 记录最后收到的事件序号
let lastSeq = 0;

ws.onmessage = (event) => {
  const { seq, ...data } = JSON.parse(event.data);
  lastSeq = seq;
  // 正常处理...
};

// 重连时携带最后序号，服务端补发缺失的事件
ws.onopen = () => {
  ws.send(JSON.stringify({ type: "sync", lastSeq }));
};
```

::: tip 怎么选

| 策略       | 适用场景                 | 优点     | 缺点                 |
| ---------- | ------------------------ | -------- | -------------------- |
| invalidate | 数据量小、允许短暂加载态 | 实现简单 | 短暂白屏/loading     |
| 全量快照   | 数据量中等               | 无缝恢复 | 浪费带宽             |
| 增量补偿   | 数据量大、消息有序       | 最省带宽 | 服务端需维护事件日志 |

:::
