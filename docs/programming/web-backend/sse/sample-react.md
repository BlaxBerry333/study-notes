# React 实现

> EventSource Hook、fetch 流式 Hook、AI 聊天流式输出、实时通知、实时日志

## useEventSource（自定义 Hook）

> 管理 EventSource 连接、事件监听、自动重连

EventSource 虽然浏览器会自动重连，但组件卸载时必须手动 `close()`，否则连接会一直存在。封装成 Hook 后组件只关心「收到了什么数据」

::: code-group

```tsx [使用例子]
function Notifications() {
  const { data, status, error } = useEventSource<{
    title: string;
    body: string;
  }>("/api/notifications");

  if (status === "connecting") return <p>连接中...</p>;
  if (error) return <p>连接错误: {error}</p>;

  return (
    <div>
      <span>{status === "open" ? "🟢" : "🔴"} 通知</span>
      {data && (
        <div>
          <strong>{data.title}</strong>
          <p>{data.body}</p>
        </div>
      )}
    </div>
  );
}
```

```ts [实现代码]
import { useState, useEffect, useRef } from "react";

type SSEStatus = "connecting" | "open" | "closed";

interface UseEventSourceOptions {
  event?: string; // 监听的事件名（默认 "message"）
  withCredentials?: boolean;
}

interface UseEventSourceReturn<T> {
  data: T | null;
  status: SSEStatus;
  error: string | null;
  close: () => void;
}

function useEventSource<T = unknown>(
  url: string | null, // 传 null 时不连接（条件连接）
  options: UseEventSourceOptions = {},
): UseEventSourceReturn<T> {
  const { event = "message", withCredentials = false } = options;
  const [data, setData] = useState<T | null>(null);
  const [status, setStatus] = useState<SSEStatus>("connecting");
  const [error, setError] = useState<string | null>(null);
  const esRef = useRef<EventSource | null>(null);

  useEffect(() => {
    if (!url) {
      setStatus("closed");
      return;
    }

    const es = new EventSource(url, { withCredentials });
    esRef.current = es;
    setStatus("connecting");
    setError(null);

    es.onopen = () => {
      setStatus("open");
      setError(null);
    };

    // 监听指定事件
    const handler = (e: MessageEvent) => {
      try {
        setData(JSON.parse(e.data));
      } catch {
        setData(e.data as unknown as T); // 非 JSON 时返回原始字符串
      }
    };

    if (event === "message") {
      es.onmessage = handler;
    } else {
      es.addEventListener(event, handler);
    }

    es.onerror = () => {
      if (es.readyState === EventSource.CLOSED) {
        setStatus("closed");
        setError("连接已关闭");
      } else {
        setStatus("connecting");
        // 浏览器正在自动重连，不算错误
      }
    };

    return () => {
      es.close();
      esRef.current = null;
    };
  }, [url, event, withCredentials]);

  const close = () => {
    esRef.current?.close();
    esRef.current = null;
    setStatus("closed");
  };

  return { data, status, error, close };
}
```

:::

::: tip

- **该用的场景**：服务端单向推送 + 不需要自定义请求头（如公开的通知流、实时数据）
- **不该用的场景**：需要认证（EventSource 不支持自定义请求头）、需要 POST（如 AI 聊天）—— 用 `useFetchSSE`
- **条件连接**：`url` 传 `null` 时不创建连接，适合"登录后才订阅"的场景
- **为什么不把所有事件都合成一个 Hook**：不同事件的数据类型不同，一个 Hook 监听一个事件，类型推导更清晰。多个事件就调多次 Hook
:::

---

## useEventSourceMulti（自定义 Hook）

> 同一连接监听多种事件类型

当服务端通过一个 SSE 连接推送多种类型的事件时，用一个 Hook 统一管理：

::: code-group

```tsx [使用例子]
function Dashboard() {
  const { events, status } = useEventSourceMulti("/api/events", [
    "user:online",
    "chat:message",
    "system:alert",
  ]);

  return (
    <div>
      <p>连接状态: {status}</p>

      {/* 最近的用户上线事件 */}
      {events["user:online"] && (
        <p>最近上线: {events["user:online"].user}</p>
      )}

      {/* 最近的聊天消息 */}
      {events["chat:message"] && (
        <p>最新消息: {events["chat:message"].text}</p>
      )}

      {/* 系统警告 */}
      {events["system:alert"] && (
        <div style={{ color: "red" }}>
          ⚠️ {events["system:alert"].msg}
        </div>
      )}
    </div>
  );
}
```

