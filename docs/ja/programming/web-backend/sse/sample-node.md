# Node.js 実装

> Express サーバー + ブラウザクライアント（ネイティブ EventSource / fetch）の完全な例

## インストール

```zsh
% npm install express
```

---

## 最小構成の例

リアルタイムカウンターを例に、サーバーが毎秒イベントをプッシュする

::: code-group

```ts [サーバー server.ts]
import express from "express";

const app = express();

app.get("/api/events", (req, res) => {
  // SSE に必要な 3 つのレスポンスヘッダー
  res.writeHead(200, {
    "Content-Type": "text/event-stream", // ブラウザに SSE であることを伝える
    "Cache-Control": "no-cache", // キャッシュを禁止
    Connection: "keep-alive", // 接続を維持
  });

  // イベント送信のヘルパー関数
  const sendEvent = (event: string, data: unknown, id?: string) => {
    if (id) res.write(`id: ${id}\n`);
    if (event) res.write(`event: ${event}\n`);
    res.write(`data: ${JSON.stringify(data)}\n\n`); // 2 つの改行 = イベント終了
  };

  // 定期プッシュ
  let count = 0;
  const timer = setInterval(() => {
    sendEvent(
      "message",
      { count: ++count, time: new Date().toISOString() },
      String(count),
    );
  }, 1000);

  // クライアント切断時にクリーンアップ（非常に重要、さもなくばメモリリーク）
  req.on("close", () => {
    clearInterval(timer);
  });
});

app.listen(3000, () => {
  console.log("SSE server running on http://localhost:3000");
});
```

```ts [クライアント（EventSource）]
// 接続を作成（ブラウザのネイティブ API）
const es = new EventSource("/api/events");

// デフォルトの message イベント
es.onmessage = (event) => {
  const data = JSON.parse(event.data);
  console.log("受信:", data);
};

// カスタムイベントを監視
es.addEventListener("notification", (event) => {
  console.log("通知:", JSON.parse(event.data));
});

// 接続確立
es.onopen = () => {
  console.log("接続確立");
};

// エラーハンドリング（ブラウザが自動再接続する）
es.onerror = () => {
  if (es.readyState === EventSource.CLOSED) {
    console.log("接続がクローズされた");
  }
};

// 能動的にクローズ（自動再接続しない）
// es.close();
```

:::

::: warning サーバーは `req.on("close")` を必ず監視すること

クライアント切断後にサーバーがタイマー/サブスクリプションなどのリソースをクリーンアップしなければ、これらのリソースがメモリを占有し続け、最終的に**メモリリーク**を引き起こす。すべての SSE 接続で `close` イベントにてクリーンアップを行う必要がある
:::

---

## 認証の送信

EventSource はカスタムリクエストヘッダーをサポートしていないため、認証が必要な場合は 2 つの方式がある

---

### 方式 1：URL パラメータ

```ts
// query string で token を送信
const es = new EventSource("/api/events?token=xxx");
```

```ts
// サーバー側の検証
app.get("/api/events", (req, res) => {
  const token = req.query.token as string;
  if (!verifyToken(token)) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  // 非 200 または非 text/event-stream を返すと、EventSource は error を発火し再接続しない
  // ... SSE ロジック
});
```

> 注意：Token が URL に露出する（ブラウザ履歴、サーバーログ）。内部システム向きで、高セキュリティ要件のシーンには不向き

---

### 方式 2：fetch + ReadableStream

```ts
async function fetchSSE(url: string, token: string) {
  const response = await fetch(url, {
    method: "POST", // POST も使用可能
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "text/event-stream",
    },
  });

  if (!response.ok) throw new Error(`HTTP ${response.status}`);

  const reader = response.body!.getReader();
  const decoder = new TextDecoder();

  let buffer = ""; // chunk をまたぐイベントを処理するバッファ

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });

    // SSE プロトコルに従って解析：イベントは二重改行で区切られる
    const events = buffer.split("\n\n");
    buffer = events.pop()!; // 最後の要素は不完全な可能性があるためバッファに残す

    for (const event of events) {
      for (const line of event.split("\n")) {
        if (line.startsWith("data: ")) {
          const data = JSON.parse(line.slice(6));
          console.log("受信:", data);
        }
      }
    }
  }
}
```

::: warning fetch 方式の注意事項

| 項目                       | EventSource        | fetch + ReadableStream |
| -------------------------- | ------------------ | ---------------------- |
| カスタムリクエストヘッダー | サポートなし       | サポートあり           |
| HTTP メソッド              | GET のみ           | 任意                   |
| 自動再接続                 | ブラウザネイティブ | 手動実装が必要         |
| イベント解析               | 自動               | 手動解析が必要         |
| Last-Event-ID              | 自動送信           | 手動管理が必要         |

fetch 方式はより柔軟だが、**SSE の自動化メリットを失う**。認証や POST が必要なシーン（AI チャットインターフェースなど）に適している
:::

---

## 複数イベントタイプ

サーバーは異なるタイプのイベントを送信でき、クライアントはタイプ別に監視する：

::: code-group

```ts [サーバー]
app.get("/api/events", (req, res) => {
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
  });

  // 異なるタイプのイベント
  res.write(`event: user:online\ndata: {"user": "Alice"}\n\n`);
  res.write(`event: chat:message\ndata: {"text": "Hello"}\n\n`);
  res.write(
    `event: system:alert\ndata: {"level": "warning", "msg": "CPU 90%"}\n\n`,
  );

  // event フィールドなし → デフォルトの message イベントが発火
  res.write(`data: 通常メッセージ\n\n`);
});
```

