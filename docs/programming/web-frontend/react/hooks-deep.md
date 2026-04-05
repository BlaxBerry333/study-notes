# Hooks 深入

> useEffect 执行时机、依赖陷阱、常见误用

## useEffect 执行时机

```txt
组件 mount
   │
   ▼
渲染（执行函数体，返回 JSX）
   │
   ▼
浏览器绘制（用户看到 UI）
   │
   ▼
执行 useEffect 回调 ← 在绘制之后，异步执行
   │
   ▼
（state 变化触发 re-render）
   │
   ▼
渲染（重新执行函数体）
   │
   ▼
浏览器绘制
   │
   ▼
执行上一轮 useEffect 的 cleanup ← 先清理旧的
   │
   ▼
执行本轮 useEffect 回调 ← 再运行新的
   │
   ▼
组件 unmount 时 → 执行最后一轮 cleanup
```

::: warning useEffect vs useLayoutEffect

- `useEffect`：浏览器绘制**之后**异步执行，不阻塞渲染。大部分场景用这个
- `useLayoutEffect`：浏览器绘制**之前**同步执行，阻塞渲染。仅用于需要在绘制前读取/修改 DOM 的场景（测量元素尺寸、避免闪烁）

:::

---

## 依赖数组

```tsx
// 每次 render 都执行（不传依赖数组）
useEffect(() => {
  console.log("每次 render 后都执行");
});

// 仅 mount 时执行一次（空依赖数组）
useEffect(() => {
  console.log("只在 mount 后执行一次");
  return () => console.log("unmount 时清理");
}, []);

// 依赖变化时执行
useEffect(() => {
  console.log(`userId 变为 ${userId}`);
  fetchUser(userId);
  return () => console.log(`清理旧的 userId: ${userId}`);
}, [userId]);
```

| 依赖数组 | 执行时机 | 典型场景 |
| --- | --- | --- |
| 不传 | 每次 render 后 | 极少使用——通常是 bug |
| `[]` | 仅 mount 后 | 初始化（事件监听、WebSocket 连接） |
| `[a, b]` | a 或 b 变化后 | 数据获取、订阅更新 |

---

### 依赖遗漏陷阱

```tsx
// ❌ count 被闭包捕获为初始值 0
function Counter() {
  const [count, setCount] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setCount(count + 1); // 永远是 0 + 1 = 1
    }, 1000);
    return () => clearInterval(timer);
  }, []); // count 不在依赖中

  // ✅ 方案 1: 加入依赖（每次 count 变化重建 interval）
  useEffect(() => {
    const timer = setInterval(() => {
      setCount(count + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [count]);

  // ✅ 方案 2: 用函数式更新（不依赖闭包中的 count）
  useEffect(() => {
    const timer = setInterval(() => {
      setCount((prev) => prev + 1); // 用 prev 而非闭包中的 count
    }, 1000);
    return () => clearInterval(timer);
  }, []); // 不需要 count 作为依赖
}
```

::: tip 函数式更新是最佳方案

当 effect 中只需要基于前一个值更新 state 时，用 `setState(prev => ...)` 而非 `setState(value)`——避免了闭包依赖问题，也避免了频繁重建 effect

:::

---

### 对象/函数作为依赖

```tsx
// ❌ 每次 render 都创建新对象，effect 每次都执行
function Search({ config }: { config: SearchConfig }) {
  useEffect(() => {
    search(config);
  }, [config]); // config 是 props，如果父组件每次传新对象就会无限循环
}

// ✅ 方案 1: 依赖具体的原始值
useEffect(() => {
  search({ keyword: config.keyword, page: config.page });
}, [config.keyword, config.page]);

// ✅ 方案 2: 用 useMemo 稳定引用
const stableConfig = useMemo(
  () => ({ keyword, page }),
  [keyword, page],
);
useEffect(() => {
  search(stableConfig);
}, [stableConfig]);
```

---

## 常见误用

### 不需要 useEffect 的场景

```tsx
// ❌ 用 useEffect 同步 state（派生状态）
const [items, setItems] = useState<Item[]>([]);
const [filteredItems, setFilteredItems] = useState<Item[]>([]);

useEffect(() => {
  setFilteredItems(items.filter((i) => i.active));
}, [items]); // 每次 items 变化 → set 新 state → 多一次 re-render

// ✅ 直接在渲染时计算（零额外 render）
const filteredItems = items.filter((i) => i.active);

// ✅ 计算量大时用 useMemo
const filteredItems = useMemo(
  () => items.filter((i) => i.active),
  [items],
);
```

---

```tsx
// ❌ 用 useEffect 处理用户事件
useEffect(() => {
  if (submitted) {
    sendForm(formData);
    setSubmitted(false);
  }
}, [submitted]);

// ✅ 直接在事件处理函数中操作
function handleSubmit() {
  sendForm(formData);
}
```

---

```tsx
// ❌ 用 useEffect 初始化不依赖 props 的值
useEffect(() => {
  setItems(getDefaultItems());
}, []);

// ✅ 用 useState 的初始化函数（惰性初始化）
const [items, setItems] = useState(getDefaultItems);
```

::: warning 判断是否需要 useEffect

问自己：**这个操作是因为什么触发的？**

- **因为 render（状态/props 变化）** → 大概率不需要 useEffect，直接在渲染时计算
- **因为用户事件（点击、提交）** → 在事件处理函数中做，不要绕道 useEffect
- **因为外部系统（WebSocket、定时器、DOM API）** → 需要 useEffect

:::

---

## StrictMode 双重执行

React 18 的 StrictMode 在开发环境下会**执行两次** effect（mount → unmount → mount），用于暴露 cleanup 缺失的 bug：

```tsx
useEffect(() => {
  const connection = createConnection(roomId);
  connection.connect();
  // 如果没有 cleanup，StrictMode 下会创建两个连接
  return () => connection.disconnect(); // ← 必须清理
}, [roomId]);
```

::: tip

- 只在**开发环境 + StrictMode** 下双重执行，生产环境不会
- 如果 effect 的行为在双重执行后不一致（如数据重复），说明 cleanup 有问题
- 正确写了 cleanup 的 effect 不受影响——第一次的 cleanup 会取消第一次的副作用

:::
