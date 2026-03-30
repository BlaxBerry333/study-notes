# TanStack Query 集成

::: tip 为什么要集成
SSE 推送的数据和 HTTP 请求的数据往往是同一份资源的不同获取方式（如 `GET /api/notifications` 首次加载全量，`SSE /api/notifications/stream` 后续推送增量），两者应合并在同一个缓存中。TanStack Query 提供了 `setQueryData` 手动更新缓存的能力，SSE 收到数据后直接写入缓存，所有订阅了该 queryKey 的组件自动更新
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
│  (缓存 + UI)  │ ◀───── JSON ─────── │          │
└──────┬───────┘                     └────┬─────┘
       │                                  │
       │  queryClient.setQueryData()      │ SSE event push
       │ ◀─────── 实时更新缓存 ──────────   │         ② 后续增量走 SSE
       │                                  │
└──────┴──────────────────────────────────┘
```

::: warning 与 WebSocket 集成的区别

- 思路完全一致：HTTP 初始加载 + 实时推送增量更新缓存
- SSE 的优势：**自动重连 + Last-Event-ID 断点恢复**，不需要手动实现重连逻辑
- SSE 的劣势：只能服务端推送，客户端发送数据还是走 HTTP（`useMutation`）
:::

---

## 实时通知列表

HTTP 加载历史通知 + SSE 推送新通知，统一在 TanStack Query 缓存中管理

::: code-group

```tsx [使用例子]
function NotificationList() {
  const { data: notifications = [], isLoading } = useNotificationsQuery();

  // SSE 自动同步到 queryCache
  useNotificationsStream();

  if (isLoading) return <p>加载中...</p>;

  return (
    <div>
      <h3>通知 ({notifications.filter((n) => !n.read).length} 条未读)</h3>
      <ul>
        {notifications.map((n) => (
          <li key={n.id} style={{ opacity: n.read ? 0.6 : 1 }}>
            <strong>{n.title}</strong>
            <p>{n.body}</p>
            <small>{new Date(n.timestamp).toLocaleString()}</small>
          </li>
        ))}
      </ul>
    </div>
  );
}
```

```ts [实现代码]
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";

interface NotificationData {
  id: string;
  title: string;
  body: string;
  timestamp: number;
  read: boolean;
}

// ① HTTP：加载历史通知
function useNotificationsQuery() {
  return useQuery({
    queryKey: ["notifications"],
    queryFn: async () => {
      const res = await fetch("/api/notifications");
      return res.json() as Promise<NotificationData[]>;
    },
    staleTime: Infinity, // SSE 负责更新
  });
}

// ② SSE：推送新通知到缓存
function useNotificationsStream() {
  const queryClient = useQueryClient();

  useEffect(() => {
    const es = new EventSource("/api/notifications/stream");

    es.addEventListener("notification:new", (e) => {
      const notification: NotificationData = JSON.parse(e.data);

      queryClient.setQueryData<NotificationData[]>(
        ["notifications"],
        (old = []) => [notification, ...old], // 新通知插入到最前面
      );
    });

    es.addEventListener("notification:read", (e) => {
      const { id } = JSON.parse(e.data);

      queryClient.setQueryData<NotificationData[]>(
        ["notifications"],
        (old = []) => old.map((n) => (n.id === id ? { ...n, read: true } : n)),
      );
    });

    return () => es.close();
  }, [queryClient]);
}
```

:::

::: tip

- **SSE 自带重连**：不需要像 WebSocket 那样手动实现重连逻辑。断线后浏览器自动重连，且携带 `Last-Event-ID`
- **`staleTime: Infinity`**：SSE 持续推送增量数据，不需要 TanStack Query 自动 refetch
- **新通知在最前面**：`[notification, ...old]` 保证最新通知排在列表顶部
:::

---

## 标记已读（乐观更新）

客户端标记已读通过 HTTP `useMutation` 发送，服务端确认后通过 SSE 广播给其他设备

::: code-group

```tsx [使用例子]
function NotificationItem({
  notification,
}: {
  notification: NotificationData;
}) {
  const { mutate: markAsRead } = useMarkAsRead();

  return (
    <li
      onClick={() => !notification.read && markAsRead(notification.id)}
      style={{ opacity: notification.read ? 0.6 : 1, cursor: "pointer" }}
    >
      <strong>{notification.title}</strong>
      <p>{notification.body}</p>
    </li>
  );
}
```

```ts [实现代码]
import { useMutation, useQueryClient } from "@tanstack/react-query";

