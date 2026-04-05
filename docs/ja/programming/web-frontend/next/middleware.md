# Middleware

> リクエストがページに到達する前にインターセプト——認証、リダイレクト、国際化、A/B テスト

## 基本的な使い方

Middleware ファイルはプロジェクトルートディレクトリ（`app/` と同じ階層）に配置し、マッチするリクエストに対して自動的に実行される：

```ts
// middleware.ts
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  // 检查鉴权
  const token = request.cookies.get("session")?.value;

  if (!token && request.nextUrl.pathname.startsWith("/dashboard")) {
    // 未登录访问 dashboard → 重定向到登录页
    return NextResponse.redirect(new URL("/login", request.url));
  }

  return NextResponse.next(); // 放行
}

// 配置匹配路径
export const config = {
  matcher: ["/dashboard/:path*", "/api/:path*"],
};
```

---

## よくある用途

### 認証

```ts
export function middleware(request: NextRequest) {
  const token = request.cookies.get("session")?.value;

  // 保护路由
  const protectedPaths = ["/dashboard", "/settings", "/admin"];
  const isProtected = protectedPaths.some((path) =>
    request.nextUrl.pathname.startsWith(path),
  );

  if (isProtected && !token) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("from", request.nextUrl.pathname); // 记录来源
    return NextResponse.redirect(loginUrl);
  }

  // 已登录不让访问登录页
  if (token && request.nextUrl.pathname === "/login") {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  return NextResponse.next();
}
```

---

### 国際化

```ts
import Negotiator from "negotiator";

const locales = ["zh-CN", "ja", "en"];
const defaultLocale = "zh-CN";

function getLocale(request: NextRequest): string {
  const negotiator = new Negotiator({
    headers: { "accept-language": request.headers.get("accept-language") ?? "" },
  });
  return negotiator.language(locales) ?? defaultLocale;
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // 检查 URL 是否已包含 locale
  const hasLocale = locales.some(
    (locale) => pathname.startsWith(`/${locale}/`) || pathname === `/${locale}`,
  );

  if (!hasLocale) {
    const locale = getLocale(request);
    return NextResponse.redirect(new URL(`/${locale}${pathname}`, request.url));
  }

  return NextResponse.next();
}
```

---

### リクエストヘッダーの追加

```ts
export function middleware(request: NextRequest) {
  const response = NextResponse.next();

  // 安全头
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("X-Content-Type-Options", "nosniff");

  // 请求 ID（用于日志追踪）
  response.headers.set("X-Request-Id", crypto.randomUUID());

  return response;
}
```

::: warning Middleware の制限

- **Edge Runtime** で実行される——Node.js ネイティブ API（`fs`、`path` など）は使用できない
- データベースにアクセスできない（外部 API の呼び出しや JWT の検証は可能）
- リクエストごとに実行される——軽量に保ち、重い計算を避ける
- `config.matcher` でマッチ範囲を制限し、静的アセットに対しても Middleware が実行されることを避ける

:::
