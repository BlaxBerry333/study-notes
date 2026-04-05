# 渲染优化

> Render Optimization — 控制 re-render 的范围和频率

## React.memo 与引用稳定性

> memo 做浅比较拦截 re-render，useMemo/useCallback 稳定引用让 memo 生效 — 它们是一个体系

---

### memo 原理

`React.memo` 包裹组件后，父组件 re-render 时会**浅比较** props：原始类型比值，引用类型比引用地址。只有 props 变了才 re-render

```tsx
const UserBadge = React.memo(function UserBadge({
  name,
  level,
}: {
  name: string;
  level: number;
}) {
  return (
    <span>
      {name} (Lv.{level})
    </span>
  );
});

function Dashboard() {
  const [notifications, setNotifications] = useState(0);

  return (
    <div>
      <span>通知: {notifications}</span>
      {/* notifications 变化时 Dashboard re-render，但 UserBadge 的 props 没变，跳过 */}
      <UserBadge name="Alice" level={5} />
    </div>
  );
}
```

---

### memo 失效陷阱

每次父组件 re-render 时，内联创建的对象和函数都是**新引用**，memo 的浅比较必然失败：

```tsx
function Parent() {
  const [count, setCount] = useState(0);

  return (
    <FilteredList
      // ❌ {} !== {} → memo 失效
      filters={{ status: "active", keyword: "" }}
      // ❌ 新函数引用 → memo 失效
      onSelect={(id) => console.log(id)}
    />
  );
}
```

修复方式 — 用 `useMemo` / `useCallback` 稳定引用：

```tsx
function Parent() {
  const [count, setCount] = useState(0);

  const filters = useMemo(() => ({ status: "active", keyword: "" }), []);
  const onSelect = useCallback((id: string) => console.log(id), []);

  return <FilteredList filters={filters} onSelect={onSelect} />;
}
```

---

### 使用场景

::: code-group

```tsx [配合 React.memo]
// 子组件用了 memo，父组件必须稳定 props 引用
const Chart = React.memo(function Chart({
  data,
  onHover,
}: {
  data: ProcessedData[];
  onHover: (point: DataPoint) => void;
}) {
  return <canvas />;
});

function Dashboard() {
  const [rawData, setRawData] = useState<RawData[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const processedData = useMemo(
    () => rawData.map(transformExpensiveData),
    [rawData],
  );

  const handleHover = useCallback((point: DataPoint) => {
    setSelectedId(point.id);
  }, []);

  return <Chart data={processedData} onHover={handleHover} />;
}
```

```tsx [昂贵计算]
function SearchResults({ items, query }: { items: Item[]; query: string }) {
  // 10000 条数据的模糊搜索 + 排序
  const filtered = useMemo(() => {
    return items
      .filter((item) => fuzzyMatch(item.name, query))
      .sort((a, b) => relevanceScore(b, query) - relevanceScore(a, query));
  }, [items, query]);

  return (
    <ul>
      {filtered.map((item) => (
        <li key={item.id}>{item.name}</li>
      ))}
    </ul>
  );
}
```

```tsx [作为 Hook 依赖]
function useDataFetcher(config: FetchConfig) {
  // 稳定引用，避免 useEffect 无限循环
  const stableConfig = useMemo(() => config, [config.url, config.method]);

  useEffect(() => {
    fetchData(stableConfig);
  }, [stableConfig]);
}
```

:::

### 过度使用

```tsx
function UserCard({ user }: { user: User }) {
  // ❌ 字符串拼接不需要 useMemo
  const fullName = useMemo(
    () => `${user.firstName} ${user.lastName}`,
    [user.firstName, user.lastName],
  );

  // ❌ UserCard 本身没被 memo 包裹，父组件 re-render 时它一定 re-render
  // 缓存 handleClick 毫无意义
  const handleClick = useCallback(() => {
    console.log(user.id);
  }, [user.id]);

  return <div onClick={handleClick}>{fullName}</div>;
}
```

::: warning useMemo / useCallback 的成本

每次调用都要执行 Hook 逻辑、浅比较依赖数组、在内存中缓存值。如果计算本身很便宜（字符串拼接、简单条件判断），缓存的开销可能比重新计算还大
:::

---

### React Compiler

