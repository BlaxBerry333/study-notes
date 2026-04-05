# React 実装

> EventSource Hook、fetch ストリーミング Hook、AI チャットストリーミング出力、リアルタイム通知、リアルタイムログ

## useEventSource（カスタム Hook）

> EventSource 接続管理、イベント監視、自動再接続

EventSource はブラウザが自動再接続するが、コンポーネントのアンマウント時に手動で `close()` しなければ接続が残り続ける。Hook にカプセル化することで、コンポーネントは「どんなデータを受信したか」だけに関心を持てばよい

::: code-group

```tsx [使用例]
function Notifications() {
  const { data, status, error } = useEventSource<{
    title: string;
    body: string;
  }>("/api/notifications");

  if (status === "connecting") return <p>接続中...</p>;
  if (error) return <p>接続エラー: {error}</p>;

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

```ts [実装コード]
import { useState, useEffect, useRef } from "react";

type SSEStatus = "connecting" | "open" | "closed";

interface UseEventSourceOptions {
  event?: string; // 監視するイベント名（デフォルト "message"）
  withCredentials?: boolean;
}

interface UseEventSourceReturn<T> {
  data: T | null;
  status: SSEStatus;
  error: string | null;
  close: () => void;
}

function useEventSource<T = unknown>(
  url: string | null, // null を渡すと接続しない（条件付き接続）
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

    // 指定イベントを監視
    const handler = (e: MessageEvent) => {
      try {
        setData(JSON.parse(e.data));
      } catch {
        setData(e.data as unknown as T); // 非 JSON の場合は生の文字列を返す
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
        setError("接続がクローズされた");
      } else {
        setStatus("connecting");
        // ブラウザが自動再接続中、エラーではない
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

- **使うべきシーン**：サーバーからの一方向プッシュ + カスタムリクエストヘッダーが不要（公開通知ストリーム、リアルタイムデータなど）
- **使うべきでないシーン**：認証が必要（EventSource はカスタムリクエストヘッダーをサポートしない）、POST が必要（AI チャットなど）―― `useFetchSSE` を使用
- **条件付き接続**：`url` に `null` を渡すと接続を作成しない。「ログイン後にサブスクライブ」のようなシーンに適している
- **なぜ全イベントを 1 つの Hook にまとめないか**：異なるイベントはデータ型が異なるため、1 つの Hook で 1 つのイベントを監視する方が型推論が明確になる。複数イベントは Hook を複数回呼べばよい
:::

---

## useEventSourceMulti（カスタム Hook）

> 同一接続で複数のイベントタイプを監視

サーバーが 1 つの SSE 接続で複数タイプのイベントをプッシュする場合、1 つの Hook で統一管理する：

::: code-group

```tsx [使用例]
function Dashboard() {
  const { events, status } = useEventSourceMulti("/api/events", [
    "user:online",
    "chat:message",
    "system:alert",
  ]);

  return (
    <div>
      <p>接続状態: {status}</p>

      {/* 最新のユーザーオンラインイベント */}
      {events["user:online"] && (
        <p>最近のオンライン: {events["user:online"].user}</p>
      )}

      {/* 最新のチャットメッセージ */}
      {events["chat:message"] && (
        <p>最新メッセージ: {events["chat:message"].text}</p>
      )}

      {/* システム警告 */}
      {events["system:alert"] && (
        <div style={{ color: "red" }}>
          ⚠️ {events["system:alert"].msg}
        </div>
      )}
    </div>
  );
}
```

```ts [実装コード]
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

    // 各イベントタイプにリスナーを登録
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
  }, [url, eventNames.join(",")]); // eventNames をシリアライズして依存に

  return { events, status };
}
```

:::

---

## useFetchSSE（カスタム Hook）

> POST、カスタムリクエストヘッダー、AI チャットストリーミング出力に対応

AI 対話インターフェースでは POST でメッセージボディの送信 + カスタムリクエストヘッダーでの認証が必要であり、EventSource では実現できない。`fetch` + `ReadableStream` で実装する：

::: code-group

```tsx [使用例]
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
      {error && <p style={{ color: "red" }}>エラー: {error}</p>}
    </div>
  );
}
```

```ts [実装コード]
import { useState, useEffect, useRef } from "react";

interface UseFetchSSEReturn {
  text: string; // 累積された完全なテキスト
  isStreaming: boolean; // データ受信中かどうか
  error: string | null;
  abort: () => void; // 手動で中断
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

          // SSE プロトコルに従って解析
          const events = buffer.split("\n\n");
          buffer = events.pop()!; // 最後の要素は不完全な可能性あり

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
                  // 非 JSON data の場合、そのまま追加
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
  }, [url, requestInit.body]); // body が変化した時に再リクエスト

  const abort = () => {
    abortRef.current?.abort();
    setIsStreaming(false);
  };

  return { text, isStreaming, error, abort };
}
```

:::

::: tip

- **使うべきシーン**：AI ストリーミング出力（ChatGPT スタイル）、POST が必要な SSE、Authorization が必要な SSE
- **使うべきでないシーン**：単純な GET プッシュは `useEventSource` を直接使用（自動再接続がある）
- **なぜ `AbortController` を使うか**：コンポーネントのアンマウント時やユーザーが「生成を停止」をクリックした時に fetch リクエストを中断する必要がある。中断しなければ、コンポーネントがアンマウント済みでもコールバックが実行され続け、`setState` がメモリリークを引き起こす可能性がある
- **なぜバッファが重要か**：ネットワーク転送は chunk 単位であり、1 つのイベントが 2 つの chunk にまたがる可能性がある。`buffer` で未完成の部分を保持し、次の chunk が来たら結合して解析する
:::

---

## AI チャット完全な例

> 総合的な例 ―― メッセージリスト、ストリーミング出力、生成停止、会話履歴

::: code-group

```tsx [ChatPage.tsx]
import { useState, useRef, useEffect } from "react";
import { useFetchSSE } from "./useFetchSSE"; // カスタム Hook、本ページ上部を参照

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

  // AI の返信をストリーミング受信
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

  // ストリーミング出力完了後、メッセージリストに追加
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

  // 自動スクロール
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
      {/* メッセージリスト */}
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

        {/* 生成中のメッセージ */}
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

      {/* 入力エリア */}
      <div style={{ padding: 16, display: "flex", gap: 8 }}>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleSend()}
          placeholder="メッセージを入力..."
          disabled={isStreaming}
          style={{ flex: 1 }}
        />
        {isStreaming ? (
          <button onClick={abort}>生成を停止</button>
        ) : (
          <button onClick={handleSend} disabled={!input.trim()}>
            送信
          </button>
        )}
      </div>
    </div>
  );
}
```

```ts [サーバー server.ts]
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

  // AI が 1 文字ずつ生成するシミュレーション
  const reply = `こんにちは！「${lastMessage}」について、とても良い質問ですね。詳しく解説しましょう...`;

  for (const char of reply) {
    // クライアントが切断済みかチェック（ユーザーが「生成を停止」をクリック）
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

::: warning 「生成を停止」の実装原理

1. クライアントが `AbortController.abort()` を呼び出す → ブラウザが fetch リクエストを中断 → サーバー側の `req` が `close` イベントを発火
2. サーバーがループ内で `res.destroyed` をチェックし、クライアントが切断済みと分かったら生成を停止しリソースを解放
3. クライアントの `catch` 内で `AbortError` を判定する。これは真のエラーではなく、ストリーミングアニメーションを停止するだけでよい
:::

---

## リアルタイム通知システム

> EventSource + 通知リスト + 未読カウント + サウンドアラート

::: code-group

```tsx [使用例]
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
            <button onClick={markAllAsRead}>すべて既読</button>
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

```ts [実装コード]
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

  // オーディオの遅延ロード
  useEffect(() => {
    audioRef.current = new Audio("/notification.mp3");
  }, []);

  // SSE 接続
  useEffect(() => {
    const es = new EventSource(url);

    es.addEventListener("notification", (e) => {
      const data = JSON.parse(e.data);
      const notification: NotificationItem = {
        ...data,
        read: false,
      };

      setNotifications((prev) => [notification, ...prev]); // 新しい通知を先頭に

      // サウンドアラート（ユーザーが以前にインタラクションした場合のみ再生可能）
      audioRef.current?.play().catch(() => {});

      // ブラウザ通知（ユーザーの許可が必要）
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

- **ブラウザ Notification API**：先に `Notification.requestPermission()` を呼び出してユーザーの許可を得る必要がある
- **オーディオ自動再生の制限**：モダンブラウザではユーザーのインタラクション（クリック、キーボードなど）が先に必要。`play().catch()` はこの制限を静かにハンドリングするため
- **通知リストの順序**：新しい通知は `[notification, ...prev]` で配列の先頭に挿入し、表示時に最新のものが一番上になる
:::

---

## リアルタイムログビューワー

> ビルドログ、サーバーログのリアルタイム出力 ―― ターミナルのような表示

::: code-group

```tsx [使用例]
function LogViewer({ buildId }: { buildId: string }) {
  const { logs, status } = useLogStream(`/api/builds/${buildId}/logs`);

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between" }}>
        <h3>ビルドログ</h3>
        <span>
          {status === "open" && "🟢 リアルタイム"}
          {status === "connecting" && "🟡 接続中"}
          {status === "closed" && "⚪ 終了"}
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

```ts [実装コード]
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

    // ビルド完了イベント
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

  // 自動スクロール
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

- **有限イベントストリーム**：ビルドログには終了時間がある（ビルド完了）。サーバーが `event: done` でクライアントに接続クローズを通知する
- **自動スクロール**：`logs` が変化した時に自動的に最下部にスクロールし、ターミナルのリアルタイム出力を模倣する
- **カラーコーディング**：ログレベル（info/warn/error）に応じて異なる色を表示し、可読性を向上させる
:::

---

## プログレスバー

> 長時間タスク（アップロード、エクスポート、トランスコード）のリアルタイム進捗フィードバック

::: code-group

```tsx [使用例]
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
        {status === "done" && "✅ エクスポート完了"}
        {status === "error" && `❌ ${message}`}
      </p>
    </div>
  );
}
```

```ts [実装コード]
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
      setMessage(data.message || "完了");
      es.close();
    });

    es.addEventListener("error", (e) => {
      // カスタム error イベント（業務エラー）、EventSource の onerror ではない
      const data = JSON.parse((e as MessageEvent).data);
      setStatus("error");
      setMessage(data.message || "不明なエラー");
      es.close();
    });

    es.onerror = () => {
      if (es.readyState === EventSource.CLOSED) {
        setStatus("error");
        setMessage("接続が切断された");
      }
    };

    return () => es.close();
  }, [url]);

  return { progress, status, message };
}
```

:::

::: tip

- **`transition: width 0.3s`**：プログレスバーの幅の変化にトランジションアニメーションを追加し、頻繁な更新時の視覚的なジャンプを防ぐ
- **SSE の `onerror` とカスタム `error` イベントの区別**：`onerror` は接続レベルのエラー（ネットワーク切断）、`event: error` は業務レベルのエラー（タスク失敗）。両者のハンドリングロジックは異なる
- **クローズのタイミング**：`done` と `error` イベントの両方で `es.close()` を呼ぶべきである。タスクが終了しているため再接続は不要
:::
