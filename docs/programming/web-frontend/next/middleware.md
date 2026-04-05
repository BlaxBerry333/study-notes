# Middleware

> 在请求到达页面之前拦截——鉴权、重定向、国际化、A/B 测试

## 基本用法

Middleware 文件放在项目根目录（与 `app/` 同级），对匹配的请求自动运行：

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

## 常见用途

### 鉴权

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

### 国际化

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

### 添加请求头

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

::: warning Middleware 的限制

- 运行在 **Edge Runtime**——不能使用 Node.js 原生 API（`fs`、`path` 等）
- 不能访问数据库（可以调用外部 API 或验证 JWT）
- 每个请求都会执行——保持轻量，避免重计算
- 用 `config.matcher` 限制匹配范围，避免对静态资源也运行 Middleware

:::