```ts [クライアント]
const es = new EventSource("/api/events");

// デフォルトの message イベント（event フィールドのないイベントのみ発火）
es.onmessage = (event) => {
  console.log("通常メッセージ:", event.data);
};

// 特定イベントを監視（event フィールドがあるイベントは onmessage を発火しない）
es.addEventListener("user:online", (event) => {
  console.log("ユーザーオンライン:", JSON.parse(event.data));
});

es.addEventListener("chat:message", (event) => {
  console.log("チャットメッセージ:", JSON.parse(event.data));
});

es.addEventListener("system:alert", (event) => {
  console.log("システム警告:", JSON.parse(event.data));
});
```

:::

::: warning `onmessage` と `addEventListener("message")` の違い

- `event` フィールドがないイベント → `onmessage` が発火する
- `event: message` のイベント → `onmessage` が**同様に**発火する
- `event: xxx`（message 以外）→ `onmessage` は**発火しない**。`addEventListener("xxx")` でのみ監視可能

簡単に言えば：`onmessage` は**デフォルトイベント**（event フィールドなし、または `event: message`）にのみ反応する。カスタムイベントは `addEventListener` を使用する必要がある
:::

---

## 断線再接続と Last-Event-ID

ブラウザの EventSource は断線後に自動再接続し、リクエストヘッダーに `Last-Event-ID` を付与する。サーバーはこれに基づいてプッシュを再開する

```ts
app.get("/api/events", (req, res) => {
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
  });

  // クライアントが最後に受信したイベント ID を読み取る
  const lastId = parseInt(req.headers["last-event-id"] as string) || 0;
  console.log("クライアントの断点:", lastId); // 初回接続時は 0

  // 前回切断した位置からプッシュを継続
  let count = lastId;
  const timer = setInterval(() => {
    count++;
    res.write(`id: ${count}\ndata: ${JSON.stringify({ count })}\n\n`);
  }, 1000);

  // 再接続間隔を 3 秒に設定（クライアントがこれに基づいて再接続タイミングを決定）
  res.write("retry: 3000\n\n");

  req.on("close", () => {
    clearInterval(timer);
  });
});
```

::: warning 断点復旧の前提条件

- サーバーがイベント送信時に **`id` フィールドを含める必要がある**。そうでなければクライアントの再接続時に `Last-Event-ID` がない
- サーバーは ID に基づいて**断点データを見つけられる**必要がある（メモリキュー、データベース、Redis など）
- 上記の例は最もシンプルなケース（自動インクリメント ID）。実際のプロジェクトでは通常、メッセージキューで最近のイベントをキャッシュする必要がある
- `retry` フィールドでクライアントの再接続間隔を制御できる。デフォルトは約 3 秒（ブラウザにより異なる）

:::

---

## ハートビートキープアライブ

一部のプロキシサーバー（Nginx など）は一定時間データ転送がないと**接続を能動的に切断する**。定期的にコメント（`:` で始まる行）を送信してキープアライブする：

```ts
app.get("/api/events", (req, res) => {
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
  });

  // 15 秒ごとにハートビートを送信（コメント行、クライアントは無視する）
  const heartbeat = setInterval(() => {
    res.write(": heartbeat\n\n");
  }, 15_000);

  // 業務イベントのプッシュ...

  req.on("close", () => {
    clearInterval(heartbeat);
  });
});
```

> Nginx のデフォルト `proxy_read_timeout` は 60 秒。ハートビート間隔はプロキシのタイムアウトより**短く**する必要がある

---

## AI ストリーミングレスポンスの例

ChatGPT のようなストリーミング出力を例に、`POST` + `fetch` を使用（リクエストボディの送信が必要なため）：

::: code-group

```ts [サーバー]
app.post("/api/chat", express.json(), async (req, res) => {
  const { message } = req.body;

  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
  });

  // AI が 1 文字ずつ出力するシミュレーション
  const reply = `こんにちは、「${message}」について回答します。これはとても良い質問ですね。`;
  for (const char of reply) {
    res.write(`data: ${JSON.stringify({ token: char })}\n\n`);
    await new Promise((r) => setTimeout(r, 50)); // 遅延のシミュレーション
  }

  // 終了マーカーを送信
  res.write("data: [DONE]\n\n");
  res.end();
});
```

```ts [クライアント]
async function chat(message: string) {
  const response = await fetch("/api/chat", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: "Bearer xxx",
    },
    body: JSON.stringify({ message }),
  });

  const reader = response.body!.getReader();
  const decoder = new TextDecoder();
  let output = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    const text = decoder.decode(value, { stream: true });
    for (const line of text.split("\n")) {
      if (line.startsWith("data: ")) {
        const payload = line.slice(6);
        if (payload === "[DONE]") {
          console.log("\n--- 出力完了 ---");
          return output;
        }
        const { token } = JSON.parse(payload);
        output += token;
        process.stdout.write(token); // 1 文字ずつ表示
      }
    }
  }

  return output;
}
```

:::

::: warning なぜ AI インターフェースは WebSocket ではなく SSE を使うのか

- AI 対話は**リクエスト-レスポンス**パターンであり、双方向リアルタイム通信ではない
- SSE は HTTP ベースであり、既存のインフラ（CDN、API ゲートウェイ、認証ミドルウェア）と**完全に互換**
- WebSocket を使うと接続状態の管理が追加で必要になり、「1 文を送って 1 段落を受け取る」シーンではオーバーエンジニアリング
- フロントエンドは `fetch` + `ReadableStream` だけで済み、WebSocket ライブラリの導入が不要

:::
