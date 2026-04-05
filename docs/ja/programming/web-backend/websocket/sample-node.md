# Node.js 実装

> ws ライブラリ（ネイティブ WebSocket）と Socket.IO（高レベルラッパー）の 2 つの方式を比較

## インストール

::: code-group

```zsh [ws（ネイティブ）]
% npm install ws
% npm install -D @types/ws    # TypeScript 型定義
```

```zsh [Socket.IO]
% npm install socket.io          # サーバー側
% npm install socket.io-client   # クライアント側
```

:::

---

## 最小構成の例

簡易チャットルームを例に、サーバー + クライアントの完全な実装を示す

---

### ws ライブラリ

::: code-group

```ts [サーバー server.ts]
import { WebSocketServer, WebSocket } from "ws";

const wss = new WebSocketServer({ port: 3000 });

wss.on("connection", (ws, req) => {
  console.log("新しいクライアントが接続:", req.socket.remoteAddress);

  // メッセージ受信
  ws.on("message", (data) => {
    const message = data.toString();
    console.log("受信:", message);

    // 全クライアントにブロードキャスト
    wss.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(message);
      }
    });
  });

  // 接続クローズ
  ws.on("close", (code, reason) => {
    console.log(`クライアント切断: ${code}`);
  });

  // ウェルカムメッセージを送信
  ws.send("Welcome!");
});

console.log("WebSocket server running on ws://localhost:3000");
```

```ts [クライアント client.ts（ブラウザ）]
const ws = new WebSocket("ws://localhost:3000");

// 接続確立
ws.onopen = () => {
  console.log("接続確立");
  ws.send(JSON.stringify({ user: "Alice", text: "Hello!" }));
};

// メッセージ受信
ws.onmessage = (event) => {
  console.log("メッセージ受信:", event.data);
};

// 接続クローズ
ws.onclose = (event) => {
  console.log(`接続クローズ: code=${event.code}, reason=${event.reason}`);
};

// 接続エラー
ws.onerror = (error) => {
  console.error("接続エラー:", error);
};
```

:::

---

### Socket.IO

::: code-group

```ts [サーバー server.ts]
import { Server } from "socket.io";

const io = new Server(3000, {
  cors: { origin: "*" },
});

io.on("connection", (socket) => {
  console.log("新しいクライアントが接続:", socket.id);

  // ルームに参加
  socket.join("chat-room");

  // カスタムイベントを監視
  socket.on("chat:message", (msg) => {
    console.log("受信:", msg);
    // ルーム内の他のメンバーにブロードキャスト
    socket.to("chat-room").emit("chat:message", msg);
  });

  // 切断
  socket.on("disconnect", (reason) => {
    console.log("切断:", reason);
  });
});

console.log("Socket.IO server running on port 3000");
```

```ts [クライアント client.ts（ブラウザ）]
import { io } from "socket.io-client";

const socket = io("http://localhost:3000");

socket.on("connect", () => {
  console.log("接続確立:", socket.id);
  socket.emit("chat:message", { user: "Alice", text: "Hello!" });
});

socket.on("chat:message", (msg) => {
  console.log("受信:", msg);
});

socket.on("disconnect", (reason) => {
  console.log("切断:", reason);
});
```

:::

::: warning ws vs Socket.IO の本質的な違い

| 項目             | ws                        | Socket.IO                                               |
| ---------------- | ------------------------- | ------------------------------------------------------- |
| プロトコル       | 標準 WebSocket プロトコル | **独自プロトコル**（ネイティブ WebSocket と互換性なし） |
| トランスポート層 | WebSocket のみ            | WebSocket + HTTP ロングポーリング（自動フォールバック） |
| 再接続           | サポートなし              | 組み込みの自動再接続 + エクスポネンシャルバックオフ     |
| ルーム           | サポートなし              | 組み込みのルーム/名前空間                               |
| ブロードキャスト | 手動で clients を走査     | `socket.to(room).emit()`                                |
| イベント機構     | `onmessage` 単一イベント  | カスタムイベント名 `emit/on`                            |
| パッケージサイズ | ~2KB                      | ~40KB（クライアント側）                                 |

Socket.IO クライアントはネイティブ WebSocket サーバーに**接続できず**、その逆も同様である
:::

---

## ハートビート検出

ws ライブラリにはハートビートが組み込まれていないため、手動で実装する必要がある。ハートビートは「半死接続」（TCP 接続は存在するが実際には到達不能）を検出するために使用される

```ts
import { WebSocketServer, WebSocket } from "ws";

const wss = new WebSocketServer({ port: 3000 });

const HEARTBEAT_INTERVAL = 30_000; // 30 秒

wss.on("connection", (ws) => {
  let isAlive = true;

  // pong を受信したら接続は生存中
  ws.on("pong", () => {
    isAlive = true;
  });

  const timer = setInterval(() => {
    if (!isAlive) {
      ws.terminate(); // 応答なし、強制切断（クローズハンドシェイクなし）
      return;
    }
    isAlive = false;
    ws.ping(); // ping を送信し、pong を待つ
  }, HEARTBEAT_INTERVAL);

  ws.on("close", () => {
    clearInterval(timer);
  });
});
```

::: tip `terminate()` vs `close()`

- `ws.close()` ―― クローズフレームを送信し、相手の確認を待ってから切断（グレースフルクローズ）
- `ws.terminate()` ―― 基盤の TCP 接続を直接破棄（強制クローズ、死んだ接続のクリーンアップに使用）

:::

Socket.IO にはハートビート機構が組み込まれており、設定のみで利用できる：