function useMarkAsRead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      await fetch(`/api/notifications/${id}/read`, { method: "PUT" });
    },

    // 乐观更新
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: ["notifications"] });
      const previous = queryClient.getQueryData<NotificationData[]>([
        "notifications",
      ]);

      queryClient.setQueryData<NotificationData[]>(
        ["notifications"],
        (old = []) => old.map((n) => (n.id === id ? { ...n, read: true } : n)),
      );

      return { previous };
    },

    onError: (_err, _id, context) => {
      // 失败回滚
      if (context?.previous) {
        queryClient.setQueryData(["notifications"], context.previous);
      }
    },

    // 不需要 onSettled invalidate
    // SSE 的 "notification:read" 事件会同步到其他设备/标签页
  });
}
```

:::

::: warning 乐观更新 + SSE 的协作

```txt
设备 A：点击标记已读 → onMutate 乐观更新 → PUT /api/notifications/123/read
                                                   ↓
                                            服务端标记已读
                                                   ↓
                                        SSE 广播 "notification:read"
                                                   ↓
设备 B：收到 SSE → setQueryData → UI 自动更新
设备 A：也收到 SSE → setQueryData → 覆盖乐观数据（结果相同，无感知）
```

SSE 广播确保了**多设备/多标签页的状态同步**
:::

---

## AI 流式输出 + 缓存

AI 聊天场景：流式输出过程中逐步更新缓存，完成后自动保存在 queryCache 中

::: code-group

```tsx [使用例子]
function ChatView() {
  const { data: history = [] } = useChatHistory("conversation-1");
  const { streamingText, isStreaming, sendMessage } =
    useChatStream("conversation-1");

  return (
    <div>
      {/* 历史消息 */}
      {history.map((msg) => (
        <div key={msg.id}>
          {msg.role}: {msg.content}
        </div>
      ))}

      {/* 正在流式输出的消息 */}
      {isStreaming && (
        <div>
          assistant: {streamingText}
          <span className="cursor-blink">▌</span>
        </div>
      )}

      <input
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            sendMessage(e.currentTarget.value);
            e.currentTarget.value = "";
          }
        }}
      />
    </div>
  );
}
```

```ts [实现代码]
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, useCallback, useRef } from "react";

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
}

// ① 加载历史对话
function useChatHistory(conversationId: string) {
  return useQuery({
    queryKey: ["chat", conversationId],
    queryFn: async () => {
      const res = await fetch(`/api/conversations/${conversationId}`);
      return res.json() as Promise<ChatMessage[]>;
    },
  });
}

