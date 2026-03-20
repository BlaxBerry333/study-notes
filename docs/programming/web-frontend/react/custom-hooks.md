# 实用自定义 Hooks

> Custom Hooks

## useMediaQuery

> 响应式断点检测 — CSS media query 在 JS 逻辑分支中的替代方案

CSS media query 只能控制样式，但条件渲染、不同断点加载不同数据、移动端和桌面端走不同交互逻辑——这些需要在 JS 中判断断点。用 `matchMedia` API 而非轮询 `window.innerWidth`，性能好且能响应系统级变化（如暗色模式）

::: code-group

```tsx [使用例子]
function ProductList() {
  const isMobile = useMediaQuery("(max-width: 768px)");
  const prefersDark = useMediaQuery("(prefers-color-scheme: dark)");

  // 移动端只加载缩略图，桌面端加载完整卡片
  if (isMobile) {
    return <CompactList />;
  }

  return <FullCardGrid theme={prefersDark ? "dark" : "light"} />;
}

function Dashboard() {
  const isWide = useMediaQuery("(min-width: 1200px)");

  return (
    <div>
      {/* 宽屏显示侧边栏，窄屏用底部导航 */}
      {isWide ? <Sidebar /> : <BottomNav />}
      <MainContent />
    </div>
  );
}
```

```ts [实现代码]
import { useState, useEffect, useCallback } from "react";

function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() => {
    // SSR 环境下无 window，默认返回 false
    if (typeof window === "undefined") return false;
    return window.matchMedia(query).matches;
  });

  const handleChange = useCallback(
    (e: MediaQueryListEvent) => setMatches(e.matches),
    [],
  );

  useEffect(() => {
    const mql = window.matchMedia(query);
    setMatches(mql.matches); // query 变化时同步当前状态
    mql.addEventListener("change", handleChange);
    return () => mql.removeEventListener("change", handleChange);
  }, [query, handleChange]);

  return matches;
}
```

:::

::: tip

- **该用的场景**：JS 中需要根据视口/系统偏好做条件分支（渲染不同组件、加载不同数据、切换交互模式）
- **不该用的场景**：纯样式响应式直接用 CSS media query，不要为了隐藏一个元素就引入 JS 判断
- **为什么用 `matchMedia` 而不是监听 `resize`**：`matchMedia` 是浏览器原生的断点匹配机制，只在跨越断点时触发回调，而 `resize` 每像素都触发，需要自己加防抖还不精确
- SSR 兼容：初始值在服务端返回 `false`，客户端 hydrate 后立即修正——对 SEO 关键内容建议用 CSS 方案

:::

---

## useIntersectionObserver

> 元素可见性检测 — 无限滚动、曝光埋点、懒加载的现代方案

`scroll` 事件 + `getBoundingClientRect` 在主线程上跑，列表长了就卡。`IntersectionObserver` 是浏览器级别的异步检测，但原生 API 需要手动管理 observer 的创建和销毁，封装成 Hook 后变成声明式

::: code-group

```tsx [使用例子]
// 无限滚动：触底加载更多
function InfiniteList() {
  const [items, setItems] = useState<Item[]>([]);
  const sentinelRef = useRef<HTMLDivElement>(null);

  const entry = useIntersectionObserver(sentinelRef, {
    rootMargin: "200px", // 提前 200px 触发，用户感知不到加载
  });

  useEffect(() => {
    if (entry?.isIntersecting) {
      loadMoreItems().then((newItems) =>
        setItems((prev) => [...prev, ...newItems]),
      );
    }
  }, [entry?.isIntersecting]);

  return (
    <div>
      {items.map((item) => (
        <Card key={item.id} item={item} />
      ))}
      <div ref={sentinelRef} /> {/* 哨兵元素 */}
    </div>
  );
}

// 曝光埋点：元素进入视口时上报
function TrackableSection({
  id,
  children,
}: {
  id: string;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const entry = useIntersectionObserver(ref, { threshold: 0.5 });
  const reported = useRef(false);

  useEffect(() => {
    if (entry?.isIntersecting && !reported.current) {
      reported.current = true;
      analytics.track("section_viewed", { id });
    }
  }, [entry?.isIntersecting, id]);

  return <div ref={ref}>{children}</div>;
}
```

