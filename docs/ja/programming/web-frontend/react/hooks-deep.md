# Hooks 深掘り

> useEffect 実行タイミング、依存の罠、よくある誤用

## useEffect 実行タイミング

```txt
組件 mount
   │
   ▼
渲染（執行函数体，返回 JSX）
   │
   ▼
浏览器绘制（用户看到 UI）
   │
   ▼
執行 useEffect 回调 ← 在绘制之后，异步执行
   │
   ▼
（state 变化触发 re-render）
   │
   ▼
渲染（重新執行函数体）
   │
   ▼
浏览器绘制
   │
   ▼
執行上一轮 useEffect 的 cleanup ← 先清理旧的
   │
   ▼
執行本轮 useEffect 回调 ← 再运行新的
   │
   ▼
組件 unmount 時 → 執行最後一轮 cleanup
```

::: warning useEffect vs useLayoutEffect

- `useEffect`：ブラウザ描画**の後**に非同期実行、レンダリングをブロックしない。ほとんどのケースでこちらを使う
- `useLayoutEffect`：ブラウザ描画**の前**に同期実行、レンダリングをブロックする。描画前にDOMの読み取り/変更が必要な場合のみ使用（要素サイズの測定、ちらつき防止）

:::

---

## 依存配列

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

| 依存配列 | 実行タイミング | 典型的なケース |
| --- | --- | --- |
| 渡さない | 毎回のrender後 | ほとんど使わない――通常はバグ |
| `[]` | mount後のみ | 初期化（イベントリスナー、WebSocket接続） |
| `[a, b]` | aまたはbが変化した後 | データ取得、購読の更新 |

---

### 依存漏れの罠

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

::: tip 関数型更新がベストプラクティス

effect内で前の値に基づいてstateを更新するだけの場合、`setState(value)` ではなく `setState(prev => ...)` を使う――クロージャの依存問題を回避し、effectの頻繁な再構築も避けられる

:::

---

### オブジェクト/関数を依存として使う場合

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

## よくある誤用

### useEffect が不要なケース

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

::: warning useEffectが必要かどうかの判断

自分に問いかける：**この操作は何がトリガーか？**

- **renderが原因（state/propsの変化）** → おそらくuseEffectは不要、レンダリング時に直接計算する
- **ユーザーイベントが原因（クリック、送信）** → イベントハンドラ内で処理し、useEffectを経由しない
- **外部システムが原因（WebSocket、タイマー、DOM API）** → useEffectが必要

:::

---

## StrictMode 二重実行

React 18のStrictModeは開発環境で**effectを2回実行**する（mount → unmount → mount）、cleanup漏れのバグを露呈させるため：

```tsx
useEffect(() => {
  const connection = createConnection(roomId);
  connection.connect();
  // 如果没有 cleanup，StrictMode 下会创建两个连接
  return () => connection.disconnect(); // ← 必须清理
}, [roomId]);
```

::: tip

- **開発環境 + StrictMode** でのみ二重実行、本番環境では発生しない
- effectの挙動が二重実行後に不整合になる場合（データの重複など）、cleanupに問題がある
- 正しくcleanupを書いたeffectは影響を受けない――1回目のcleanupが1回目の副作用をキャンセルする

:::