// ② 流式发送 + 实时更新缓存
function useChatStream(conversationId: string) {
  const queryClient = useQueryClient();
  const [streamingText, setStreamingText] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const sendMessage = useCallback(
    async (content: string) => {
      const controller = new AbortController();
      abortRef.current = controller;

      // 先把用户消息加入缓存
      const userMsg: ChatMessage = {
        id: crypto.randomUUID(),
        role: "user",
        content,
      };
      queryClient.setQueryData<ChatMessage[]>(
        ["chat", conversationId],
        (old = []) => [...old, userMsg],
      );

      setIsStreaming(true);
      setStreamingText("");

      try {
        const response = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            conversationId,
            message: content,
          }),
          signal: controller.signal,
        });

        const reader = response.body!.getReader();
        const decoder = new TextDecoder();
        let fullText = "";
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const events = buffer.split("\n\n");
          buffer = events.pop()!;

          for (const event of events) {
            for (const line of event.split("\n")) {
              if (line.startsWith("data: ")) {
                const payload = line.slice(6);
                if (payload === "[DONE]") break;
                try {
                  const { token } = JSON.parse(payload);
                  fullText += token;
                  setStreamingText(fullText);
                } catch {}
              }
            }
          }
        }

        // 流式完成后，把完整回复加入缓存
        const assistantMsg: ChatMessage = {
          id: crypto.randomUUID(),
          role: "assistant",
          content: fullText,
        };
        queryClient.setQueryData<ChatMessage[]>(
          ["chat", conversationId],
          (old = []) => [...old, assistantMsg],
        );
      } catch (err) {
        if ((err as Error).name !== "AbortError") {
          console.error("Chat error:", err);
        }
      } finally {
        setIsStreaming(false);
        setStreamingText("");
      }
    },
    [conversationId, queryClient],
  );

  const abort = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  return { streamingText, isStreaming, sendMessage, abort };
}
```

:::

::: tip

- **流式过程中用 `useState`，完成后写入 `queryCache`**：流式输出是临时状态（每个 token 更新一次），不适合每次都写 queryCache。完成后一次性写入，保证缓存数据的完整性
- **用户消息先入缓存**：发送时立即把用户消息追加到 history 缓存，不等服务端响应。这是乐观更新的变体
- **刷新页面后**：`useChatHistory` 从服务端 HTTP 加载完整对话历史，流式 state 丢失但无影响（因为最终结果已在缓存中）
:::

---

## 实时数据面板 + 自动暂停

当用户切换到其他标签页时，暂停 SSE 连接节省资源；切回来时重新连接并刷新数据

::: code-group

```tsx [使用例子]
function MetricsDashboard() {
  const { data: metrics = {}, isLoading } = useMetricsQuery();
  useMetricsStream(); // 自动处理页面可见性

  if (isLoading) return <p>加载中...</p>;

  return (
    <div>
      {Object.entries(metrics).map(([key, value]) => (
        <div key={key}>
          <span>{key}</span>
          <strong>{String(value)}</strong>
        </div>
      ))}
    </div>
  );
}
```

```ts [实现代码]
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef } from "react";

function useMetricsQuery() {
  return useQuery({
    queryKey: ["metrics"],
    queryFn: async () => {
      const res = await fetch("/api/metrics");
      return res.json() as Promise<Record<string, number>>;
    },
    staleTime: Infinity,
  });
}

function useMetricsStream() {
  const queryClient = useQueryClient();
  const esRef = useRef<EventSource | null>(null);

  useEffect(() => {
    function connect() {
      const es = new EventSource("/api/metrics/stream");
      esRef.current = es;

      es.addEventListener("metrics", (e) => {
        const update = JSON.parse(e.data);
        queryClient.setQueryData<Record<string, number>>(
          ["metrics"],
          (old = {}) => ({ ...old, ...update }),
        );
      });
    }

    function disconnect() {
      esRef.current?.close();
      esRef.current = null;
    }

    // 页面可见性变化
    function handleVisibility() {
      if (document.visibilityState === "visible") {
        connect();
        // 切回来时刷新一次全量数据（弥补离开期间的缺失）
        queryClient.invalidateQueries({ queryKey: ["metrics"] });
      } else {
        disconnect();
      }
    }

    // 初始连接
    connect();

    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      disconnect();
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [queryClient]);
}
```

:::

::: warning 核心要点

- **为什么切到后台要断开**：SSE 连接占用服务端资源（内存、连接数）。用户不看页面时保持连接是浪费
- **切回来后 invalidate**：离开期间可能错过了很多事件，`invalidateQueries` 触发 HTTP refetch 获取最新全量数据，然后 SSE 继续推送增量
- **TanStack Query 自带 `refetchOnWindowFocus`**：默认就会在切回标签页时 refetch。但 SSE 连接需要手动管理生命周期，不能靠这个
:::