```ts [实现代码]
import { useState, useEffect, type RefObject } from "react";

interface UseIntersectionOptions {
  threshold?: number | number[];
  rootMargin?: string;
  root?: Element | null;
}

function useIntersectionObserver(
  ref: RefObject<Element | null>,
  options: UseIntersectionOptions = {},
): IntersectionObserverEntry | null {
  const [entry, setEntry] = useState<IntersectionObserverEntry | null>(null);

  const { threshold = 0, rootMargin = "0px", root = null } = options;

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([observedEntry]) => setEntry(observedEntry),
      { threshold, rootMargin, root },
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [ref, threshold, rootMargin, root]);

  return entry;
}
```

:::

::: tip

- **该用的场景**：无限滚动、曝光埋点、图片/组件懒加载、滚动动画入场
- **不该用的场景**：只是想知道页面滚动了多少像素（用 `scroll` 事件）；需要精确的像素级位置（用 `getBoundingClientRect`）
- **`rootMargin` 很关键**：设为正值可以提前触发（预加载），负值可以延迟触发（元素进入视口一定距离后才算可见）
- **`threshold`**：`0` 表示只要露出一个像素就触发，`0.5` 表示可见 50% 才触发，`1` 表示完全可见——根据业务需求选择

:::

---

## useAbortController

> 请求取消管理 — 自动跟随组件生命周期的 AbortSignal

组件卸载时取消进行中的 fetch 是基本卫生，快速切换页面时取消旧请求防止竞态也是。手动管理 `AbortController` 很繁琐（创建、传 signal、catch AbortError、清理），这个 Hook 专注做一件事：给你一个自动管理生命周期的 signal

::: code-group

```tsx [使用例子]
function UserProfile({ userId }: { userId: string }) {
  const [user, setUser] = useState<User | null>(null);
  const getSignal = useAbortController();

  useEffect(() => {
    // getSignal() 每次调用都会 abort 上一个 controller
    // 快速切换 userId 时，旧请求自动取消
    const signal = getSignal();

    fetch(`/api/users/${userId}`, { signal })
      .then((res) => res.json())
      .then(setUser)
      .catch((err) => {
        if (!signal.aborted) console.error(err); // 只处理非取消错误
      });
  }, [userId, getSignal]);

  return user ? <div>{user.name}</div> : <div>加载中...</div>;
}

// 配合手动触发的请求
function SearchPanel() {
  const [results, setResults] = useState<Result[]>([]);
  const getSignal = useAbortController();

  const handleSearch = async (query: string) => {
    const signal = getSignal(); // 自动取消上一次搜索

    const res = await fetch(`/api/search?q=${query}`, { signal });
    if (!signal.aborted) {
      setResults(await res.json());
    }
  };

  return (
    <div>
      <input onChange={(e) => handleSearch(e.target.value)} />
      {results.map((r) => (
        <div key={r.id}>{r.title}</div>
      ))}
    </div>
  );
}
```

```ts [实现代码]
import { useRef, useCallback, useEffect } from "react";

function useAbortController(): () => AbortSignal {
  const controllerRef = useRef<AbortController | null>(null);

  // 组件卸载时 abort
  useEffect(() => {
    return () => controllerRef.current?.abort();
  }, []);

  const getSignal = useCallback((): AbortSignal => {
    // 每次调用先 abort 上一个（处理竞态）
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;
    return controller.signal;
  }, []);

  return getSignal;
}
```

:::

::: tip

- **该用的场景**：组件内发 fetch 请求、快速切换导致的竞态（搜索输入、tab 切换、路由跳转）
- **不该用的场景**：如果你已经在用 TanStack Query / SWR / useRequest 等请求库，它们内部已经处理了取消和竞态
- **为什么返回函数而不是 signal**：因为需要在每次新请求时创建新的 controller 并 abort 旧的。如果直接返回 signal，就无法实现"新请求自动取消旧请求"的竞态控制
- **AbortError 的处理**：`fetch` 被 abort 后会 reject 一个 `AbortError`，通过 `signal.aborted` 判断是否是主动取消，避免把取消当错误处理