React 19 引入的 React Compiler（原 React Forget）会在编译时**自动插入** memoization。这意味着：

- 未来不需要手动写 `useMemo` / `useCallback` 来优化 re-render
- Compiler 能分析出更精确的依赖关系，比手动写更可靠
- 但 Compiler **不会**帮你做架构层面的优化（状态下沉、Context 拆分等）

::: tip 判断是否需要 useMemo / useCallback

1. 传给了 `React.memo` 组件？→ 需要
2. 作为其他 Hook 的依赖（`useEffect`、`useMemo`）？→ 需要
3. 计算真的很昂贵（遍历大数组、复杂变换）？→ 需要
4. 以上都不是？→ **不需要**
:::

---

## key 的正确使用

> key 不只是消除 warning — 错误的 key 会导致状态错乱和性能问题

---

### index 作 key 的问题

当列表项有**内部状态**（input 值、checkbox 选中、展开/收起）时，用 index 作 key 会导致状态错位：

```tsx
// ❌ 删除第一项后，第二项会"继承"第一项的 input 状态
function TodoList({
  todos,
  onRemove,
}: {
  todos: Todo[];
  onRemove: (id: string) => void;
}) {
  return (
    <ul>
      {todos.map((todo, index) => (
        // 删除 index=0 后，原来 index=1 的项变成 index=0
        // React 认为 key=0 的组件还在，复用了旧的 DOM 和状态
        <li key={index}>
          <input defaultValue={todo.text} />
          <button onClick={() => onRemove(todo.id)}>删除</button>
        </li>
      ))}
    </ul>
  );
}

// ✅ 用稳定唯一标识作 key
{
  todos.map((todo) => (
    <li key={todo.id}>
      <input defaultValue={todo.text} />
      <button onClick={() => onRemove(todo.id)}>删除</button>
    </li>
  ));
}
```

::: tip index 作 key 唯一安全的场景

列表是**静态的**（不会增删、排序）且列表项**没有内部状态**。典型例子：导航菜单、静态标签列表
:::

---

### key 强制 remount

改变 key 会让 React 销毁旧组件实例、创建新实例，**所有内部状态被重置**。这是一个有用的技巧：

```tsx
// 切换用户时，重置 Profile 的所有内部状态（表单值、滚动位置等）
function App() {
  const [userId, setUserId] = useState("alice");

  // userId 变了 → key 变了 → Profile 整个 unmount + remount
  return <Profile key={userId} userId={userId} />;
}
```

::: warning

remount 的成本远高于 re-render（要走完整的挂载生命周期、重新触发 useEffect）。只在确实需要**重置全部状态**时使用，不要当作"刷新组件"的快捷方式
:::

---

### key 与 diff 性能

React 的 diff 算法依赖 key 来匹配新旧列表项。没有稳定的 key，React 只能按顺序逐个比较，导致大量不必要的 DOM 操作：

```tsx
// 在列表头部插入一项
// 无稳定 key：React 认为每一项都变了，更新 N 个 DOM 节点
// 有稳定 key：React 识别出只是插入了一项，操作 1 个 DOM 节点
```

---

## 状态下沉

> State Colocation — 把状态放到真正需要它的地方，零成本减少 re-render 范围

---

### 状态放太高

```tsx
// ❌ searchQuery 放在 App 级别，每次输入都导致 Sidebar、Footer re-render
function App() {
  const [searchQuery, setSearchQuery] = useState("");
  const [user, setUser] = useState<User | null>(null);

  return (
    <div>
      <Header user={user} />
      <SearchBar query={searchQuery} onChange={setSearchQuery} />
      <ProductList query={searchQuery} />
      <Sidebar />
      <Footer />
    </div>
  );
}
```

---

### 状态下沉

```tsx
function App() {
  const [user, setUser] = useState<User | null>(null);

  return (
    <div>
      <Header user={user} />
      <SearchSection />
      <Sidebar />
      <Footer />
    </div>
  );
}

function SearchSection() {
  const [searchQuery, setSearchQuery] = useState("");

  return (
    <>
      <SearchBar query={searchQuery} onChange={setSearchQuery} />
      <ProductList query={searchQuery} />
    </>
  );
}
```

---

### children 模式

当组件管理状态但子组件不依赖该状态时，用 `children` 把不相关的部分"提出去"：

