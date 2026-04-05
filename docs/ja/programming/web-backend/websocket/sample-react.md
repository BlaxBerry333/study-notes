# React 実装

> ネイティブ WebSocket Hook、Socket.IO Hook、リアルタイムチャットルーム、オンラインステータス、協同編集カーソル

## useWebSocket（カスタム Hook）

> 接続ライフサイクル管理、自動再接続、ハートビート検出

WebSocket 接続は**副作用を持つ長寿命リソース**であり、コンポーネントのアンマウント時に正しくクローズしないとメモリリークや予期しない state 更新を引き起こす。Hook にカプセル化することで宣言的になり、コンポーネントは「送信」と「受信したメッセージ」だけに関心を持てばよい

::: code-group

```tsx [使用例]
function ChatRoom({ roomId }: { roomId: string }) {
  const { sendMessage, lastMessage, readyState } = useWebSocket(
    `ws://localhost:3000/chat?room=${roomId}`,
  );

  const [messages, setMessages] = useState<string[]>([]);
  const [input, setInput] = useState("");

  // 新しいメッセージを受信したらリストに追加
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
      <div>状態: {readyState === WebSocket.OPEN ? "接続済み" : "接続中..."}</div>
      <ul>
        {messages.map((msg, i) => (
          <li key={i}>{msg}</li>
        ))}
      </ul>
      <input value={input} onChange={(e) => setInput(e.target.value)} />
      <button onClick={handleSend} disabled={readyState !== WebSocket.OPEN}>
        送信
      </button>
    </div>
  );
}
```

```ts [実装コード]
import { useState, useEffect, useRef, useCallback } from "react";

// WebSocket はブラウザのネイティブグローバルオブジェクトであり、import 不要
// WebSocket.CONNECTING(0) / WebSocket.OPEN(1) / WebSocket.CLOSING(2) / WebSocket.CLOSED(3)

interface UseWebSocketOptions {
  reconnect?: boolean; // 自動再接続するか（デフォルト true）
  maxRetries?: number; // 最大リトライ回数（デフォルト 5）
  heartbeatInterval?: number; // ハートビート間隔 ms（デフォルト 30000、0 = ハートビートなし）
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
  const manualCloseRef = useRef(false); // 手動クローズと異常切断を区別