:::

---

## useOptimisticUpdate

> 乐观更新 — 先改 UI 再发请求，失败时回滚

点赞、收藏、todo 勾选这类操作，等服务端返回再更新 UI 会有明显延迟。乐观更新先用预期结果更新界面，请求成功后用服务端数据覆盖，失败则回滚到操作前的状态。React 19 有了内置的 `useOptimistic`，但 React 18 项目需要自己实现，而且理解其原理对掌握这个模式很重要

::: code-group

```tsx [使用例子]
function LikeButton({
  postId,
  initialCount,
  initialLiked,
}: {
  postId: string;
  initialCount: number;
  initialLiked: boolean;
}) {
  const [likeState, updateOptimistic, { rollback, confirm }] =
    useOptimisticUpdate({
      count: initialCount,
      liked: initialLiked,
    });

  const handleToggleLike = async () => {
    const nextLiked = !likeState.liked;
    const nextCount = likeState.count + (nextLiked ? 1 : -1);

    // 立即更新 UI（首次调用时保存快照）
    updateOptimistic({ liked: nextLiked, count: nextCount });

    try {
      // 发送请求，用服务端返回值覆盖（不会覆盖快照）
      const serverState = await toggleLike(postId);
      updateOptimistic(serverState); // 用真实数据修正
      confirm(); // 标记这轮乐观更新完成
    } catch {
      rollback(); // 失败回滚到快照
    }
  };

  return (
    <button onClick={handleToggleLike}>
      {likeState.liked ? "❤️" : "🤍"} {likeState.count}
    </button>
  );
}

function TodoItem({ todo }: { todo: Todo }) {
  const [state, updateOptimistic, { rollback, confirm }] =
    useOptimisticUpdate(todo);

  const handleToggle = async () => {
    updateOptimistic({ ...state, completed: !state.completed });

    try {
      await updateTodo(todo.id, { completed: !todo.completed });
      confirm();
    } catch {
      rollback();
    }
  };

  return (
    <li style={{ opacity: state.completed ? 0.5 : 1 }}>
      <input
        type="checkbox"
        checked={state.completed}
        onChange={handleToggle}
      />
      {state.text}
    </li>
  );
}
```

```ts [实现代码]
import { useState, useRef, useCallback } from "react";

function useOptimisticUpdate<T>(initialState: T) {
  const [state, setState] = useState(initialState);
  const snapshotRef = useRef(initialState);
  const isPendingRef = useRef(false);

  const updateOptimistic = useCallback((next: T) => {
    setState((prev) => {
      if (!isPendingRef.current) {
        // 只在首次乐观更新时保存快照，连续调用不覆盖
        snapshotRef.current = prev;
        isPendingRef.current = true;
      }
      return next;
    });
  }, []);

  const rollback = useCallback(() => {
    isPendingRef.current = false;
    setState(snapshotRef.current);
  }, []);

  const confirm = useCallback(() => {
    isPendingRef.current = false;
  }, []);

  return [state, updateOptimistic, { rollback, confirm }] as const;
}
```

:::

::: tip

- **该用的场景**：用户操作后需要即时反馈的场景——点赞、收藏、拖拽排序、todo 勾选、快速编辑
- **不该用的场景**：操作失败代价高（支付、删除不可恢复的数据）——这些应该等服务端确认后再更新 UI
- **React 19 的 `useOptimistic`**：内置方案与 Transition 深度集成，如果你的项目用 React 19 + Server Actions，优先用内置版本
- **快照策略**：`snapshotRef` 保存的是首次乐观更新前的状态。`isPendingRef` 确保连续快速操作（如用户快速点两次赞）不会覆盖快照，rollback 始终能回到真正的原始状态。服务端成功后调用 `confirm()` 重置 pending 标记，为下一轮乐观更新做准备；失败则调用 `rollback()` 恢复快照并重置标记
- **`updateOptimistic` 引用稳定**：通过 `setState(prev => ...)` 的函数形式获取当前值，避免了对 `state` 的闭包依赖，依赖数组为空，函数引用不会因 state 变化而重建