```ts [实现代码]
import { useState, useEffect, useRef } from "react";

type SSEStatus = "connecting" | "open" | "closed";

function useEventSourceMulti(
  url: string | null,
  eventNames: string[],
) {
  const [events, setEvents] = useState<Record<string, any>>({});
  const [status, setStatus] = useState<SSEStatus>("connecting");
  const esRef = useRef<EventSource | null>(null);

  useEffect(() => {
    if (!url) {
      setStatus("closed");
      return;
    }

    const es = new EventSource(url);
    esRef.current = es;

    es.onopen = () => setStatus("open");
    es.onerror = () => {
      setStatus(es.readyState === EventSource.CLOSED ? "closed" : "connecting");
    };

    // 为每个事件类型注册监听
    const handlers = eventNames.map((name) => {
      const handler = (e: MessageEvent) => {
        try {
          const data = JSON.parse(e.data);
          setEvents((prev) => ({ ...prev, [name]: data }));
        } catch {
          setEvents((prev) => ({ ...prev, [name]: e.data }));
        }
      };
      es.addEventListener(name, handler);
      return { name, handler };
    });

    return () => {
      handlers.forEach(({ name, handler }) => {
        es.removeEventListener(name, handler);
      });
      es.close();
    };
  }, [url, eventNames.join(",")]); // eventNames 序列化为依赖

  return { events, status };
}
```

:::

---

## useFetchSSE（自定义 Hook）

> 支持 POST、自定义请求头、AI 聊天流式输出

AI 对话接口需要 POST 发送消息体 + 自定义请求头认证，EventSource 做不到。用 `fetch` + `ReadableStream` 实现：

::: code-group

```tsx [使用例子]
function AIChatMessage({ prompt }: { prompt: string }) {
  const { text, isStreaming, error } = useFetchSSE("/api/chat", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ message: prompt, model: "gpt-4" }),
  });

  return (
    <div>
      <p style={{ whiteSpace: "pre-wrap" }}>{text}</p>
      {isStreaming && <span className="cursor-blink">▌</span>}
      {error && <p style={{ color: "red" }}>错误: {error}</p>}
    </div>
  );
}
```

```ts [实现代码]
import { useState, useEffect, useRef } from "react";

interface UseFetchSSEReturn {
  text: string; // 累积的完整文本
  isStreaming: boolean; // 是否正在接收数据
  error: string | null;
  abort: () => void; // 手动中断
}

function useFetchSSE(
  url: string,
  requestInit: RequestInit,
): UseFetchSSEReturn {
  const [text, setText] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    abortRef.current = controller;

    setIsStreaming(true);
    setText("");
    setError(null);

    (async () => {
      try {
        const response = await fetch(url, {
          ...requestInit,
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const reader = response.body!.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });

          // 按 SSE 协议解析
          const events = buffer.split("\n\n");
          buffer = events.pop()!; // 最后一个可能不完整

          for (const event of events) {
            for (const line of event.split("\n")) {
              if (line.startsWith("data: ")) {
                const payload = line.slice(6);
                if (payload === "[DONE]") {
                  setIsStreaming(false);
                  return;
                }
                try {
                  const { token } = JSON.parse(payload);
                  setText((prev) => prev + token);
                } catch {
                  // 非 JSON data，直接追加
                  setText((prev) => prev + payload);
                }
              }
            }
          }
        }
      } catch (err) {
        if ((err as Error).name !== "AbortError") {
          setError((err as Error).message);
        }
      } finally {
        setIsStreaming(false);
      }
    })();

    return () => {
      controller.abort();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url, requestInit.body]); // body 变化时重新请求

  const abort = () => {
    abortRef.current?.abort();
    setIsStreaming(false);
  };

  return { text, isStreaming, error, abort };
}
```

:::

::: tip

- **该用的场景**：AI 流式输出（ChatGPT 风格）、需要 POST 的 SSE、需要 Authorization 的 SSE
- **不该用的场景**：简单 GET 推送直接用 `useEventSource`，它有自动重连
- **为什么用 `AbortController`**：组件卸载或用户点击"停止生成"时，需要中断 fetch 请求。不中断的话，即使组件已卸载，回调仍在执行，可能触发 `setState` 导致内存泄漏
- **缓冲区为什么重要**：网络传输是分 chunk 的，一个事件可能被拆到两个 chunk 中。`buffer` 保留未完成的部分，等下一个 chunk 来了再拼接解析
:::

