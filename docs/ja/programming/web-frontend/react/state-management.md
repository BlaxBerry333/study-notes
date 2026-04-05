# 状態管理

> State Management

## 方針選定

```txt
┌─────────────────────────────────────────────────────────────┐
│                    状態管理方案選型                           │
├──────────────────┬──────────────────────────────────────────┤
│  組件内局部状態    │  useState / useReducer                  │
│                  │  大部分需求用這個就夠了                     │
├──────────────────┼──────────────────────────────────────────┤
│  跨組件共享       │  Props 傳遞 → 状態提升                   │
│  （少量組件）      │  簡単直接，2-3 層以内優先用              │
├──────────────────┼──────────────────────────────────────────┤
│  跨組件共享       │  Context + useReducer                   │
│  （低頻更新）      │  主題、語言、認証等全局但不常変的数據      │
├──────────────────┼──────────────────────────────────────────┤
│  跨組件共享       │  Zustand / Jotai                        │
│  （高頻更新）      │  表單、実時数據、頻繁交互的 UI 状態       │
├──────────────────┼──────────────────────────────────────────┤
│  服務端数據       │  TanStack Query / SWR                   │
│                  │  API 快取、請求去重、後台刷新              │
└──────────────────┴──────────────────────────────────────────┘
```

::: warning よくある過剰設計

すべての状態をグローバルstoreに入れるのはRedux時代の慣性思考。モダンReactでは：

- ほとんどの状態は `useState` でコンポーネント内に置く――先に持ち上げない
- サーバーデータはTanStack Queryを使う――loading/error/cacheを手動管理しない
- 本当にクライアントサイドのグローバル状態（テーマ、認証、カート）だけがグローバルstoreを必要とする

:::

---

## Context の限界

Contextは**低頻度更新のグローバルデータ**に適しているが、高頻度更新の状態には向かない（[詳細はレンダリング最適化を参照](/ja/programming/web-frontend/react/performance#context-性能陷阱)）：

```txt
Context value 変化
   → 所有消費該 Context 的組件 re-render
   → 即使只用了 value 的一部分
   → React.memo 也擋不住（Context 繞過 props 比較）
```

**Contextが適する**：テーマ、言語、現在のユーザー、権限――変化頻度が低く、消費者が少ない

**Contextが適さない**：フォーム状態、リストフィルタ、リアルタイムデータ――変化頻度が高く、消費者が多い

---

## Zustand

> 軽量状態管理――ボイラープレートゼロ、selector単位の精確な購読をサポート

### 基本的な使い方

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

### Selector 精確購読

Zustandの最大の強み：コンポーネントは自分が必要な状態のスライスだけを購読する

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

### 非同期操作

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

### ミドルウェア

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

| ミドルウェア | 役割 |
| --- | --- |
| `devtools` | Redux DevToolsに接続、タイムトラベルデバッグ |
| `persist` | localStorage / sessionStorageへ自動永続化 |
| `immer` | ミュータブルな構文でイミュータブルな更新を記述可能 |

---

## Zustand vs Context vs Redux

| 次元 | Context | Zustand | Redux Toolkit |
| --- | --- | --- | --- |
| パッケージサイズ | 0（React内蔵） | ~1KB | ~11KB |
| ボイラープレート | 中（Provider + Hook） | **極少** | 多（slice + store + Provider） |
| 精確な購読 | ❌（value変更 = 全体re-render） | ✅（selector） | ✅（selector） |
| 非同期 | 自前で実装 | action内で直接async | thunk / saga が必要 |
| DevTools | ❌ | ✅（devtoolsミドルウェア） | ✅（内蔵） |
| 適用規模 | 小規模 / 低頻度 | 中小〜大規模 | 大規模、チームで強い規約が必要 |

::: tip 選択の指針

- **デフォルトはZustand**：ボイラープレートゼロ、精確な購読、非同期ネイティブサポート――95%のケースをカバー
- **小規模プロジェクト / 低頻度グローバル状態**：Contextで十分なら追加の依存を入れない
- **大チームで強い規約が必要**：Redux Toolkitのsliceパターンとミドルウェアエコシステムがより成熟
- **アトミックな状態（大量の独立した小さな状態）**：Jotaiを検討

:::

---

## サーバー状態 vs クライアント状態

::: warning 最も重要なパラダイムシフト

ほとんどの「グローバル状態」は実際には**サーバーデータのクライアント側キャッシュ**――ユーザーリスト、商品情報、通知数――これらはZustand/Reduxで手動管理すべきではない

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