:::

---

## useFormField

> 单字段表单状态管理 — 值 + 校验 + 错误 + touched 的最小单元

不是要造 react-hook-form，而是处理"一个字段"的完整生命周期。在设置页、搜索筛选、简单弹窗表单这些不值得引入重型表单库的场景中，这个 Hook 管理了值、校验、错误信息和 touched 状态（只在用户交互过后才显示错误，而不是一打开表单就满屏红字）

::: code-group

```tsx [使用例子]
function SettingsPage() {
  const username = useFormField("", (value) => {
    if (!value.trim()) return "用户名不能为空";
    if (value.length < 3) return "至少 3 个字符";
    if (!/^[a-zA-Z0-9_]+$/.test(value)) return "只能包含字母、数字和下划线";
    return null;
  });

  const email = useFormField("", (value) => {
    if (!value.trim()) return "邮箱不能为空";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return "邮箱格式不对";
    return null;
  });

  const handleSubmit = () => {
    // 触发所有字段的 touched 状态，显示校验错误
    username.touch();
    email.touch();

    if (!username.error && !email.error) {
      saveSettings({ username: username.value, email: email.value });
    }
  };

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        handleSubmit();
      }}
    >
      <div>
        <input {...username.inputProps} placeholder="用户名" />
        {username.showError && <span className="error">{username.error}</span>}
      </div>
      <div>
        <input {...email.inputProps} type="email" placeholder="邮箱" />
        {email.showError && <span className="error">{email.error}</span>}
      </div>
      <button type="submit">保存</button>
    </form>
  );
}
```

```ts [实现代码]
import { useState, useMemo, useCallback } from "react";

type Validator = (value: string) => string | null;

function useFormField(initialValue: string, validate?: Validator) {
  const [value, setValue] = useState(initialValue);
  const [touched, setTouched] = useState(false);

  const error = useMemo(() => validate?.(value) ?? null, [value, validate]);

  // 只在 touched 后才显示错误
  const showError = touched && error !== null;

  const touch = useCallback(() => setTouched(true), []);
  const reset = useCallback(() => {
    setValue(initialValue);
    setTouched(false);
  }, [initialValue]);

  // 直接展开到 input 上
  const inputProps = useMemo(
    () => ({
      value,
      onChange: (e: React.ChangeEvent<HTMLInputElement>) =>
        setValue(e.target.value),
      onBlur: () => setTouched(true),
    }),
    [value],
  );

  return { value, error, touched, showError, inputProps, touch, reset };
}
```

:::

::: tip

- **该用的场景**：设置页面、搜索筛选、简单弹窗里的 2-3 个字段——不值得引入 react-hook-form 的轻量场景
- **不该用的场景**：复杂表单（10+ 字段、嵌套结构、动态字段、字段联动）——这些请直接用 react-hook-form 或 Formik
- **touched 的意义**：用户没操作过的字段不应该显示错误。`onBlur` 时标记 touched，提交时通过 `touch()` 强制显示所有错误
- **`inputProps` 模式**：返回一个可以直接展开到 `<input>` 的对象，减少样板代码。同样的模式在 Formik 的 `getFieldProps` 和 Downshift 的 `getInputProps` 中都能见到
- **`validate` 依赖稳定性**：`validate` 函数如果在组件中内联定义，每次 render 都是新引用，`useMemo` 会重复执行。校验逻辑本身很轻所以不影响性能，但如果校验函数有副作用（不应该有），需要用 `useCallback` 稳定引用

:::

---

## useStateWithHistory

> 带撤销/重做的状态 — 维护状态历史栈

富文本编辑器、画板、多步表单向导、可视化配置——这些场景用户期望能 Ctrl+Z。不是简单的 `useState`，而是维护一个历史栈和指针，支持 undo、redo、跳转到任意历史位置

::: code-group