```tsx
// ❌ theme 状态变化 → ExpensiveContent 也 re-render
function AnimatedBackground() {
  const [theme, setTheme] = useState("light");

  return (
    <div className={`bg-${theme}`}>
      <button
        onClick={() => setTheme((t) => (t === "light" ? "dark" : "light"))}
      >
        切换主题
      </button>
      <ExpensiveContent />
    </div>
  );
}

// ✅ children 在父组件中创建，ThemeWrapper re-render 不影响 children
function App() {
  return (
    <ThemeWrapper>
      <ExpensiveContent />
    </ThemeWrapper>
  );
}

function ThemeWrapper({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState("light");

  return (
    <div className={`bg-${theme}`}>
      <button
        onClick={() => setTheme((t) => (t === "light" ? "dark" : "light"))}
      >
        切换主题
      </button>
      {children}
    </div>
  );
}
```

::: tip

- 状态下沉是零成本优化 — 不引入任何额外 API，只是调整代码结构
- `children` 模式的原理：JSX 元素是 `React.createElement()` 的返回值（一个对象），在父组件中创建后引用就固定了，不会因子组件 re-render 而重新创建
:::

---

## Context 性能陷阱

> Context value 变化 = 所有消费者 re-render，无论它们用了 value 的哪部分，React.memo 也挡不住

---

### Provider 新对象陷阱

```tsx
// ❌ 每次 App re-render 都创建新的 value 对象 → 所有消费者 re-render
function App() {
  const [theme, setTheme] = useState("dark");
  const [locale, setLocale] = useState("zh-CN");

  return (
    <ThemeContext.Provider value={{ theme, setTheme, locale, setLocale }}>
      <Page />
    </ThemeContext.Provider>
  );
}

// 只用了 theme，但 locale 变化时也会 re-render
function ThemedButton() {
  const { theme } = useContext(ThemeContext);
  return <button className={theme}>Click</button>;
}
```

---

### useMemo 稳定 value

```tsx
function App() {
  const [theme, setTheme] = useState("dark");
  const [locale, setLocale] = useState("zh-CN");

  const value = useMemo(
    () => ({ theme, setTheme, locale, setLocale }),
    [theme, locale],
  );

  return (
    <ThemeContext.Provider value={value}>
      <Page />
    </ThemeContext.Provider>
  );
}
```

---

### 拆分 Context

将变化频率不同的数据拆到不同 Context：

```tsx
const ThemeContext = createContext<{
  theme: string;
  setTheme: (t: string) => void;
}>();
const LocaleContext = createContext<{
  locale: string;
  setLocale: (l: string) => void;
}>();

function AppProviders({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState("dark");
  const [locale, setLocale] = useState("zh-CN");

  const themeValue = useMemo(() => ({ theme, setTheme }), [theme]);
  const localeValue = useMemo(() => ({ locale, setLocale }), [locale]);

  return (
    <ThemeContext.Provider value={themeValue}>
      <LocaleContext.Provider value={localeValue}>
        {children}
      </LocaleContext.Provider>
    </ThemeContext.Provider>
  );
}

// ✅ locale 变化时 ThemedButton 不会 re-render
function ThemedButton() {
  const { theme } = useContext(ThemeContext);
  return <button className={theme}>Click</button>;
}
```

---

### 拆分数据与操作

把几乎不变的 dispatch/setter 和频繁变化的 state 分开：

```tsx
const StateContext = createContext<AppState>();
const DispatchContext = createContext<React.Dispatch<Action>>();

function AppProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState);

  return (
    <DispatchContext.Provider value={dispatch}>
      <StateContext.Provider value={state}>{children}</StateContext.Provider>
    </DispatchContext.Provider>
  );
}

// ✅ 只需要触发操作的组件不会因 state 变化而 re-render
function AddButton() {
  const dispatch = useContext(DispatchContext);
  return <button onClick={() => dispatch({ type: "ADD" })}>添加</button>;
}
```

::: warning

Context 不是状态管理库的替代品。频繁更新的全局状态（表单、实时数据）用 Context 会导致大量不必要的 re-render。这种场景应该考虑 Zustand、Jotai 等方案 — 它们支持 selector 级别的精确订阅
:::