---

## AI 聊天完整示例

> 综合示例 — 消息列表、流式输出、停止生成、历史对话

::: code-group

```tsx [ChatPage.tsx]
import { useState, useRef, useEffect } from "react";
import { useFetchSSE } from "./useFetchSSE"; // 自定义 Hook，见本页上方

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
}

function ChatPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [currentPrompt, setCurrentPrompt] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // 流式接收 AI 回复
  const { text: streamingText, isStreaming, abort } = useFetchSSE(
    currentPrompt ? "/api/chat" : "",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: currentPrompt
        ? JSON.stringify({
            messages: [...messages, { role: "user", content: currentPrompt }],
          })
        : undefined,
    },
  );

  // 流式输出完成后，追加到消息列表
  useEffect(() => {
    if (!isStreaming && streamingText && currentPrompt) {
      setMessages((prev) => [
        ...prev,
        { id: crypto.randomUUID(), role: "user", content: currentPrompt },
        { id: crypto.randomUUID(), role: "assistant", content: streamingText },
      ]);
      setCurrentPrompt(null);
    }
  }, [isStreaming, streamingText, currentPrompt]);

  // 自动滚动
  useEffect(() => {
    listRef.current?.scrollTo(0, listRef.current.scrollHeight);
  }, [messages, streamingText]);

  const handleSend = () => {
    if (!input.trim() || isStreaming) return;
    setCurrentPrompt(input.trim());
    setInput("");
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh" }}>
      {/* 消息列表 */}
      <div ref={listRef} style={{ flex: 1, overflow: "auto", padding: 16 }}>
        {messages.map((msg) => (
          <div key={msg.id} style={{ textAlign: msg.role === "user" ? "right" : "left" }}>
            <div
              style={{
                display: "inline-block",
                padding: "8px 12px",
                borderRadius: 8,
                background: msg.role === "user" ? "#007AFF" : "#E5E5EA",
                color: msg.role === "user" ? "white" : "black",
                maxWidth: "70%",
                whiteSpace: "pre-wrap",
              }}
            >
              {msg.content}
            </div>
          </div>
        ))}

        {/* 正在生成的消息 */}
        {isStreaming && (
          <div style={{ textAlign: "left" }}>
            <div
              style={{
                display: "inline-block",
                padding: "8px 12px",
                borderRadius: 8,
                background: "#E5E5EA",
                maxWidth: "70%",
                whiteSpace: "pre-wrap",
              }}
            >
              {streamingText}
              <span className="cursor-blink">▌</span>
            </div>
          </div>
        )}
      </div>

      {/* 输入区域 */}
      <div style={{ padding: 16, display: "flex", gap: 8 }}>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleSend()}
          placeholder="输入消息..."
          disabled={isStreaming}
          style={{ flex: 1 }}
        />
        {isStreaming ? (
          <button onClick={abort}>停止生成</button>
        ) : (
          <button onClick={handleSend} disabled={!input.trim()}>
            发送
          </button>
        )}
      </div>
    </div>
  );
}
```

```ts [服务端 server.ts]
import express from "express";

const app = express();
app.use(express.json());

app.post("/api/chat", async (req, res) => {
  const { messages } = req.body;
  const lastMessage = messages[messages.length - 1].content;

  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
  });

  // 模拟 AI 逐字生成
  const reply = `你好！关于「${lastMessage}」，这是一个很好的问题。让我来为你详细解答...`;

  for (const char of reply) {
    // 检查客户端是否已断开（用户点了"停止生成"）
    if (res.destroyed) return;

    res.write(`data: ${JSON.stringify({ token: char })}\n\n`);
    await new Promise((r) => setTimeout(r, 30));
  }

  res.write("data: [DONE]\n\n");
  res.end();
});

app.listen(3000);
```

:::

::: warning "停止生成"的实现原理

1. 客户端调用 `AbortController.abort()` → 浏览器中断 fetch 请求 → 服务端 `req` 触发 `close` 事件
2. 服务端在循环中检查 `res.destroyed`，发现客户端已断开后停止生成，释放资源
3. 客户端的 `catch` 中判断 `AbortError`，这不是真正的错误，只需停止流式动画即可
:::