```tsx [使用例子]
function DrawingCanvas() {
  const [color, setColor, { undo, redo, canUndo, canRedo }] =
    useStateWithHistory("#000000");

  return (
    <div>
      <input
        type="color"
        value={color}
        onChange={(e) => setColor(e.target.value)}
      />
      <button disabled={!canUndo} onClick={undo}>
        撤销
      </button>
      <button disabled={!canRedo} onClick={redo}>
        重做
      </button>
      <Canvas brushColor={color} />
    </div>
  );
}

function FormWizard() {
  const [step, setStep, { undo: goBack, canUndo: canGoBack, history }] =
    useStateWithHistory(0, { maxHistory: 20 });

  const steps = [<StepOne />, <StepTwo />, <StepThree />];

  return (
    <div>
      <div>
        步骤 {step + 1} / {steps.length}（已访问 {history.length} 步）
      </div>
      {steps[step]}
      <button disabled={!canGoBack} onClick={goBack}>
        上一步
      </button>
      <button
        disabled={step >= steps.length - 1}
        onClick={() => setStep(step + 1)}
      >
        下一步
      </button>
    </div>
  );
}
```

```ts [实现代码]
import { useState, useCallback, useRef } from "react";

interface HistoryOptions {
  maxHistory?: number;
}

interface HistoryControls {
  undo: () => void;
  redo: () => void;
  go: (index: number) => void;
  canUndo: boolean;
  canRedo: boolean;
  history: readonly unknown[];
}

function useStateWithHistory<T>(
  initialValue: T,
  options: HistoryOptions = {},
): [T, (value: T) => void, HistoryControls] {
  const { maxHistory = 50 } = options;
  const [state, setStateRaw] = useState(initialValue);
  const [pointer, setPointer] = useState(0);

  // 历史栈用 ref（内容变化不需要 re-render），指针用 state（指针变化需要更新 canUndo/canRedo）
  const historyRef = useRef<T[]>([initialValue]);

  const setState = useCallback(
    (value: T) => {
      const history = historyRef.current;

      setPointer((prevPointer) => {
        // 新操作时丢弃 pointer 之后的"未来"记录
        const newHistory = history.slice(0, prevPointer + 1);
        newHistory.push(value);

        // 超出上限时移除最早的记录
        if (newHistory.length > maxHistory) {
          newHistory.shift();
        }

        historyRef.current = newHistory;
        return newHistory.length - 1;
      });
      setStateRaw(value);
    },
    [maxHistory],
  );

  const undo = useCallback(() => {
    setPointer((prev) => {
      if (prev <= 0) return prev;
      const newPointer = prev - 1;
      setStateRaw(historyRef.current[newPointer]);
      return newPointer;
    });
  }, []);

  const redo = useCallback(() => {
    setPointer((prev) => {
      if (prev >= historyRef.current.length - 1) return prev;
      const newPointer = prev + 1;
      setStateRaw(historyRef.current[newPointer]);
      return newPointer;
    });
  }, []);

  const go = useCallback((index: number) => {
    setPointer(() => {
      const clamped = Math.max(
        0,
        Math.min(index, historyRef.current.length - 1),
      );
      setStateRaw(historyRef.current[clamped]);
      return clamped;
    });
  }, []);

  return [
    state,
    setState,
    {
      undo,
      redo,
      go,
      canUndo: pointer > 0,
      canRedo: pointer < historyRef.current.length - 1,
      history: historyRef.current,
    },
  ];
}
```

:::

::: tip

- **该用的场景**：任何需要 undo/redo 的交互——编辑器、画板、可视化配置器、多步表单的"上一步"
- **不该用的场景**：简单的状态切换（开关、tab）——没有撤销需求就不要白白维护历史栈
- **`maxHistory` 防内存泄漏**：默认上限 50 条。如果状态是大对象（如画布数据），应该设小一些或考虑只存 diff 而非完整快照
- **为什么历史栈用 ref、指针用 state**：历史栈的内容变化不需要触发 re-render，用 ref 存储避免不必要的渲染。但指针（pointer）必须用 state，因为 `canUndo`/`canRedo` 依赖指针位置来判断——如果指针也用 ref，当 undo 到底部时 state 值没变（React bailout 优化），`canUndo` 就不会从 true 变为 false，按钮状态会卡住

:::
