# フロントエンドセキュリティ

> Web Security

## 一般的な攻撃と防御

| 攻撃 | 一言説明 | 主な防御 |
| --- | --- | --- |
| XSS | 悪意のあるスクリプトをページに注入して実行 | [詳細](#xss) |
| CSRF | ログイン済みユーザーのリクエストを偽造 | [詳細](#csrf) |
| CORS | ブラウザのクロスオリジン制限（攻撃ではなく防御機構） | [詳細](#cors) |
| クリックジャッキング | 透明なiframeでページを覆い、クリックを誘導 | `X-Frame-Options: DENY` |

---

## XSS

> Cross-Site Scripting -- 悪意のあるスクリプトの注入

攻撃者が悪意のあるJavaScriptをページに注入し、Cookie、Sessionを窃取し、リクエストを送信する

### 3つのタイプ

| タイプ | 注入場所 | 例 |
| --- | --- | --- |
| **格納型** | データベース（コメント、ニックネーム） | 攻撃者がコメントに `<script>steal()</script>` を書き、他のユーザーがコメントを見た時に実行される |
| **反射型** | URLパラメータ | `https://site.com/search?q=<script>alert(1)</script>` |
| **DOM型** | クライアントサイドJS | `element.innerHTML = userInput`、JSがユーザー入力を直接DOMに挿入 |

---

### 防御

**1. `innerHTML` / `dangerouslySetInnerHTML` を使わない**

```tsx
// ❌ 直接插入用户输入
element.innerHTML = userInput;
<div dangerouslySetInnerHTML={{ __html: userInput }} />

// ✅ React 默认转义——直接渲染文本是安全的
<div>{userInput}</div>  // <script> 会被转义为文本，不会执行
```

**2. `dangerouslySetInnerHTML` を使う必要がある場合、先にサニタイズする**

```ts
import DOMPurify from "dompurify";

// 消毒：保留安全的 HTML 标签，移除 script/事件处理器
const clean = DOMPurify.sanitize(userInput);
<div dangerouslySetInnerHTML={{ __html: clean }} />
```

**3. CSP（Content Security Policy）――ブラウザレベルの最後の防衛線**

```
Content-Security-Policy: default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'
```

CSPはブラウザに指定されたソースからのスクリプトのみ実行するよう指示する――XSSが `<script>` の注入に成功しても、ブラウザは実行しない

::: warning React における XSS のリスクポイント

ReactのJSXはデフォルトですべてのコンテンツをエスケープするが、以下の箇所にはリスクが残る：

- `dangerouslySetInnerHTML`――名前自体が警告している
- `href={userInput}`――`javascript:alert(1)` プロトコルでスクリプトを実行できる
- `eval()`、`new Function()`――ユーザー入力に対して絶対に使用しない
- URLパラメータをAPIリクエストに連結――SSRFにつながる可能性

:::

---

## CSRF

> Cross-Site Request Forgery -- リクエストの偽造

ユーザーが銀行サイトAにログインし、CookieにSessionがある。攻撃者がユーザーを悪意のあるサイトBに誘導し、BがAへのリクエストを自動送信――ブラウザはAのCookieを自動的に付与する

```txt
用户已登录 bank.com（Cookie: session=abc123）
     │
     ▼ 访问恶意网站
evil.com 的页面中有:
<img src="https://bank.com/transfer?to=attacker&amount=10000" />
     │
     ▼ 浏览器自动带上 bank.com 的 Cookie
bank.com 收到请求，以为是用户本人操作
```

---

### 防御

**1. SameSite Cookie（最重要）**

```
Set-Cookie: session=abc123; SameSite=Lax; Secure; HttpOnly
```

| SameSite値 | 振る舞い |
| --- | --- |
| `Strict` | クロスサイトリクエストでは一切Cookieを送らない（最も安全だが、外部リンクからの遷移時にも送らない） |
| `Lax`（推奨） | クロスサイトGETナビゲーション（リンククリック）はCookieを送る、POST/Ajaxは送らない |
| `None` | クロスサイトを許可（`Secure` との併用が必須、HTTPSのみ） |

**2. CSRF Token**

サーバー側がフォームにランダムなtokenを埋め込み、送信時に検証する：

```tsx
<form method="POST" action="/transfer">
  <input type="hidden" name="_csrf" value={csrfToken} />
  <!-- 攻击者无法获取这个 token -->
</form>
```

**3. リクエストヘッダの検証**

`Origin` または `Referer` ヘッダが自分のドメインからのものかを検証する

---

## CORS

> Cross-Origin Resource Sharing -- ブラウザのクロスオリジンセキュリティ機構

ブラウザはJSのクロスオリジンリクエストを禁止する（異なるプロトコル/ドメイン/ポート = クロスオリジン）。CORSはサーバーがレスポンスヘッダで「どのオリジンからのアクセスを許可するか」をブラウザに伝える仕組み

```txt
前端: https://app.example.com
API:  https://api.example.com  ← 不同子域 = 跨域

浏览器发送预检请求（OPTIONS）:
→ Origin: https://app.example.com

服务端响应:
← Access-Control-Allow-Origin: https://app.example.com
← Access-Control-Allow-Methods: GET, POST, PUT
← Access-Control-Allow-Headers: Content-Type, Authorization
← Access-Control-Allow-Credentials: true
```

---

### よくある設定

```ts
// Express 示例
app.use(
  cors({
    origin: "https://app.example.com", // 不要用 *（配合 credentials 时不允许）
    credentials: true, // 允许带 Cookie
    methods: ["GET", "POST", "PUT", "DELETE"],
    allowedHeaders: ["Content-Type", "Authorization"],
  }),
);
```

::: warning CORS のよくある誤解

- CORSは**ブラウザの挙動**――Postman、curlには制限なし、サーバー間のリクエストも制限なし
- `Access-Control-Allow-Origin: *` は `credentials: true` と同時に使えない
- プリフライトリクエスト（OPTIONS）はブラウザが自動的に送信するもので、あなたのコードが送信するものではない
- シンプルリクエスト（GET、POST + form content-type）はプリフライト不要

:::

---

## Cookie セキュリティ

```
Set-Cookie: session=abc123;
  HttpOnly;        ← JS 无法访问（防 XSS 窃取）
  Secure;          ← 只在 HTTPS 传输
  SameSite=Lax;    ← 防 CSRF
  Path=/;
  Max-Age=86400;
```

| 属性 | 役割 |
| --- | --- |
| `HttpOnly` | JSの `document.cookie` で読み書き不可――XSSで窃取されない |
| `Secure` | HTTPS接続でのみ送信――中間者による盗聴を防止 |
| `SameSite` | クロスサイトリクエストでCookieを送るかを制御――CSRF防止 |

::: tip Token の保存場所

| 方法 | XSS安全 | CSRF安全 | 推奨シーン |
| --- | --- | --- | --- |
| HttpOnly Cookie | ✅（JSで読めない） | SameSiteが必要 | 従来型Webアプリ |
| localStorage | ❌（XSSで読み書き可能） | ✅（自動送信されない） | 機密tokenの保存は非推奨 |
| メモリ（変数/クロージャ） | ✅ | ✅ | SPA短期token |

**最も安全な方法**：Access Token はメモリに保存、Refresh Token は HttpOnly Cookie に保存

:::

---

## SPA 認証アーキテクチャ

### JWT 認証フロー

```txt
┌─────────┐                    ┌─────────┐
│ クライアント│                    │  サーバー  │
└────┬────┘                    └────┬────┘
     │                              │
     │  POST /login {email, pw}     │
     │ ───────────────────────────▶ │
     │                              │ 資格情報を検証
     │                              │ Access Token 生成（短期、15min）
     │                              │ Refresh Token 生成（長期、7d）
     │  Set-Cookie: refresh=xxx     │
     │  { accessToken: "yyy" }      │
     │ ◀─────────────────────────── │
     │                              │
     │  GET /api/data               │
     │  Authorization: Bearer yyy   │
     │ ───────────────────────────▶ │ Access Token を検証
     │  { data: ... }               │
     │ ◀─────────────────────────── │
     │                              │
     │ （Access Token 期限切れ後）     │
     │  POST /refresh               │
     │  Cookie: refresh=xxx         │
     │ ───────────────────────────▶ │ Refresh Token を検証
     │  { accessToken: "zzz" }      │ 新しい Access Token を発行
     │ ◀─────────────────────────── │
```

::: warning なぜ 2 つの Token を使うのか

- **Access Token**：短期（15 分）、メモリに保存、漏洩しても被害は限定的
- **Refresh Token**：長期（7 日）、HttpOnly Cookie に保存、`/refresh` エンドポイントにのみ送信
- 分離のメリット：Access Token は Cookie を使わない（CSRF 防止）、Refresh Token は JS からアクセス不可（XSS 防止）

:::

---

### Next.js での認証

```tsx
// middleware.ts — リクエストごとにチェック
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  const session = request.cookies.get("session")?.value;

  if (!session && request.nextUrl.pathname.startsWith("/dashboard")) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  // ここで JWT 署名の検証も可能（軽量な検証、DB アクセスなし）
  return NextResponse.next();
}
```

```tsx
// Server Component でユーザー情報を取得
import { cookies } from "next/headers";
import { verifyToken } from "@/lib/auth";

async function DashboardPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get("session")?.value;
  const user = await verifyToken(token); // サーバー側で検証

  if (!user) redirect("/login");

  return <Dashboard user={user} />;
}
```

```tsx
// Server Action で権限を検証
"use server";
import { cookies } from "next/headers";

export async function deletePost(postId: string) {
  const cookieStore = await cookies();
  const token = cookieStore.get("session")?.value;
  const user = await verifyToken(token);

  if (!user) throw new Error("Unauthorized");
  if (user.role !== "admin") throw new Error("Forbidden");

  await db.post.delete({ where: { id: postId } });
  revalidatePath("/posts");
}
```

::: tip SPA 認証の 3 層防御

| 層 | 責任 | 実装 |
| --- | --- | --- |
| **Middleware** | ルートレベルのインターセプト（未ログインはアクセス不可） | Cookie チェック、ログインページへリダイレクト |
| **Server Component** | ページレベルのデータ取得（現在のユーザーを取得） | `cookies()` + token 検証 |
| **Server Action** | 操作レベルの権限検証（削除できるか） | token 検証 + ロールチェック |

各層が独立して検証する——Middleware だけに頼らず、Server Action も必ず独自に検証する（誰でも直接呼び出せるため）

:::
