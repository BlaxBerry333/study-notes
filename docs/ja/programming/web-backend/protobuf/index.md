---
prev: false
next: false
---

# Protocol Buffers

> protobuf

Protocol Buffers は Google がオープンソースで公開したクロス言語データシリアライズ形式およびインターフェース定義言語（IDL）である。`.proto` ファイルでデータ構造を定義し、コンパイルして多言語コードを生成する

::: warning 特徴:

- バイナリシリアライズ：サイズは JSON の 3~10 分の 1、パース速度は数倍高速
- クロス言語コード生成：1つの `.proto` ファイルから Go、Java、Python、TypeScript 等 10+ 言語の型安全なコードを生成
- 強い型の契約：フィールド型、番号、ネスト関係が `.proto` で明確に定義され、コンパイル時に型の不一致を検出可能
- 前方/後方互換性：フィールド番号の仕組みにより、フィールドの追加や廃止がデプロイ済みサービスを破壊しない
:::

::: danger 制限事項:

- **バイナリで可読性がない**：JSON のように内容を直接確認できず、デバッグには専用ツール（`protoc --decode`、Buf Studio）が必要
- **コンパイルステップが必要**：`.proto` を修正するたびにコードを再生成する必要があり、開発フローの複雑度が増す
- **ブラウザでの直接利用に不向き**：フロントエンドは通常 JSON を使用しており、ブラウザ側で protobuf を使うには追加のシリアライズ/デシリアライズライブラリが必要
:::

::: info gRPC 専用ではない

protobuf は [gRPC](/ja/programming/web-backend/grpc/) と組み合わせて使われることが多いが、**独立したシリアライズ形式**であり、以下の用途でも広く利用されている：

- メッセージキュー（Kafka、RabbitMQ のメッセージボディ）
- データストレージ（JSON/XML の代わりに永続化形式として使用）
- 設定ファイル
- クロス言語で型安全なデータ交換が必要なあらゆる場面
:::

## 基本概念

| 概念 | 一言での説明 |
| --- | --- |
| `.proto` ファイル | データ構造とサービスインターフェースを定義するソースファイル |
| Message | データ構造の定義（JSON の object、Go の struct に相当） |
| Service | RPC サービスインターフェースの定義（[gRPC](/ja/programming/web-backend/grpc/) 等のフレームワークで使用） |
| フィールド番号 | 各フィールドの一意な番号。バイナリエンコーディングの key であり、リリース後は変更不可 |
| `protoc` | Protocol Buffers コンパイラ。`.proto` をターゲット言語のコードにコンパイルする |
| 言語プラグイン | `protoc` のコード生成プラグイン（例：`protoc-gen-go`、`protoc-gen-js`） |

## ダウンロードとインストール

::: code-group

```zsh [macOS]
% brew install protobuf
```

```zsh [Linux]
% apt install -y protobuf-compiler
```

:::

対応言語のコード生成プラグインも別途インストールが必要：

| 言語 | プラグインのインストール |
| --- | --- |
| Go | `go install google.golang.org/protobuf/cmd/protoc-gen-go@latest` |
| Node.js | `npm install @grpc/proto-loader`<br/>または `ts-proto` を使用：`npm install ts-proto` |
| Python | `pip install grpcio-tools`（protoc Python プラグインを含む） |

## 基本的な使い方

```txt
① .proto ファイルを作成
┌──────────────────────────────────┐
│ syntax = "proto3";               │
│ message User {                   │
│   int32 id = 1;                  │
│   string name = 2;               │
│ }                                │
└──────────────────────────────────┘
                │
                ▼
② protoc でコンパイル
┌──────────────────────────────────┐
│ protoc --go_out=. user.proto     │
│                                  │
│ 生成物: user.pb.go                │
│   → User struct + シリアライズ   │
│     メソッド                     │
└──────────────────────────────────┘
                │
                ▼
③ コード内で生成された型を使用
┌──────────────────────────────────┐
│ u := &pb.User{Id: 1, Name: "A"} │
│ data, _ := proto.Marshal(u)      │
│ // data はコンパクトなバイナリ   │
└──────────────────────────────────┘
```

## 型マッピング

| protobuf 型 | Go | TypeScript | Python | 説明 |
| --- | --- | --- | --- | --- |
| `int32` | `int32` | `number` | `int` | 32 ビット整数 |
| `int64` | `int64` | `string` | `int` | 64 ビット整数（JS では精度損失を避けるため string） |
| `float` | `float32` | `number` | `float` | 32 ビット浮動小数点 |
| `double` | `float64` | `number` | `float` | 64 ビット浮動小数点 |
| `bool` | `bool` | `boolean` | `bool` | 真偽値 |
| `string` | `string` | `string` | `str` | UTF-8 文字列 |
| `bytes` | `[]byte` | `Uint8Array` | `bytes` | 任意のバイナリデータ |

## Message 定義

```protobuf
syntax = "proto3";
package user;

// 列挙型
enum Role {
  ROLE_UNSPECIFIED = 0;  // proto3 では最初の値が 0 であることが必須
  ROLE_ADMIN = 1;
  ROLE_USER = 2;
}

// メッセージ
message User {
  int32 id = 1;           // フィールド番号（デフォルト値ではない）
  string name = 2;
  string email = 3;
  Role role = 4;
  repeated string tags = 5;       // 配列
  optional string bio = 6;        // オプションフィールド
  map<string, string> meta = 7;   // キーバリューペア
  Address address = 8;            // ネストされたメッセージ
}

message Address {
  string city = 1;
  string street = 2;
}
```

::: warning フィールド番号は永続的な識別子

フィールド番号（`= 1`、`= 2`）は protobuf バイナリエンコーディングの key であり、リリース後は**変更不可**。フィールドを削除した場合は `reserved` でその番号の再利用を禁止すべきである：

```protobuf
message User {
  reserved 3;          // 番号 3 は廃止済み、再利用禁止
  reserved "email";    // フィールド名も reserved 可能
  int32 id = 1;
  string name = 2;
  // string email = 3; ← 削除済み
}
```

:::

## Service 定義

Service は RPC インターフェースを定義するためのもので、[gRPC](/ja/programming/web-backend/grpc/) 等のフレームワークで使用する：

```protobuf
service UserService {
  rpc GetUser(GetUserRequest) returns (User);
  rpc CreateUser(CreateUserRequest) returns (User);
  rpc ListUsers(ListUsersRequest) returns (stream User);
}

message GetUserRequest {
  int32 id = 1;
}

message CreateUserRequest {
  string name = 1;
  string email = 2;
}

message ListUsersRequest {
  int32 page = 1;
  int32 page_size = 2;
}
```

コンパイル時に対応する gRPC プラグインを使用すると、サーバー側インターフェースとクライアント Stub のコードが追加で生成される（[詳細](/ja/programming/web-backend/grpc/#基本的な使い方)）