```ts
const io = new Server(3000, {
  pingInterval: 25000, // 25 秒ごとに ping を送信
  pingTimeout: 5000, // 5 秒以内に pong がなければ切断
});
```

---

## Express/Koa との統合

WebSocket サービスを既存の HTTP サーバーにマウントし、同一ポートを共有する：

```ts
import express from "express";
import { createServer } from "http";
import { WebSocketServer } from "ws";

const app = express();
const server = createServer(app);

// HTTP ルートは通常通り使用
app.get("/health", (req, res) => {
  res.json({ status: "ok" });
});

app.get("/", (req, res) => {
  res.send("HTTP と WebSocket がポート 3000 を共有");
});

// WebSocket を同一 HTTP サーバーにマウント
const wss = new WebSocketServer({ server });

wss.on("connection", (ws) => {
  ws.on("message", (data) => {
    ws.send(`Echo: ${data}`);
  });
});

// 注意：app.listen() ではなく server.listen() を使用
server.listen(3000, () => {
  console.log("HTTP + WS server running on port 3000");
});
```

::: warning 核心ポイント

- ポイントは `createServer(app)` で HTTP サーバーを作成し、それを `WebSocketServer` に渡すこと
- `app.listen()` も内部で `createServer()` を呼び出すが、server インスタンスを取得できない
- HTTP リクエストは Express ルートで処理し、WebSocket アップグレードリクエストは ws ライブラリで処理する。互いに干渉しない

:::

---

## 認証

WebSocket のハンドシェイクは HTTP リクエストだが、その後は HTTP ではなくなるため、認証は**ハンドシェイク段階**で行う必要がある

---

### 方式 1：URL パラメータ

```ts
// クライアント
const ws = new WebSocket("ws://localhost:3000?token=xxx");

// サーバー
import url from "url";

wss.on("connection", (ws, req) => {
  const { token } = url.parse(req.url!, true).query;
  if (!verifyToken(token as string)) {
    ws.close(1008, "Unauthorized");
    return;
  }
  // 認証成功...
});
```

---

### 方式 2：Cookie

```ts
// サーバー（Cookie の検証）
wss.on("connection", (ws, req) => {
  const cookie = req.headers.cookie;
  const session = parseCookie(cookie); // 独自のパース処理
  if (!session?.userId) {
    ws.close(1008, "Unauthorized");
    return;
  }
  // 認証成功...
});
```

---

### 方式 3：最初のメッセージで認証

```ts
// クライアント
ws.onopen = () => {
  ws.send(JSON.stringify({ type: "auth", token: "xxx" }));
};

// サーバー
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

    // 通常の業務メッセージ処理...
  });
});
```

::: tip 3 つの方式の比較

| 方式             | メリット                         | デメリット                                                         |
| ---------------- | -------------------------------- | ------------------------------------------------------------------ |
| URL パラメータ   | シンプル                         | Token が URL に露出する（ログに残る）                              |
| Cookie           | ブラウザが自動で送信             | クロスオリジンのケースに不向き                                     |
| 最初のメッセージ | 柔軟で、任意の認証ロジックに対応 | ハンドシェイク段階では未認証のため、一時的に未認可の接続が存在する |

:::

---

## クライアントの自動再接続

ネイティブ WebSocket は自動再接続をサポートしていない。よくあるラッパーパターン（エクスポネンシャルバックオフ）：

```ts
function createReconnectingWS(url: string, maxRetries = 5) {
  let retries = 0;
  let ws: WebSocket;

  function connect() {
    ws = new WebSocket(url);

    ws.onopen = () => {
      console.log("接続確立");
      retries = 0; // 接続成功、カウンタをリセット
    };

    ws.onclose = (event) => {
      // 1000 = 正常クローズ、再接続しない
      if (event.code !== 1000 && retries < maxRetries) {
        const delay = Math.min(1000 * 2 ** retries, 30_000); // 1s → 2s → 4s → ... → 最大 30s
        console.log(`${delay}ms 後に再接続（第 ${retries + 1} 回目）...`);
        setTimeout(connect, delay);
        retries++;
      }
    };

    ws.onmessage = (event) => {
      console.log("受信:", event.data);
    };
  }

  connect();

  return {
    get ws() {
      return ws;
    },
    close() {
      ws.close(1000, "Manual close");
    }, // 正常クローズ、再接続は発生しない
  };
}
```

::: warning エクスポネンシャルバックオフ（Exponential Backoff）

再接続間隔は `2^n` 秒で増加（1s → 2s → 4s → 8s → ...）し、大量のクライアントが同時に切断された場合に一斉再接続してサーバーに**接続の嵐**を引き起こすことを防ぐ

本番環境では**ランダムジッター**（jitter）を追加することが推奨される：`delay * (0.5 + Math.random() * 0.5)` で再接続リクエストをさらに分散させる
:::

---

## メッセージプロトコル設計

ネイティブ WebSocket は「文字列/バイナリの送信」能力のみを提供する。業務層では独自にメッセージフォーマットを設計する必要がある：

```ts
// よくある JSON メッセージプロトコル
interface WSMessage {
  type: string;     // メッセージタイプ、イベント名に相当
  payload: unknown; // メッセージデータ
  id?: string;      // メッセージ ID（リクエスト-レスポンスのマッチングに使用）
}

// 例
{ type: "chat:message", payload: { text: "Hello", room: "general" } }
{ type: "user:typing",  payload: { userId: "123" } }
{ type: "error",        payload: { code: 400, message: "Bad Request" } }
```

::: tip Socket.IO にはイベント機構（`emit/on`）が組み込まれているため、メッセージプロトコルを手動で設計する必要がない。これもネイティブ WebSocket より便利な理由の一つである
:::