  const connect = useCallback(() => {
    const ws = new WebSocket(url);
    wsRef.current = ws;

    ws.onopen = (event) => {
      setReadyState(WebSocket.OPEN);
      retriesRef.current = 0;
      onOpen?.(event);

      // アプリケーション層ハートビートを開始（ブラウザはプロトコル層 Ping フレームを送信できないため、自前で実装）
      // サーバー側で __ping__ を処理し __pong__ を返す必要がある
      if (heartbeatInterval > 0) {
        heartbeatRef.current = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: "__ping__" }));
          }
        }, heartbeatInterval);
      }
    };

    ws.onmessage = (event) => {
      // ハートビートレスポンスをフィルタリング
      if (event.data === '{"type":"__pong__"}') return;
      setLastMessage(event.data);
    };

    ws.onclose = (event) => {
      setReadyState(WebSocket.CLOSED);
      clearInterval(heartbeatRef.current);
      onClose?.(event);

      // 手動クローズでない + 再接続許可 + 最大リトライ回数未超過
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

- **使うべきシーン**：WebSocket 接続が必要なあらゆる React コンポーネント（チャット、リアルタイムデータ、通知）
- **使うべきでないシーン**：サーバーからの一方向プッシュのみ（SSE を使用）、または一度限りのデータ取得（HTTP を使用）
- **なぜ `useState` ではなく `useRef` で ws インスタンスを保持するか**：WebSocket インスタンスは**ミュータブルな外部リソース**であり、React の state ではない。`useState` を使うと再接続のたびに不要な再レンダリングが発生し、`setState` は非同期であるためイベントコールバック内で古い値を参照する可能性がある
- **なぜ `manualCloseRef` を使うか**：コンポーネントアンマウント時の能動的クローズとネットワーク異常による受動的切断を区別するため。前者は再接続すべきでない
:::

---

## useSocketIO（カスタム Hook）

> Socket.IO イベントサブスクリプション、ルーム、型安全

Socket.IO の `socket` インスタンスはグローバルに共有する必要がある（複数のコンポーネントが異なるイベントを監視するが、同一接続を共有）。Context + Hook で実現する：

::: code-group

```tsx [使用例]
// 1. App で Socket Context を提供
function App() {
  return (
    <SocketProvider url="http://localhost:3000">
      <ChatRoom />
      <OnlineUsers />
    </SocketProvider>
  );
}

// 2. コンポーネント内で使用
function ChatRoom() {
  const { socket, connected } = useSocket();
  const [messages, setMessages] = useState<Message[]>([]);

  // イベントを監視（アンマウント時に自動でサブスクリプション解除）
  useSocketEvent("chat:message", (msg: Message) => {
    setMessages((prev) => [...prev, msg]);
  });

  const sendMessage = (text: string) => {
    socket?.emit("chat:message", { text, user: "Alice" });
  };

  return (
    <div>
      <p>{connected ? "接続済み" : "接続中..."}</p>
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
      <h3>オンライン ({users.length})</h3>
      {users.map((u) => <span key={u}>{u}</span>)}
    </aside>
  );
}
```

```tsx [実装コード]
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
  handlerRef.current = handler; // 常に最新の handler を使用し、クロージャの陳腐化を回避

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

- **使うべきシーン**：ルーム、名前空間、イベント機構が必要な複雑なリアルタイムアプリケーション
- **使うべきでないシーン**：単純な単一接続のシーン（ネイティブの `useWebSocket` の方が軽量）
- **なぜ `handlerRef` を使うか**：`handler` はレンダリングのたびに新しい関数になる可能性がある（インラインのアロー関数など）。直接 `socket.on` に渡すと、再レンダリングのたびにバインド解除+再バインドが発生する。`useRef` により listener の参照を不変に保ちつつ、内部では常に最新の handler を呼び出す
- **なぜ Provider が接続を 1 回だけ作成するか**：Socket.IO 接続は**グローバルリソース**であり、複数のコンポーネントが同一接続を共有すべきで、各自で作成すべきではない
:::

---

## リアルタイムチャットルーム（完全な例）

> 総合的な例 ―― メッセージ送受信、接続状態、ユーザーリスト、ルーム切替

::: code-group

```tsx [ChatApp.tsx]
import { useState, useEffect, useRef } from "react";
import { useWebSocket } from "./useWebSocket"; // カスタム Hook、本ページ上部を参照

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

  // メッセージ受信
  useEffect(() => {
    if (!lastMessage) return;
    try {
      const msg: Message = JSON.parse(lastMessage);
      setMessages((prev) => [...prev, msg]);
    } catch {
      // JSON でないメッセージは無視（ウェルカムメッセージなど）
    }
  }, [lastMessage]);

  // 自動スクロール
  useEffect(() => {
    listRef.current?.scrollTo(0, listRef.current.scrollHeight);
  }, [messages]);

  // ルーム切替時にメッセージをクリア
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
    setMessages((prev) => [...prev, msg]); // 楽観的更新
    setInput("");
  };

  const isConnected = readyState === WebSocket.OPEN;

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh" }}>
      {/* ルーム切替 */}
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
        <span>{isConnected ? "🟢 接続済み" : "🔴 切断"}</span>
      </nav>

      {/* メッセージリスト */}
      <div ref={listRef} style={{ flex: 1, overflow: "auto" }}>
        {messages.map((msg) => (
          <div key={msg.id}>
            <strong>{msg.user}</strong>: {msg.text}
            <small>{new Date(msg.timestamp).toLocaleTimeString()}</small>
          </div>
        ))}
      </div>

      {/* 入力欄 */}
      <div>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSend()}
          placeholder={isConnected ? "メッセージを入力..." : "再接続中..."}
          disabled={!isConnected}
        />
        <button onClick={handleSend} disabled={!isConnected}>
          送信
        </button>
      </div>
    </div>
  );
}
```

```ts [サーバー server.ts]
import { WebSocketServer, WebSocket } from "ws";
import { createServer } from "http";
import url from "url";

const server = createServer();
const wss = new WebSocketServer({ server });

// ルーム管理
const rooms = new Map<string, Set<WebSocket>>();

