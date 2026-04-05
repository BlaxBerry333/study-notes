# TanStack Query 統合

::: tip なぜ統合するのか
SSE でプッシュされるデータと HTTP リクエストのデータは、同一リソースの異なる取得方法であることが多い（例：`GET /api/notifications` で初回全量ロード、`SSE /api/notifications/stream` で以降の差分プッシュ）。両者は同じキャッシュに統合すべきである。TanStack Query は `setQueryData` でキャッシュを手動更新する機能を提供しており、SSE でデータを受信したら直接キャッシュに書き込むことで、同じ queryKey をサブスクライブしている全コンポーネントが自動更新される
:::

## インストール

```zsh
% npm install @tanstack/react-query
```

---

## 核心的な考え方

```txt
┌──────────────┐     HTTP GET        ┌──────────┐
│  useQuery()  │ ──────────────────▶ │  Server  │   ① 初回ロードは HTTP
│  (キャッシュ + UI)  │ ◀───── JSON ─────── │          │
└──────┬───────┘                     └────┬─────┘
       │                                  │
       │  queryClient.setQueryData()      │ SSE event push
       │ ◀─────── リアルタイムキャッシュ更新 ─  │         ② 以降の差分は SSE
       │                                  │
└──────┴──────────────────────────────────┘
```

::: warning WebSocket 統合との違い

- 考え方は完全に同じ：HTTP で初回ロード + リアルタイムプッシュで差分のキャッシュ更新
- SSE の優位性：**自動再接続 + Last-Event-ID による断点復旧**があり、再接続ロジックを手動で実装する必要がない
- SSE の劣位性：サーバーからのプッシュのみで、クライアントのデータ送信は依然として HTTP（`useMutation`）で行う
:::

---

## リアルタイム通知リスト

HTTP で過去の通知をロード + SSE で新しい通知をプッシュし、TanStack Query キャッシュで統一管理する

::: code-group

```tsx [使用例]
function NotificationList() {
  const { data: notifications = [], isLoading } = useNotificationsQuery();

  // SSE が自動的に queryCache に同期
  useNotificationsStream();

  if (isLoading) return <p>読み込み中...</p>;

  return (
    <div>
      <h3>通知 ({notifications.filter((n) => !n.read).length} 件未読)</h3>
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

```ts [実装コード]
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";

interface NotificationData {
  id: string;
  title: string;
  body: string;
  timestamp: number;
  read: boolean;
}

// ① HTTP：過去の通知をロード
function useNotificationsQuery() {
  return useQuery({
    queryKey: ["notifications"],
    queryFn: async () => {
      const res = await fetch("/api/notifications");
      return res.json() as Promise<NotificationData[]>;
    },
    staleTime: Infinity, // SSE が更新を担当
  });
}

