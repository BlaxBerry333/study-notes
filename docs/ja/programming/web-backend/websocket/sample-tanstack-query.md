# TanStack Query 統合

::: tip なぜ統合するのか
ネイティブ WebSocket + `useState` では、2 つの状態管理が統一されない、キャッシュ/自動無効化がない、複数コンポーネントでの共有を手動管理する必要があるといった問題がある。TanStack Query 自体は WebSocket をサポートしていないが、**queryCache を手動で更新**することで、リアルタイムプッシュのデータをキャッシュに同期でき、同じ queryKey をサブスクライブしている全コンポーネントが自動的に更新される
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
│  (キャッシュ + UI) │ ◀───── JSON ─────── │          │
└──────┬───────┘                     └────┬─────┘
       │                                  │
       │  queryClient.setQueryData()      │ WebSocket push
       │ ◀─────── リアルタイムキャッシュ更新 ─  │         ② 以降の差分は WS
       │                                  │
└──────┴──────────────────────────────────┘
```

::: warning 核心ポイント

- `useQuery` は**初回ロード**と**キャッシュ管理**を担当する（初回レンダリング時に HTTP で全量データを取得）
- WebSocket は**差分更新**を担当する（接続確立後、サーバーが変更データをプッシュ）
- `queryClient.setQueryData()` を通じて、WebSocket で受信したデータを **TanStack Query キャッシュに同期**する
- 同じ `queryKey` を使用している全コンポーネントが自動的に再レンダリングされ、手動 `setState` は不要
:::

---

## リアルタイムリスト（基本的な使い方）

最もよくあるパターン：HTTP で初期データをロード + WebSocket で新規/更新/削除をプッシュ

::: code-group

```tsx [使用例]
function MessageList({ roomId }: { roomId: string }) {
  const { data: messages = [], isLoading } = useMessagesQuery(roomId);

  // WebSocket が自動的に queryCache に同期し、コンポーネントが自動更新
  useMessagesSubscription(roomId);

  if (isLoading) return <p>読み込み中...</p>;

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

```ts [実装コード]
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef } from "react";

interface Message {
  id: string;
  user: string;
  text: string;
  timestamp: number;
}

// ① HTTP クエリ：初期データのロード
function useMessagesQuery(roomId: string) {
  return useQuery({
    queryKey: ["messages", roomId],
    queryFn: async () => {
      const res = await fetch(`/api/rooms/${roomId}/messages`);
      return res.json() as Promise<Message[]>;
    },
    staleTime: Infinity, // WebSocket が更新を担当するため、自動 refetch は不要
  });
}

// ② WebSocket サブスクリプション：差分を queryCache に同期
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
          // 新しいメッセージを追加
          queryClient.setQueryData<Message[]>(
            ["messages", roomId],
            (old = []) => [...old, data],
          );
          break;

        case "message:update":
          // 既存メッセージを更新
          queryClient.setQueryData<Message[]>(
            ["messages", roomId],
            (old = []) =>
              old.map((msg) =>
                msg.id === data.id ? { ...msg, ...data } : msg,
              ),
          );
          break;

        case "message:delete":
          // メッセージを削除
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

- **`staleTime: Infinity`**：TanStack Query に「自動 refetch するな」と指示する。WebSocket が更新を担当するためである。これがないと、タブを切り替えて戻った際に不要な HTTP リクエストが発生する
- **`setQueryData` の updater 関数**：古いキャッシュデータを受け取り、新しいデータを返す。TanStack Query が自動的にその queryKey をサブスクライブしている全コンポーネントの再レンダリングをトリガする
- **なぜ `invalidateQueries` を直接使わないか**：invalidate は HTTP refetch（全量取得）をトリガする。たまにリフレッシュするには適しているが、高頻度のリアルタイム更新ではキャッシュを直接操作する方が効率的
:::

---

## 楽観的更新 + WebSocket 確認

メッセージ送信時に先に楽観的に UI を更新し、WebSocket で送信する。サーバー確認後、WebSocket プッシュが自動的に楽観的データを上書きする

::: code-group

```tsx [使用例]
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
        送信
      </button>
    </div>
  );
}
```

```ts [実装コード]
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

    // 楽観的更新：送信前に先に UI を更新
    onMutate: async (text) => {
      await queryClient.cancelQueries({ queryKey: ["messages", roomId] });

      const previous = queryClient.getQueryData<Message[]>([
        "messages",
        roomId,
      ]);

      const optimisticMessage: Message = {
        id: `temp-${Date.now()}`, // 一時 ID
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

    // 送信失敗：楽観的更新前のデータにロールバック
    onError: (_err, _text, context) => {
      if (context?.previous) {
        queryClient.setQueryData(["messages", roomId], context.previous);
      }
    },

    // onSuccess / onSettled での invalidate は不要
    // WebSocket でプッシュされる "message:new" イベントが自動的にキャッシュを更新
    // サーバーが割り当てた実際の ID が一時 ID を上書きする
  });
}
```

:::

::: warning 楽観的更新 + WebSocket の連携フロー

```txt
① ユーザーが送信をクリック
② onMutate → 楽観的に一時メッセージを挿入（id: "temp-xxx"）→ UI に即座に表示
③ mutationFn → POST /api/messages → サーバーが保存しブロードキャスト
④ WebSocket が "message:new" をプッシュ（id: "real-xxx"）
⑤ setQueryData で実際のメッセージを追加 → リストに 2 件表示される？
```

重複の解決：サーバーがブロードキャスト時に**送信者本人を除外**するか、クライアントの WebSocket ハンドラ内で `temp-` プレフィックスのメッセージが実際のメッセージで置き換え済みかをチェックする
:::

---

## リアルタイムデータパネル + キャッシュ

株価、監視データなどの高頻度プッシュシーン：HTTP で初期スナップショットをロード + WebSocket で差分更新

::: code-group

```tsx [使用例]
function StockDashboard() {
  const { data: stocks = {}, isLoading } = useStocksQuery();
  useStocksSubscription();

  if (isLoading) return <p>読み込み中...</p>;

  return (
    <table>
      <thead>
        <tr>
          <th>コード</th>
          <th>価格</th>
          <th>騰落率</th>
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

```ts [実装コード]
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef } from "react";

interface StockInfo {
  price: number;
  change: number;
}

type StockMap = Record<string, StockInfo>;

// ① HTTP：初期スナップショットのロード
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

// ② WebSocket：差分更新
function useStocksSubscription() {
  const queryClient = useQueryClient();
  const bufferRef = useRef<StockMap>({});
  const rafRef = useRef<number>();

  useEffect(() => {
    const ws = new WebSocket("ws://localhost:3000/stocks");

    ws.onmessage = (event) => {
      const update: StockMap = JSON.parse(event.data);

      // バッファに統合（レンダリングを即座にトリガしない）
      Object.assign(bufferRef.current, update);

      // rAF でバッチキャッシュ更新（フレームあたり最大 1 回）
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

- **rAF バッファリング**：株価データは 100ms ごとにプッシュされる可能性がある。直接 `setQueryData` を呼ぶと毎秒 10 回以上の再レンダリングが発生する。`requestAnimationFrame` で複数の更新をフレームごとに 1 回にまとめる（約 60fps）
- **`staleTime: Infinity`**：上記と同様、WebSocket が更新を担当するため自動 refetch は不要
- **初期スナップショットの必要性**：WebSocket は差分変更のみをプッシュするため、接続確立時にそれ以前のデータを取りこぼす可能性がある。HTTP が完全なスナップショットをベースラインとして提供する
:::

---

## 接続状態の同期

WebSocket の接続状態も TanStack Query で管理すれば、あらゆるコンポーネントから読み取れる：

::: code-group

```tsx [使用例]
// 任意のコンポーネントで接続状態を読み取り
function ConnectionIndicator() {
  const status = useWSStatus();

  return (
    <span>
      {status === "connected" && "🟢 接続済み"}
      {status === "connecting" && "🟡 接続中"}
      {status === "disconnected" && "🔴 切断済み"}
    </span>
  );
}

// 別のコンポーネントでも同じ状態を読み取れる
function SendButton() {
  const status = useWSStatus();
  return <button disabled={status !== "connected"}>送信</button>;
}
```

```ts [実装コード]
import { useQuery, useQueryClient } from "@tanstack/react-query";

type WSStatus = "connecting" | "connected" | "disconnected";

// 接続状態の読み取り
function useWSStatus(): WSStatus {
  const { data = "connecting" } = useQuery<WSStatus>({
    queryKey: ["ws-status"],
    enabled: false, // リクエストは送信せず、共有状態コンテナとしてのみ使用
    initialData: "connecting",
  });
  return data;
}

// WebSocket 接続管理側で状態を更新
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

::: warning TanStack Query を「グローバル共有状態」として使う

`useQuery({ enabled: false })` はリクエストを送信しない。この場合 queryCache は**型安全なグローバル状態コンテナ**として機能する。Zustand/Redux と比較して：

- 追加の状態ライブラリを導入する必要がない
- devtools をネイティブサポート（React Query Devtools）
- 状態とサーバーデータを同一ツールで管理でき、メンタルモデルが統一される
:::

---

## 切断復旧戦略

WebSocket が切断から再接続した後、キャッシュ内のデータが古くなっている可能性がある。3 つの復旧戦略：

---


### 戦略 1：再接続後に invalidate（推奨）

```ts
ws.onopen = () => {
  if (isReconnection) {
    // 再接続後に TanStack Query に全量データの再 fetch をさせる
    queryClient.invalidateQueries({ queryKey: ["messages", roomId] });
  }
};
```

---

### 戦略 2：サーバーが全量スナップショットをプッシュ

```ts
ws.onmessage = (event) => {
  const { type, data } = JSON.parse(event.data);

  if (type === "snapshot") {
    // サーバーが再接続時に能動的に全量データをプッシュ
    queryClient.setQueryData(["messages", roomId], data);
  }
};
```

---

### 戦略 3：シーケンス番号ベースの差分補償

```ts
// 最後に受信したイベントのシーケンス番号を記録
let lastSeq = 0;

ws.onmessage = (event) => {
  const { seq, ...data } = JSON.parse(event.data);
  lastSeq = seq;
  // 通常の処理...
};

// 再接続時に最後のシーケンス番号を送信し、サーバーが欠落したイベントを再送
ws.onopen = () => {
  ws.send(JSON.stringify({ type: "sync", lastSeq }));
};
```

::: tip 選び方

| 戦略       | 適用シーン                   | メリット   | デメリット           |
| ---------- | ---------------------------- | ---------- | -------------------- |
| invalidate | データ量が少なく、短いローディング状態を許容 | 実装がシンプル | 一瞬のホワイトスクリーン/loading |
| 全量スナップショット | データ量が中程度             | シームレスな復旧 | 帯域の浪費           |
| 差分補償   | データ量が大きく、メッセージに順序あり | 最も帯域を節約 | サーバーがイベントログを維持する必要がある |

:::