wss.on("connection", (ws, req) => {
  const { room = "general", user = "anonymous" } = url.parse(req.url!, true).query as Record<
    string,
    string
  >;

  // ルームに参加
  if (!rooms.has(room)) rooms.set(room, new Set());
  rooms.get(room)!.add(ws);

  console.log(`${user} joined #${room}`);

  // 同じルームの他のメンバーにメッセージを転送
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

::: warning 楽観的更新（Optimistic Update）

メッセージ送信時に**サーバーの確認を待たず**、先にローカルのリストにメッセージを表示する。これによりユーザーはネットワーク遅延を感じない。送信失敗時（readyState が CLOSED になった場合）は、UI でメッセージに「送信失敗」とマークし、リトライボタンを提供できる
:::

---

## オンラインステータスインジケーター

> 現在の接続状態の表示、入力中インジケーター（typing indicator）

::: code-group

```tsx [使用例]
function TypingIndicator({ roomId }: { roomId: string }) {
  const { typingUsers, startTyping, stopTyping } = useTypingStatus(roomId);

  return (
    <div>
      {/* 入力欄のバインド */}
      <input
        onFocus={startTyping}
        onBlur={stopTyping}
        onChange={startTyping} // キー入力のたびにタイマーをリセット
      />

      {/* 誰が入力中かを表示 */}
      {typingUsers.length > 0 && (
        <p>
          {typingUsers.length === 1
            ? `${typingUsers[0]} が入力中...`
            : typingUsers.length <= 3
              ? `${typingUsers.join("、")} が入力中...`
              : `${typingUsers.length} 人が入力中...`}
        </p>
      )}
    </div>
  );
}
```

```ts [実装コード]
import { useState, useEffect, useRef, useCallback } from "react";
import { useSocket, useSocketEvent } from "./useSocketIO"; // カスタム Hook、本ページ上部を参照

function useTypingStatus(roomId: string) {
  const { socket } = useSocket();
  const [typingUsers, setTypingUsers] = useState<string[]>([]);
  const typingTimerRef = useRef<ReturnType<typeof setTimeout>>();

  // 他のユーザーの入力状態を監視
  useSocketEvent("typing:start", (user: string) => {
    setTypingUsers((prev) => (prev.includes(user) ? prev : [...prev, user]));
  });

  useSocketEvent("typing:stop", (user: string) => {
    setTypingUsers((prev) => prev.filter((u) => u !== user));
  });

  // 自分が入力中であることを通知（デバウンス：入力停止後 2 秒で自動的に stop を送信）
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

  // コンポーネントのアンマウント時に入力停止を通知
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

- **デバウンス戦略**：キー入力のたびに 2 秒のタイマーをリセットし、タイムアウト後に自動で `typing:stop` を送信する。これにより毎回のキー入力でネットワークリクエストを送る必要がなく、かつユーザーが入力を停止した後にステータスを即座に更新できる
- **重複排除**：`setTypingUsers` 内で既に存在するかをチェックし、同一ユーザーが重複して表示されるのを防ぐ
:::

---

## リアルタイムデータパネル

> 株価、監視データなど ―― 高頻度更新 + スロットリングレンダリング

高頻度プッシュ（例：100ms ごとに 1 件）の場合、メッセージごとに React の再レンダリングをトリガすべきではない。`useRef` でデータをバッファリングし、`requestAnimationFrame` でバッチ更新する：

::: code-group

```tsx [使用例]
function StockDashboard() {
  const prices = useRealtimeData<Record<string, number>>(
    "ws://localhost:3000/stocks",
    {}, // 初期値
  );

  return (
    <table>
      <thead>
        <tr><th>銘柄</th><th>価格</th></tr>
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

```ts [実装コード]
import { useState, useEffect, useRef } from "react";

function useRealtimeData<T>(url: string, initialData: T): T {
  const [data, setData] = useState<T>(initialData);
  const bufferRef = useRef<T>(initialData);
  const rafRef = useRef<number>();

  useEffect(() => {
    const ws = new WebSocket(url);

    ws.onmessage = (event) => {
      const parsed = JSON.parse(event.data);

      // バッファに統合（レンダリングをトリガしない）
      bufferRef.current = { ...bufferRef.current, ...parsed };

      // rAF でバッチ更新（フレームあたり最大 1 回 ≈ 60fps）
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

- **使うべきシーン**：サーバーのプッシュ頻度が React のレンダリング頻度を超える（>16ms/件）シーン
- **使うべきでないシーン**：低頻度プッシュ（毎秒数件以下）の場合は `setState` を直接呼べばよく、バッファリング不要
- **なぜ `setTimeout` スロットリングではなく `requestAnimationFrame` を使うか**：rAF はブラウザのレンダリングフレームと同期するため、フレームごとに 1 回のみの更新を保証しつつフレーム落ちしない。`setTimeout` はレンダリングサイクルとずれる可能性があり、視覚的なカクつきやフレーム飛びを引き起こす
- **なぜ `useRef` をバッファとして使うか**：`useRef` の変更は再レンダリングをトリガしないため、高頻度書き込みの中間ストレージに適している
:::

---

## 協同編集カーソル

> 他のユーザーのカーソル位置をリアルタイム表示（Figma / Google Docs のような）

::: code-group

```tsx [使用例]
function CollaborativeEditor() {
  const { cursors, updateCursor } = useCursors("doc-123");

  return (
    <div
      style={{ position: "relative", width: "100%", height: "100vh" }}
      onMouseMove={(e) => {
        updateCursor({ x: e.clientX, y: e.clientY });
      }}
    >
      {/* エディタコンテンツ */}
      <textarea style={{ width: "100%", height: "100%" }} />

      {/* 他のユーザーのカーソル */}
      {Object.entries(cursors).map(([userId, cursor]) => (
        <div
          key={userId}
          style={{
            position: "absolute",
            left: cursor.x,
            top: cursor.y,
            pointerEvents: "none",
            transition: "all 0.1s ease-out", // スムーズな移動
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

```ts [実装コード]
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

  // スロットリング送信（50ms あたり最大 1 回、高頻度マウスイベントによるネットワーク飽和を防止）
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

- **50ms スロットリング**：マウスの `mousemove` は毎秒数百回発火する可能性がある。50ms スロットリング後は約 20fps となり、カーソル表示には十分スムーズ
- **CSS `transition`**：カーソル位置は離散的に更新される（50ms ごと）が、`transition: all 0.1s ease-out` を追加することで視覚的にはスムーズに移動する
- **離脱カーソルのクリーンアップ**：ユーザーが切断した際、サーバーが `cursor:leave` イベントをブロードキャストし、フロントエンドは state からそのカーソルを削除する
:::
