# 状态管理

> State Management

## 方案选型

```txt
┌─────────────────────────────────────────────────────────────┐
│                    状态管理方案选型                           │
├──────────────────┬──────────────────────────────────────────┤
│  组件内局部状态    │  useState / useReducer                  │
│                  │  大部分需求用这个就够了                     │
├──────────────────┼──────────────────────────────────────────┤
│  跨组件共享       │  Props 传递 → 状态提升                   │
│  （少量组件）      │  简单直接，2-3 层以内优先用              │
├──────────────────┼──────────────────────────────────────────┤
│  跨组件共享       │  Context + useReducer                   │
│  （低频更新）      │  主题、语言、鉴权等全局但不常变的数据      │
├──────────────────┼──────────────────────────────────────────┤
│  跨组件共享       │  Zustand / Jotai                        │
│  （高频更新）      │  表单、实时数据、频繁交互的 UI 状态       │
├──────────────────┼──────────────────────────────────────────┤
│  服务端数据       │  TanStack Query / SWR                   │
│                  │  API 缓存、请求去重、后台刷新              │
└──────────────────┴──────────────────────────────────────────┘
```

::: warning 最常见的过度设计

把所有状态都塞进全局 store 是 Redux 时代的惯性思维。现代 React 应该：

- 大部分状态用 `useState` 放在组件内——不要提前提升
- 服务端数据用 TanStack Query——不要手动管 loading/error/cache
- 只有真正的客户端全局状态（主题、鉴权、购物车）才需要全局 store

:::

---

## Context 的局限性

Context 适合**低频更新的全局数据**，但不适合高频更新的状态（[详见渲染优化](/programming/web-frontend/react/performance#context-性能陷阱)）：

```txt
Context value 变化
   → 所有消费该 Context 的组件 re-render
   → 即使只用了 value 的一部分
   → React.memo 也挡不住（Context 绕过 props 比较）
```

**Context 适合**：主题、语言、当前用户、权限——变化频率低，消费者少

**Context 不适合**：表单状态、列表筛选、实时数据——变化频率高，消费者多

---

## Zustand

> 轻量级状态管理——零样板、支持 selector 级精确订阅

### 基本用法

```ts
import { create } from "zustand";

// 定义 store
interface CounterStore {
  count: number;
  increment: () => void;
  decrement: () => void;
  reset: () => void;
}

const useCounterStore = create<CounterStore>((set) => ({
  count: 0,
  increment: () => set((state) => ({ count: state.count + 1 })),
  decrement: () => set((state) => ({ count: state.count - 1 })),
  reset: () => set({ count: 0 }),
}));
```

```tsx
// 使用：通过 selector 精确订阅
function Counter() {
  const count = useCounterStore((state) => state.count);
  const increment = useCounterStore((state) => state.increment);
  // count 变化时只有这个组件 re-render，其他消费者不受影响

  return <button onClick={increment}>{count}</button>;
}
```

---

### Selector 精确订阅

Zustand 最大的优势：组件只订阅自己需要的状态片段

```tsx
// ✅ 只订阅 username，其他状态变化时不 re-render
const username = useStore((state) => state.user.name);

// ✅ 派生数据也可以在 selector 中计算
const activeCount = useStore(
  (state) => state.items.filter((i) => i.active).length,
);

// ⚠️ 返回新对象时需要 shallow 比较
import { shallow } from "zustand/shallow";

const { name, email } = useStore(
  (state) => ({ name: state.user.name, email: state.user.email }),
  shallow, // 浅比较，避免每次返回新对象导致 re-render
);
```

---

### 异步操作

```ts
interface TodoStore {
  todos: Todo[];
  loading: boolean;
  error: string | null;
  fetchTodos: () => Promise<void>;
  addTodo: (title: string) => Promise<void>;
}

const useTodoStore = create<TodoStore>((set, get) => ({
  todos: [],
  loading: false,
  error: null,

  fetchTodos: async () => {
    set({ loading: true, error: null });
    try {
      const todos = await api.getTodos();
      set({ todos, loading: false });
    } catch (err) {
      set({ error: (err as Error).message, loading: false });
    }
  },

  addTodo: async (title) => {
    const newTodo = await api.createTodo({ title });
    set({ todos: [...get().todos, newTodo] });
  },
}));
```

---

### 中间件

```ts
import { create } from "zustand";
import { devtools, persist } from "zustand/middleware";
import { immer } from "zustand/middleware/immer";

const useStore = create<Store>()(
  devtools(
    persist(
      immer((set) => ({
        users: [],
        addUser: (user: User) =>
          set((state) => {
            state.users.push(user); // immer 允许"直接修改"
          }),
      })),
      { name: "app-store" }, // localStorage key
    ),
  ),
);
```

| 中间件 | 作用 |
| --- | --- |
| `devtools` | 接入 Redux DevTools，时间旅行调试 |
| `persist` | 自动持久化到 localStorage / sessionStorage |
| `immer` | 允许用可变语法写不可变更新 |

---

## Zustand vs Context vs Redux

| 维度 | Context | Zustand | Redux Toolkit |
| --- | --- | --- | --- |
| 包大小 | 0（React 内置） | ~1KB | ~11KB |
| 样板代码 | 中（Provider + Hook） | **极少** | 多（slice + store + Provider） |
| 精确订阅 | ❌（value 变 = 全部 re-render） | ✅（selector） | ✅（selector） |
| 异步 | 自己写 | 直接在 action 里 async | 需要 thunk / saga |
| DevTools | ❌ | ✅（devtools 中间件） | ✅（内置） |
| 适用规模 | 小型 / 低频 | 中小到大型 | 大型、团队需要强约束 |

::: tip 选择建议

- **默认用 Zustand**：零样板、精确订阅、异步原生支持——覆盖 95% 的场景
- **小项目 / 低频全局状态**：Context 够用就不引入额外依赖
- **大团队需要强约束**：Redux Toolkit 的 slice 模式和中间件生态更成熟
- **原子化状态（大量独立小状态）**：考虑 Jotai

:::

---

## 服务端状态 vs 客户端状态

::: warning 最重要的思维转变

大部分"全局状态"其实是**服务端数据的客户端缓存**——用户列表、商品信息、通知数——这些不应该放在 Zustand/Redux 里手动管理

```txt
❌ 传统做法
   fetch → setLoading(true) → setData(data) → setError(err)
   手动管理 loading/error/cache/refetch/去重/乐观更新...

✅ 现代做法
   TanStack Query 管服务端数据（缓存、去重、后台刷新、乐观更新）
   Zustand 只管纯客户端状态（UI 状态、用户偏好）
```

:::

```tsx
// TanStack Query：服务端数据
const { data: users, isLoading } = useQuery({
  queryKey: ["users"],
  queryFn: fetchUsers,
  staleTime: 5 * 60 * 1000, // 5 分钟内不重新请求
});

// Zustand：纯客户端状态
const sidebarOpen = useUIStore((s) => s.sidebarOpen);
const theme = useUIStore((s) => s.theme);
```
