---
prev: false
next: false
---

# tRPC

tRPC はエンドツーエンドの API データ転送フレームワークであり、TypeScript によって型安全を保証する

::: warning 特徴:

- エンドツーエンドの型安全：サーバー側でインターフェースを変更すると、クライアント側に即座に型情報が反映される。codegen や Schema 定義は不要
- クライアントからサーバー側の Procedure をローカル関数のように呼び出せる。HTTP メソッドやパスの定義は不要
- 同一ページ内の複数の tRPC リクエストが自動的に1つの HTTP リクエストに統合される（batching）。GraphQL の単一エンドポイントとは異なり、GraphQL はクエリ言語レベルでの統合（1つの query で複数の型からデータを取得）であるのに対し、tRPC はトランスポートレベルでの統合（独立した Procedure の HTTP リクエストが自動統合される）である
- TanStack Query と深く統合されており、キャッシュ、楽観的更新、無限スクロール等の機能をすぐに利用可能
:::

::: danger 制限事項:

- **TypeScript 限定**：フロントエンド・バックエンドともに TypeScript が必須。非 TS クライアント（モバイルネイティブ、サードパーティ）には提供不可
- **フロントエンドとバックエンドが強く結合**：サーバー側の型変更がクライアントに直接伝播するため、同一チームでの開発に適しており、外部向け API には不向き
- **エコシステムが小さい**：REST / GraphQL と比較して、コミュニティのツール、ミドルウェア、ドキュメントリソースが限られている
- **デバッグしにくい**：デフォルトで SuperJSON シリアライズを使用し（`Date`、`Map` 等の型をサポート）、batching によるレスポンス統合も加わるため、ブラウザ DevTools の Network パネルではリクエストとレスポンスの内容がほぼ読めない。tRPC Panel や一時的に `httpLink` に切り替えて個別リクエストにすることでデバッグ可能
:::

::: info 適用場面
TypeScript フルスタックプロジェクト、フロントエンドとバックエンドが同一チームまたは monorepo、最速の開発スピードとゼロ設定の型安全を追求する場合
:::

```txt
┏━━━━━━━━ REST API Client ━━━━━┓ ┏━━━━━━━━━━━━ REST API Server ━━━━━━━━━━━━━━┓
┃                              ┃ ┃                                           ┃
┃ axios.get("/api/user")      ━━━━  GET  ━━━▶ /api/user   ━━▶ getUserList    ┃
┃ axios.get("/api/user/1")    ━━━━  GET  ━━━▶ /api/user/1 ━━▶ getUserById    ┃
┃ axios.post("/api/user")     ━━━━  POST ━━━▶ /api/user   ━━▶ createUser     ┃
┃ axios.put("/api/user/1")    ━━━━  PUT  ━━━▶ /api/user/1 ━━▶ updateUserById ┃
┃ axios.delete("/api/user/1") ━━━━ DELETE ━━▶ /api/user/1 ━━▶ deleteUserById ┃
┃                              ┃ ┃                                           ┃
┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛ ┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛


┏━━━━━━━━━ tRPC Client ━━━━━━━━┓ ┏━━━━━━━━━━━━━ tRPC Server ━━━━━━━━━━━━━━━━━┓
┃                              ┃ ┃                                           ┃
┃ trpcClient.getUserList     ━━━━━━━━━━━━▶   getUserList                     ┃
┃ trpcClient.getUserById     ━━━━━━━━━━━━▶   getUserById                     ┃
┃ trpcClient.createUser      ━━━━━━━━━━━━▶   createUser                      ┃
┃ trpcClient.updateUserById  ━━━━━━━━━━━━▶   updateUserById                  ┃
┃ trpcClient.deleteUserById  ━━━━━━━━━━━━▶   deleteUserById                  ┃
┃                              ┃ ┃                                           ┃
┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛ ┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛
```

## 基本概念

| 概念                 | 一言での説明                                             | 詳細                                                         |
| -------------------- | -------------------------------------------------------- | ------------------------------------------------------------ |
| Router（ルーター）   | すべての API エンドポイントを整理・登録するコンテナ       | [詳細](/ja/programming/web-backend/trpc/sample-next#ルーター) |
| Procedure（プロシージャ） | 個々の API エンドポイント。query（クエリ）と mutation（変更）に分かれる | [詳細](/ja/programming/web-backend/trpc/sample-next#プロシージャ) |
| Context（コンテキスト） | 各リクエストで共有されるデータ（db、session 等）          | [詳細](/ja/programming/web-backend/trpc/sample-next#コンテキスト) |
| Client（クライアントオブジェクト） | サーバー側の Procedure を呼び出す型安全なプロキシ         | [詳細](/ja/programming/web-backend/trpc/sample-next#クライアントオブジェクト) |

## 型推論の仕組み

tRPC は codegen 不要、Schema ファイル不要——**型はサーバー側のコードからクライアントに直接推論される**

```txt
GraphQL:  Schema (.graphql) → codegen → TS 型を生成 → クライアントで使用
tRPC:     サーバーコード → TypeScript コンパイラが直接推論 → クライアントが自動的に型を取得
```

コアメカニズム：

::: code-group

```ts [サーバー側]
// procedure を定義
const appRouter = router({
  getUser: publicProcedure
    .input(z.object({ id: z.string() }))  // Zod schema で入力を定義
    .query(async ({ input }) => {
      return db.user.findUnique({ where: { id: input.id } });
      // 戻り値の型 = Prisma が推論した User | null
    }),
});

// ルーターの型をエクスポート（型のみ、ランタイムコードはエクスポートしない）
export type AppRouter = typeof appRouter;
```

```ts [クライアント側]
// 型をインポート
import type { AppRouter } from "../server/router";

const trpc = createTRPCClient<AppRouter>({ ... });

// TS が自動推論：
// - trpc.getUser.query({ id: "1" }) の入力は { id: string } でなければならない
// - 戻り値の型は自動的に User | null
// - サーバー側でフィールド名を変更すると、クライアント側で即座に型エラーが発生
```

:::

::: tip なぜ codegen が不要か

- tRPC は TypeScript の `typeof` + ジェネリクス推論を活用——`AppRouter` 型には全 procedure の入出力型情報が含まれる
- `import type` はコンパイル時にのみ存在し、クライアントの JS にバンドルされない
- 前提条件：フロントエンドとバックエンドが同一の TypeScript プロジェクト（monorepo）内にある必要がある

:::

## ダウンロードとインストール

```zsh
% npm install @trpc/server @trpc/client zod
```

## 基本的な使い方

主に TypeScript で開発するフルスタックプロジェクトで使用する

まずサーバー側で Router（[詳細](/ja/programming/web-backend/trpc/sample-next#ルーター)）、Procedure（[詳細](/ja/programming/web-backend/trpc/sample-next#プロシージャ)）、Context（[詳細](/ja/programming/web-backend/trpc/sample-next#コンテキスト)）を定義する

次にクライアント側で Client オブジェクト（[詳細](/ja/programming/web-backend/trpc/sample-next#クライアントオブジェクト)）を通じて対応する Procedure を呼び出してデータ転送を行う
