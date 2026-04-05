# Vitest

> Viteネイティブテストフレームワーク――Jest API互換、すぐに使える、Viteと設定を共有

## インストール

```bash
npm install -D vitest @testing-library/react @testing-library/jest-dom @testing-library/user-event jsdom
```

```ts
// vitest.config.ts（或在 vite.config.ts 中配置）
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true, // 全局使用 describe/it/expect
    environment: "jsdom", // 模拟浏览器环境
    setupFiles: ["./src/test/setup.ts"],
    css: true,
  },
});
```

```ts
// src/test/setup.ts
import "@testing-library/jest-dom"; // 扩展 expect：toBeInTheDocument 等
```

---

## ユニットテスト

純粋関数、ユーティリティ――Reactコンポーネントを含まない：

```ts
// utils/format.ts
export function formatPrice(cents: number): string {
  return `¥${(cents / 100).toFixed(0)}`;
}

// utils/format.test.ts
import { describe, it, expect } from "vitest";
import { formatPrice } from "./format";

describe("formatPrice", () => {
  it("converts cents to yen", () => {
    expect(formatPrice(1000)).toBe("¥10");
    expect(formatPrice(9999)).toBe("¥100");
  });

  it("handles zero", () => {
    expect(formatPrice(0)).toBe("¥0");
  });

  it("handles negative values", () => {
    expect(formatPrice(-500)).toBe("¥-5");
  });
});
```

---

### Mock

```ts
import { describe, it, expect, vi } from "vitest";

// 函数 mock
const mockFn = vi.fn();
mockFn("arg1");
expect(mockFn).toHaveBeenCalledWith("arg1");
expect(mockFn).toHaveBeenCalledTimes(1);

// 返回值
const mockFetch = vi.fn().mockResolvedValue({ data: "ok" });

// 模块 mock
vi.mock("./api", () => ({
  fetchUser: vi.fn().mockResolvedValue({ name: "Alice" }),
}));

// spy：监视已有函数
const spy = vi.spyOn(console, "error").mockImplementation(() => {});
// ... 执行代码
expect(spy).toHaveBeenCalled();
spy.mockRestore();

// 计时器 mock
vi.useFakeTimers();
setTimeout(mockFn, 1000);
vi.advanceTimersByTime(1000);
expect(mockFn).toHaveBeenCalled();
vi.useRealTimers();
```

---

## コンポーネントテスト

Testing Libraryを使ってユーザー視点でReactコンポーネントをテストする：

### 基本的なレンダリングとアサーション

```tsx
import { render, screen } from "@testing-library/react";
import { UserProfile } from "./UserProfile";

describe("UserProfile", () => {
  it("displays user information", () => {
    render(<UserProfile name="Alice" email="alice@example.com" />);

    expect(
      screen.getByRole("heading", { name: "Alice" }),
    ).toBeInTheDocument();
    expect(screen.getByText("alice@example.com")).toBeInTheDocument();
  });

  it("shows default avatar when no image provided", () => {
    render(<UserProfile name="Alice" email="alice@example.com" />);
    expect(screen.getByRole("img")).toHaveAttribute("src", "/default.png");
  });
});
```

---

### ユーザーインタラクション

```tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Counter } from "./Counter";

describe("Counter", () => {
  it("increments on click", async () => {
    const user = userEvent.setup();
    render(<Counter />);

    expect(screen.getByText("0")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "+" }));
    expect(screen.getByText("1")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "+" }));
    expect(screen.getByText("2")).toBeInTheDocument();
  });
});
```

---

### フォームテスト

```tsx
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { LoginForm } from "./LoginForm";

describe("LoginForm", () => {
  it("submits form with valid data", async () => {
    const onSubmit = vi.fn();
    const user = userEvent.setup();
    render(<LoginForm onSubmit={onSubmit} />);

    await user.type(screen.getByLabelText("邮箱"), "alice@example.com");
    await user.type(screen.getByLabelText("密码"), "password123");
    await user.click(screen.getByRole("button", { name: "登录" }));

    expect(onSubmit).toHaveBeenCalledWith({
      email: "alice@example.com",
      password: "password123",
    });
  });

  it("shows validation error for empty email", async () => {
    const user = userEvent.setup();
    render(<LoginForm onSubmit={vi.fn()} />);

    await user.click(screen.getByRole("button", { name: "登录" }));

    expect(screen.getByText("邮箱不能为空")).toBeInTheDocument();
  });
});
```