---

## 实时通知系统

> EventSource + 通知列表 + 未读计数 + 声音提醒

::: code-group

```tsx [使用例子]
function NotificationBell() {
  const { notifications, unreadCount, markAsRead, markAllAsRead } =
    useNotifications("/api/notifications/stream");

  const [isOpen, setIsOpen] = useState(false);

  return (
    <div style={{ position: "relative" }}>
      <button onClick={() => setIsOpen(!isOpen)}>
        🔔
        {unreadCount > 0 && (
          <span style={{
            position: "absolute", top: -4, right: -4,
            background: "red", color: "white", borderRadius: "50%",
            width: 18, height: 18, fontSize: 12,
          }}>
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div style={{
          position: "absolute", right: 0, top: 36,
          width: 320, maxHeight: 400, overflow: "auto",
          border: "1px solid #eee", borderRadius: 8,
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", padding: 8 }}>
            <strong>通知</strong>
            <button onClick={markAllAsRead}>全部已读</button>
          </div>
          {notifications.map((n) => (
            <div
              key={n.id}
              onClick={() => markAsRead(n.id)}
              style={{
                padding: 12,
                background: n.read ? "white" : "#f0f7ff",
                cursor: "pointer",
              }}
            >
              <strong>{n.title}</strong>
              <p>{n.body}</p>
              <small>{new Date(n.timestamp).toLocaleString()}</small>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
```

```ts [实现代码]
import { useState, useEffect, useRef, useCallback } from "react";

interface NotificationItem {
  id: string;
  title: string;
  body: string;
  timestamp: number;
  read: boolean;
}

function useNotifications(url: string) {
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const audioRef = useRef<HTMLAudioElement>();

  // 懒加载音频
  useEffect(() => {
    audioRef.current = new Audio("/notification.mp3");
  }, []);

  // SSE 连接
  useEffect(() => {
    const es = new EventSource(url);

    es.addEventListener("notification", (e) => {
      const data = JSON.parse(e.data);
      const notification: NotificationItem = {
        ...data,
        read: false,
      };

      setNotifications((prev) => [notification, ...prev]); // 新通知在最前面

      // 声音提醒（仅在用户之前交互过时才能播放）
      audioRef.current?.play().catch(() => {});

      // 浏览器通知（需要用户授权）
      if (Notification.permission === "granted") {
        new Notification(data.title, { body: data.body });
      }
    });

    return () => es.close();
  }, [url]);

  const unreadCount = notifications.filter((n) => !n.read).length;

  const markAsRead = useCallback((id: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n)),
    );
  }, []);

  const markAllAsRead = useCallback(() => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  }, []);

  return { notifications, unreadCount, markAsRead, markAllAsRead };
}
```

:::

::: tip

- **浏览器 Notification API**：需要先调用 `Notification.requestPermission()` 获取用户授权
- **音频自动播放限制**：现代浏览器要求用户先进行交互（点击、键盘等）后才能播放音频，`play().catch()` 是为了静默处理这个限制
- **通知列表顺序**：新通知用 `[notification, ...prev]` 插入到数组头部，展示时最新的在最上面
:::

---

## 实时日志查看器

> 构建日志、服务器日志的实时输出 — 类似终端效果

::: code-group

```tsx [使用例子]
function LogViewer({ buildId }: { buildId: string }) {
  const { logs, status } = useLogStream(`/api/builds/${buildId}/logs`);

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between" }}>
        <h3>构建日志</h3>
        <span>
          {status === "open" && "🟢 实时"}
          {status === "connecting" && "🟡 连接中"}
          {status === "closed" && "⚪ 已结束"}
        </span>
      </div>
      <pre
        style={{
          background: "#1e1e1e",
          color: "#d4d4d4",
          padding: 16,
          borderRadius: 8,
          height: 500,
          overflow: "auto",
          fontFamily: "monospace",
          fontSize: 13,
          lineHeight: 1.5,
        }}
      >
        {logs.map((log, i) => (
          <div
            key={i}
            style={{
              color:
                log.level === "error"
                  ? "#f44747"
                  : log.level === "warn"
                    ? "#cca700"
                    : "#d4d4d4",
            }}
          >
            <span style={{ color: "#666" }}>{log.time}</span>{" "}
            <span>[{log.level.toUpperCase()}]</span> {log.message}
          </div>
        ))}
        {status === "open" && <span className="cursor-blink">█</span>}
      </pre>
    </div>
  );
}
```

