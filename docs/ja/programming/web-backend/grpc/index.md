---
prev: false
next: false
---

# gRPC

> Google Remote Procedure Call

gRPC は Google がオープンソースで公開した高性能 RPC フレームワークであり、HTTP/2 + [Protocol Buffers](/ja/programming/web-backend/protobuf/) を用いて言語を跨いだサービス間通信を実現する

::: warning 特徴:

- HTTP/2 ベース：多重化、ヘッダー圧縮、双方向ストリームにより、単一接続で大量のリクエストを並行処理可能
- デフォルトのシリアライズ形式として [protobuf](/ja/programming/web-backend/protobuf/) を使用し、サイズは JSON の 3~10 分の 1、パース速度は数倍高速
- 強い型の契約：`.proto` ファイルでサービスインターフェースを定義し、多言語のクライアント・サーバーコードを自動生成（[詳細](/ja/programming/web-backend/protobuf/#service-定義)）
- 4つの通信モードをネイティブサポート：Unary、Server Streaming、Client Streaming、Bidirectional Streaming
- 多言語対応：Go、Java、C++、Python、Node.js、Rust 等 10+ 言語を公式サポート
:::

::: danger 制限事項:

- **ブラウザから直接呼び出せない**：ブラウザは HTTP/2 Trailer に対応していないため、gRPC-Web プロキシ（Envoy 等）による中継が必要。また gRPC-Web は Client Streaming と Bidirectional Streaming に対応していない
- **protobuf はバイナリ形式**：可読性がなく、デバッグには専用ツール（grpcurl、Postman gRPC、Buf Studio）が必要。ブラウザの DevTools では直接確認できない
- **HTTP キャッシュと CDN を活用できない**：すべてのリクエストが HTTP/2 POST で送信されるため、GET キャッシュの仕組みが使えない
- **学習コストが高い**：[protobuf 構文](/ja/programming/web-backend/protobuf/)、コード生成フロー、ストリーミング通信モデルの習得が必要
- **外部公開 API には不向き**：サードパーティクライアントの統合コストが REST より高い
:::

```txt
┏━━━━━━━━━━ REST API ━━━━━━━━━━━┓
┃                               ┃
┃  Client ━━ JSON ━━▶ Server    ┃  HTTP/1.1
┃                               ┃  テキスト形式、可読
┃  POST /api/users              ┃  リクエストごとに独立した接続
┃  { "name": "Alice" }          ┃
┃                               ┃
┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛


┏━━━━━━━━━━ gRPC ━━━━━━━━━━━━━━━┓
┃                               ┃
┃  Client ━━ protobuf ━━▶ Server┃  HTTP/2
┃                               ┃  バイナリ形式、小サイズ
┃  UserService.CreateUser()     ┃  多重化、単一接続で並行処理
┃  { name: "Alice" }            ┃
┃                               ┃
┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛
```

::: tip 選定の指針

**gRPC を選ぶ場合**：マイクロサービス内部通信、高スループット低レイテンシの場面、ストリーミングが必要、多言語サービス間呼び出し

**REST を選ぶ場合**：ブラウザ/サードパーティ向けの公開 API、シンプルな CRUD、HTTP キャッシュ/CDN が必要

**[GraphQL](/ja/programming/web-backend/graphql/) を選ぶ場合**：複数クライアントで柔軟にクエリ、フロントエンドで必要なフィールドだけ取得

**[tRPC](/ja/programming/web-backend/trpc/) を選ぶ場合**：TypeScript フルスタックプロジェクト、フロントエンドとバックエンドが同一チーム
:::

## 基本概念

| 概念 | 一言での説明 |
| --- | --- |
| Channel | クライアントとサーバー間の HTTP/2 接続。再利用可能 |
| Stub（クライアントスタブ） | `.proto` から自動生成されたクライアントプロキシオブジェクト。ローカル関数のように呼び出せる |
| Metadata | リクエスト/レスポンスの付加情報（HTTP Header に相当）。認証トークンやトレース ID の伝達に使用 |
| Interceptor | インターセプター。RPC 呼び出しの前後にロジックを挿入する（ミドルウェアに相当）。ロギング、認証、リトライ等に使用 |
| Deadline / Timeout | クライアントが設定するリクエストのタイムアウト時間。超過すると自動キャンセルされ、リクエストの無限待機を防止する |

protobuf 関連の概念（Message、Service、フィールド番号等）は [こちら](/ja/programming/web-backend/protobuf/) を参照

## ダウンロードとインストール

protobuf コンパイラ（[詳細](/ja/programming/web-backend/protobuf/#ダウンロードとインストール)）と対応言語の gRPC ライブラリの2つをインストールする必要がある

| 実装 | 言語 | インストール |
| --- | --- | --- |
| `google.golang.org/grpc` | Go | `go install google.golang.org/grpc/cmd/protoc-gen-go-grpc@latest` |
| `@grpc/grpc-js` | Node.js | `npm install @grpc/grpc-js @grpc/proto-loader` |
| `grpcio` | Python | `pip install grpcio grpcio-tools` |
| `io.grpc` | Java | Gradle/Maven 依存 `io.grpc:grpc-netty` |
| `tonic` | Rust | `cargo add tonic prost` |

## 基本的な使い方

```txt
① .proto ファイルを定義（詳細は protobuf を参照）
┌──────────────────────────────────┐
│ service UserService {            │
│   rpc GetUser(GetUserReq)        │
│       returns (User);            │
│ }                                │
│ message GetUserReq { int32 id }  │
│ message User { string name }     │
└──────────────────────────────────┘
                │
                ▼
② protoc でコンパイルしてコードを生成
┌──────────────────────────────────┐
│ protoc --go_out=. --go-grpc_out=.│
│   user.proto                     │
│                                  │
│ 生成物:                           │
│   user.pb.go       ← メッセージ型│
│   user_grpc.pb.go  ← サービスIF  │
└──────────────────────────────────┘
                │
        ┌───────┴───────┐
        ▼               ▼
③ サーバー側の実装      ④ クライアント側の呼び出し
┌────────────────┐  ┌─────────────────────┐
│ IF メソッドを実装│  │ conn := grpc.Dial() │
│ func GetUser() │  │ client.GetUser(     │
│   → DB を参照   │  │   {id: 1}           │
│ Server に登録   │  │ )                   │
│ ポートを Listen  │  │ → { name: "Alice" } │
└────────────────┘  └─────────────────────┘
```

開発手順：

1. **`.proto` ファイルを定義** --- protobuf 構文で Message と Service を宣言する（[詳細](/ja/programming/web-backend/protobuf/#service-定義)）
2. **コンパイルしてコードを生成** --- `protoc` + gRPC 言語プラグインでクライアント Stub とサーバー側インターフェースコードを自動生成する
3. **サーバー側を実装** --- 生成されたインターフェースを実装し、ビジネスロジックを記述して gRPC Server を起動しポートを Listen する
4. **クライアント側から呼び出し** --- 生成された Stub を通じてローカル関数を呼ぶように RPC リクエストを発行する

## 4つの通信モード

### Unary RPC

> 単項呼び出し

最も基本的なモード。クライアントが1つのリクエストを送り、サーバーが1つのレスポンスを返す（通常の HTTP リクエストに相当）

```protobuf
rpc GetUser(GetUserRequest) returns (User);
```

```txt
Client ─── Request ───▶ Server
Client ◀── Response ─── Server
```

---

### Server Streaming RPC

> サーバーストリーミング

クライアントが1つのリクエストを送り、サーバーがデータストリーム（複数のレスポンス）を返す。サーバーが大量のデータをプッシュする場面に適している（ログストリーム、検索結果の逐次返却）

```protobuf
rpc ListUsers(ListUsersRequest) returns (stream User);
```

```txt
Client ─── Request ──────────▶ Server
Client ◀── Response 1 ──────── Server
Client ◀── Response 2 ──────── Server
Client ◀── Response 3 ──────── Server
Client ◀── (stream closed) ─── Server
```

---

### Client Streaming RPC

> クライアントストリーミング

クライアントがデータストリーム（複数のリクエスト）を送り、サーバーが受信完了後に1つのレスポンスを返す。クライアントがバッチアップロードする場面に適している（ファイルアップロード、バッチデータインポート）

```protobuf
rpc UploadLogs(stream LogEntry) returns (UploadResult);
```

```txt
Client ─── Request 1 ──────▶ Server
Client ─── Request 2 ──────▶ Server
Client ─── Request 3 ──────▶ Server
Client ─── (stream closed) ▶ Server
Client ◀── Response ──────── Server
```

---

### Bidirectional Streaming RPC

> 双方向ストリーミング

クライアントとサーバーの双方がいつでもデータストリームを送信でき、独立して読み書きする。リアルタイム双方向通信の場面に適している（チャット、リアルタイムコラボレーション）

```protobuf
rpc Chat(stream ChatMessage) returns (stream ChatMessage);
```

```txt
Client ─── Message 1 ──▶ Server
Client ◀── Message A ─── Server
Client ─── Message 2 ──▶ Server
Client ◀── Message B ─── Server
Client ─── Message 3 ──▶ Server
Client ◀── Message C ─── Server
```

## エラーハンドリング

gRPC は独自のステータスコード体系を使用する（HTTP ステータスコードとは異なる）：

| gRPC ステータスコード | 意味 | 対応する HTTP | 使用場面 |
| --- | --- | --- | --- |
| `OK` (0) | 成功 | 200 | --- |
| `INVALID_ARGUMENT` (3) | 引数エラー | 400 | フィールドバリデーション失敗 |
| `NOT_FOUND` (5) | リソースが存在しない | 404 | レコードが見つからない |
| `ALREADY_EXISTS` (6) | リソースが既に存在する | 409 | 一意性制約の衝突 |
| `PERMISSION_DENIED` (7) | 権限不足 | 403 | 操作権限なし |
| `UNAUTHENTICATED` (16) | 未認証 | 401 | トークンの欠落または失効 |
| `RESOURCE_EXHAUSTED` (8) | リソース枯渇 | 429 | レートリミット |
| `INTERNAL` (13) | 内部エラー | 500 | 未処理の例外 |
| `UNAVAILABLE` (14) | サービス利用不可 | 503 | サービスが一時的に到達不能、リトライ可能 |
| `DEADLINE_EXCEEDED` (4) | タイムアウト | 504 | リクエストが Deadline を超過 |
| `UNIMPLEMENTED` (12) | 未実装 | 501 | メソッド未実装 |

::: warning 重要ポイント

- `UNAVAILABLE` は一時的な障害を示し、クライアントは**リトライすべき**（バックオフ戦略付き）
- `INTERNAL` はサーバー側のバグを示し、クライアントは**リトライすべきでない**
- 常に **Deadline** を設定し、リクエストの無限待機を防止する。Deadline を設定していないリクエストは永遠にハングアップし、サーバーリソースを占有する可能性がある
:::

## gRPC vs REST

| 観点 | gRPC | REST |
| --- | --- | --- |
| プロトコル | HTTP/2 | HTTP/1.1（HTTP/2 も使用可能） |
| シリアライズ | [protobuf](/ja/programming/web-backend/protobuf/)（バイナリ） | JSON（テキスト） |
| インターフェース定義 | `.proto` ファイル（強い型の契約） | OpenAPI/Swagger（任意） |
| コード生成 | 多言語 codegen をネイティブサポート | サードパーティツールが必要 |
| ストリーミング | 4つのモードをネイティブサポート | 非対応（SSE / WebSocket が必要） |
| ブラウザ対応 | gRPC-Web プロキシが必要 | ネイティブ対応 |
| 可読性 | バイナリ、ツールで解析が必要 | JSON を直接閲覧可能 |
| 性能 | より高い（バイナリ + HTTP/2 多重化） | より低い（テキスト + 短時間接続） |
| キャッシュ | HTTP キャッシュ非対応 | HTTP ネイティブキャッシュ |
| 適用場面 | マイクロサービス内部、高性能、多言語 | ブラウザ向け、公開 API |