// ② SSE：新しい通知をキャッシュにプッシュ
function useNotificationsStream() {
  const queryClient = useQueryClient();

  useEffect(() => {
    const es = new EventSource("/api/notifications/stream");

    es.addEventListener("notification:new", (e) => {
      const notification: NotificationData = JSON.parse(e.data);

      queryClient.setQueryData<NotificationData[]>(
        ["notifications"],
        (old = []) => [notification, ...old], // 新しい通知を先頭に挿入
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

- **SSE は自動再接続を内蔵**：WebSocket のように再接続ロジックを手動で実装する必要がない。断線後にブラウザが自動再接続し、`Last-Event-ID` を送信する
- **`staleTime: Infinity`**：SSE が継続的に差分データをプッシュするため、TanStack Query の自動 refetch は不要
- **新しい通知を先頭に**：`[notification, ...old]` で最新の通知がリストのトップに表示される
:::

---

## 既読マーク（楽観的更新）

クライアントの既読マークは HTTP `useMutation` で送信し、サーバー確認後に SSE で他のデバイスにブロードキャストする

::: code-group

```tsx [使用例]
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

```ts [実装コード]
import { useMutation, useQueryClient } from "@tanstack/react-query";

function useMarkAsRead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      await fetch(`/api/notifications/${id}/read`, { method: "PUT" });
    },

    // 楽観的更新
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
      // 失敗時にロールバック
      if (context?.previous) {
        queryClient.setQueryData(["notifications"], context.previous);
      }
    },

    // onSettled の invalidate は不要
    // SSE の "notification:read" イベントが他のデバイス/タブに同期する
  });
}
```

:::

::: warning 楽観的更新 + SSE の連携

```txt
デバイス A：既読マークをクリック → onMutate で楽観的更新 → PUT /api/notifications/123/read
                                                   ↓
                                            サーバーが既読にマーク
                                                   ↓
                                        SSE が "notification:read" をブロードキャスト
                                                   ↓
デバイス B：SSE を受信 → setQueryData → UI が自動更新
デバイス A：同じく SSE を受信 → setQueryData → 楽観的データを上書き（結果は同じ、体感に影響なし）
```

SSE ブロードキャストにより**マルチデバイス/マルチタブの状態同期**が確保される
:::

---

## AI ストリーミング出力 + キャッシュ

AI チャットシーン：ストリーミング出力の過程でキャッシュを段階的に更新し、完了後に queryCache に自動保存される

::: code-group

```tsx [使用例]
function ChatView() {
  const { data: history = [] } = useChatHistory("conversation-1");
  const { streamingText, isStreaming, sendMessage } =
    useChatStream("conversation-1");

  return (
    <div>
      {/* 履歴メッセージ */}
      {history.map((msg) => (
        <div key={msg.id}>
          {msg.role}: {msg.content}
        </div>
      ))}

      {/* ストリーミング出力中のメッセージ */}
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

```ts [実装コード]
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, useCallback, useRef } from "react";

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
}

// ① 会話履歴のロード
function useChatHistory(conversationId: string) {
  return useQuery({
    queryKey: ["chat", conversationId],
    queryFn: async () => {
      const res = await fetch(`/api/conversations/${conversationId}`);
      return res.json() as Promise<ChatMessage[]>;
    },
  });
}

// ② ストリーミング送信 + リアルタイムキャッシュ更新
function useChatStream(conversationId: string) {
  const queryClient = useQueryClient();
  const [streamingText, setStreamingText] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const sendMessage = useCallback(
    async (content: string) => {
      const controller = new AbortController();
      abortRef.current = controller;

      // 先にユーザーメッセージをキャッシュに追加
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

        // ストリーミング完了後、完全な返信をキャッシュに追加
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

- **ストリーミング中は `useState`、完了後に `queryCache` に書き込む**：ストリーミング出力は一時的な状態（token ごとに更新される）であり、毎回 queryCache に書くのは不適切。完了後に一度だけ書き込むことでキャッシュデータの完全性を保証する
- **ユーザーメッセージを先にキャッシュに入れる**：送信時にユーザーメッセージを即座に history キャッシュに追加し、サーバーレスポンスを待たない。楽観的更新の変形
- **ページリロード後**：`useChatHistory` がサーバーの HTTP から完全な会話履歴をロードする。ストリーミング state は失われるが影響なし（最終結果は既にキャッシュにあるため）
:::

---

## リアルタイムデータパネル + 自動一時停止

ユーザーが他のタブに切り替えた時に SSE 接続を一時停止してリソースを節約し、戻った時に再接続してデータをリフレッシュする

::: code-group

```tsx [使用例]
function MetricsDashboard() {
  const { data: metrics = {}, isLoading } = useMetricsQuery();
  useMetricsStream(); // ページの可視性を自動ハンドリング

  if (isLoading) return <p>読み込み中...</p>;

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

```ts [実装コード]
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

    // ページの可視性変化
    function handleVisibility() {
      if (document.visibilityState === "visible") {
        connect();
        // 戻った時に全量データを 1 回リフレッシュ（離脱中の欠落を補填）
        queryClient.invalidateQueries({ queryKey: ["metrics"] });
      } else {
        disconnect();
      }
    }

    // 初期接続
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

::: warning 核心ポイント

- **なぜバックグラウンドで切断するか**：SSE 接続はサーバーリソース（メモリ、接続数）を占有する。ユーザーがページを見ていない時に接続を維持するのは無駄である
- **戻った時に invalidate する理由**：離脱中に多くのイベントを逃している可能性がある。`invalidateQueries` で HTTP refetch をトリガして最新の全量データを取得し、その後 SSE が差分プッシュを継続する
- **TanStack Query の組み込み `refetchOnWindowFocus`**：デフォルトでタブに戻った時に refetch する。ただし SSE 接続のライフサイクルは手動管理が必要であり、これに頼ることはできない
:::