```ts [实现代码]
import { useState, useEffect, useRef } from "react";

interface LogEntry {
  time: string;
  level: "info" | "warn" | "error";
  message: string;
}

type SSEStatus = "connecting" | "open" | "closed";

function useLogStream(url: string) {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [status, setStatus] = useState<SSEStatus>("connecting");
  const containerRef = useRef<HTMLPreElement>(null);

  useEffect(() => {
    const es = new EventSource(url);

    es.onopen = () => setStatus("open");

    es.addEventListener("log", (e) => {
      const entry: LogEntry = JSON.parse(e.data);
      setLogs((prev) => [...prev, entry]);
    });

    // 构建结束事件
    es.addEventListener("done", () => {
      es.close();
      setStatus("closed");
    });

    es.onerror = () => {
      if (es.readyState === EventSource.CLOSED) {
        setStatus("closed");
      }
    };

    return () => es.close();
  }, [url]);

  // 自动滚动到底部
  useEffect(() => {
    const el = containerRef.current;
    if (el) {
      el.scrollTop = el.scrollHeight;
    }
  }, [logs]);

  return { logs, status, containerRef };
}
```

:::

::: tip

- **有限事件流**：构建日志有结束时间（构建完成），服务端通过 `event: done` 通知客户端关闭连接
- **自动滚动**：`logs` 变化时自动滚动到底部，模拟终端实时输出效果
- **颜色编码**：根据日志级别（info/warn/error）显示不同颜色，提高可读性
:::

---

## 进度条

> 长时间任务（上传、导出、转码）的实时进度反馈

::: code-group

```tsx [使用例子]
function ExportProgress({ taskId }: { taskId: string }) {
  const { progress, status, message } = useProgress(`/api/tasks/${taskId}/progress`);

  return (
    <div>
      <div style={{
        width: "100%",
        height: 8,
        background: "#e0e0e0",
        borderRadius: 4,
        overflow: "hidden",
      }}>
        <div
          style={{
            width: `${progress}%`,
            height: "100%",
            background: status === "error" ? "#f44" : "#4caf50",
            transition: "width 0.3s ease",
          }}
        />
      </div>
      <p>
        {status === "processing" && `${message} (${progress}%)`}
        {status === "done" && "✅ 导出完成"}
        {status === "error" && `❌ ${message}`}
      </p>
    </div>
  );
}
```

```ts [实现代码]
import { useState, useEffect } from "react";

interface UseProgressReturn {
  progress: number; // 0-100
  status: "connecting" | "processing" | "done" | "error";
  message: string;
}

function useProgress(url: string): UseProgressReturn {
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState<UseProgressReturn["status"]>("connecting");
  const [message, setMessage] = useState("");

  useEffect(() => {
    const es = new EventSource(url);

    es.onopen = () => setStatus("processing");

    es.addEventListener("progress", (e) => {
      const data = JSON.parse(e.data);
      setProgress(data.percent);
      setMessage(data.message || "");
    });

    es.addEventListener("done", (e) => {
      const data = JSON.parse(e.data);
      setProgress(100);
      setStatus("done");
      setMessage(data.message || "完成");
      es.close();
    });

    es.addEventListener("error", (e) => {
      // 自定义 error 事件（业务错误），不是 EventSource 的 onerror
      const data = JSON.parse((e as MessageEvent).data);
      setStatus("error");
      setMessage(data.message || "未知错误");
      es.close();
    });

    es.onerror = () => {
      if (es.readyState === EventSource.CLOSED) {
        setStatus("error");
        setMessage("连接断开");
      }
    };

    return () => es.close();
  }, [url]);

  return { progress, status, message };
}
```

:::

::: tip

- **`transition: width 0.3s`**：进度条宽度变化加过渡动画，避免频繁更新时视觉上的跳动
- **区分 SSE 的 `onerror` 和自定义 `error` 事件**：`onerror` 是连接级错误（网络断开），`event: error` 是业务级错误（任务失败）。两者的处理逻辑不同
- **关闭时机**：`done` 和 `error` 事件都应调用 `es.close()`，因为任务已结束，不需要重连
:::