---

### 非同期コンポーネントテスト

```tsx
import { render, screen, waitFor } from "@testing-library/react";
import { UserList } from "./UserList";

describe("UserList", () => {
  it("shows loading then data", async () => {
    render(<UserList />);

    // 先看到 loading 状态
    expect(screen.getByText("加载中...")).toBeInTheDocument();

    // 等待数据出现
    await waitFor(() => {
      expect(screen.getByText("Alice")).toBeInTheDocument();
    });

    // loading 消失
    expect(screen.queryByText("加载中...")).not.toBeInTheDocument();
  });
});
```

::: tip query vs get vs find

| プレフィックス | 見つからない時 | 非同期 | 使用ケース |
| --- | --- | --- | --- |
| `getBy` | エラーを投げる | いいえ | 要素が**存在する**ことを確認 |
| `queryBy` | `null` を返す | いいえ | 要素が**存在しない**ことを確認 |
| `findBy` | エラーを投げる | はい（待機） | 非同期要素の出現を待つ |

:::

---

## Hook テスト

```tsx
import { renderHook, act } from "@testing-library/react";
import { useCounter } from "./useCounter";

describe("useCounter", () => {
  it("increments and decrements", () => {
    const { result } = renderHook(() => useCounter(0));

    expect(result.current.count).toBe(0);

    act(() => {
      result.current.increment();
    });
    expect(result.current.count).toBe(1);

    act(() => {
      result.current.decrement();
    });
    expect(result.current.count).toBe(0);
  });
});
```

---

## MSW 統合

テスト内でMSWを使ってネットワークリクエストをインターセプトし、実際のAPIに依存しない（MSWの基本的な使い方は[詳細](/ja/programming/web-frontend/msw/)を参照）：

```ts
// src/test/mocks/handlers.ts
import { http, HttpResponse } from "msw";

export const handlers = [
  http.get("/api/users", () => {
    return HttpResponse.json([
      { id: "1", name: "Alice" },
      { id: "2", name: "Bob" },
    ]);
  }),

  http.post("/api/login", async ({ request }) => {
    const body = (await request.json()) as { email: string; password: string };
    if (body.email === "alice@example.com") {
      return HttpResponse.json({ token: "fake-token" });
    }
    return HttpResponse.json({ error: "Invalid" }, { status: 401 });
  }),
];
```

```ts
// src/test/mocks/server.ts
import { setupServer } from "msw/node";
import { handlers } from "./handlers";

export const server = setupServer(...handlers);
```

```ts
// src/test/setup.ts
import "@testing-library/jest-dom";
import { server } from "./mocks/server";

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());
```

```tsx
// 测试中覆盖特定 handler
import { server } from "../test/mocks/server";
import { http, HttpResponse } from "msw";

it("shows error when API fails", async () => {
  // 只在这个测试中让 /api/users 返回 500
  server.use(
    http.get("/api/users", () => {
      return HttpResponse.json({ error: "Server Error" }, { status: 500 });
    }),
  );

  render(<UserList />);

  await waitFor(() => {
    expect(screen.getByText("加载失败")).toBeInTheDocument();
  });
});
```

::: warning なぜmock fetchではなくMSWを使うのか

- `vi.mock("fetch")` や `vi.spyOn(global, "fetch")` はテストコード内でのmock――コンポーネントがaxiosや他のHTTPライブラリを使っていると、mockが効かなくなる
- MSWは**ネットワーク層**でインターセプト――コンポーネントがfetch、axios、GraphQL clientのどれを使っていてもインターセプトできる
- MSWのhandler定義は実際のAPIフォーマットと同じ――テストコードがより実際のシナリオに近い

:::
