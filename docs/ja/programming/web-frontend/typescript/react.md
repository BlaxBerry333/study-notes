# TypeScript × React

> React プロジェクトにおける TypeScript の実践的な使い方

## コンポーネント Props 型

### 基本 Props

```tsx
// 函数组件 Props
type ButtonProps = {
  label: string;
  variant?: "primary" | "secondary" | "danger"; // 可选 + 字面量联合
  disabled?: boolean;
  onClick: () => void;
};

function Button({ label, variant = "primary", disabled, onClick }: ButtonProps) {
  return (
    <button className={variant} disabled={disabled} onClick={onClick}>
      {label}
    </button>
  );
}
```

---

### children の型

```tsx
// React.ReactNode: 最宽泛，接受任何可渲染内容
type CardProps = {
  title: string;
  children: React.ReactNode; // string | number | JSX | null | undefined | ...
};

// React.ReactElement: 只接受 JSX 元素（不接受 string / number）
type LayoutProps = {
  sidebar: React.ReactElement;
  children: React.ReactNode;
};

// 函数作为 children（Render Props 模式）
type DataProviderProps<T> = {
  children: (data: T) => React.ReactNode;
};
```

---

### HTML 要素 Props の継承

```tsx
// 继承原生 button 的所有属性
type ButtonProps = React.ComponentPropsWithoutRef<"button"> & {
  variant?: "primary" | "secondary";
};

function Button({ variant = "primary", className, ...rest }: ButtonProps) {
  return <button className={`btn-${variant} ${className ?? ""}`} {...rest} />;
}

// 支持 ref 转发
type InputProps = React.ComponentPropsWithRef<"input"> & {
  error?: string;
};

const Input = React.forwardRef<HTMLInputElement, Omit<InputProps, "ref">>(
  ({ error, ...rest }, ref) => (
    <div>
      <input ref={ref} {...rest} />
      {error && <span className="error">{error}</span>}
    </div>
  ),
);
```

::: warning 特徴: ComponentPropsWithoutRef vs ComponentPropsWithRef

- `ComponentPropsWithoutRef<"button">`：ref を含まない。ref 転送が不要なコンポーネントに使用
- `ComponentPropsWithRef<"button">`：ref を含む。`forwardRef` コンポーネントに使用
- `React.FC`（型が狭く暗黙的に `children` を含む）/ `React.HTMLAttributes`（不完全）は非推奨 -- `ComponentPropsWithoutRef` がより包括的

:::

---

### ポリモーフィックコンポーネント

コンポーネントのレンダリング要素が props で決まる（`as` パターン）：

```tsx
type PolymorphicProps<E extends React.ElementType, P = {}> = P &
  Omit<React.ComponentPropsWithoutRef<E>, keyof P> & {
    as?: E;
  };

function Text<E extends React.ElementType = "span">({
  as,
  ...rest
}: PolymorphicProps<E, { bold?: boolean }>) {
  const Component = as || "span";
  return <Component {...rest} />;
}

// 使用
<Text>默认 span</Text>
<Text as="h1">变成 h1</Text>
<Text as="a" href="/about">变成 a 标签，href 自动补全 ✅</Text>
```

---

## Hooks の型

### useState

```tsx
// 自动推导
const [count, setCount] = useState(0); // number
const [name, setName] = useState(""); // string

// 需要手动标注的场景：初始值和后续值类型不同
const [user, setUser] = useState<User | null>(null);
const [items, setItems] = useState<Item[]>([]);
const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
```

---

### useRef

```tsx
// DOM 引用：初始 null，类型参数指定元素类型
const inputRef = useRef<HTMLInputElement>(null);
// inputRef.current: HTMLInputElement | null

// 可变值容器：初始值非 null，不加 | null
const timerRef = useRef<number>(0);
// timerRef.current: number（可变，不是 | null）
const prevValueRef = useRef<string>(initialValue);
```

::: tip useRef の二つの使い方

- `useRef<HTMLElement>(null)` → `.current` は `HTMLElement | null`（読み取り専用 ref、React が管理）
- `useRef<number>(0)` → `.current` は `number`（可変コンテナ、自分で管理）

違い：型パラメータに `null` を含まないが初期値が `null` の場合、TS は読み取り専用 ref として推論する

:::

---

### useReducer

```tsx
type State = {
  count: number;
  step: number;
};

type Action =
  | { type: "increment" }
  | { type: "decrement" }
  | { type: "setStep"; payload: number }
  | { type: "reset" };

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "increment":
      return { ...state, count: state.count + state.step };
    case "decrement":
      return { ...state, count: state.count - state.step };
    case "setStep":
      return { ...state, step: action.payload };
    case "reset":
      return { count: 0, step: 1 };
  }
}

function Counter() {
  const [state, dispatch] = useReducer(reducer, { count: 0, step: 1 });

  return (
    <div>
      <span>{state.count}</span>
      <button onClick={() => dispatch({ type: "increment" })}>+</button>
      <button onClick={() => dispatch({ type: "setStep", payload: 5 })}>
        步长=5
      </button>
      {/* dispatch({ type: "setStep" }) // ❌ 缺少 payload */}
    </div>
  );
}
```

::: tip 判別可能なユニオン + useReducer

Action に判別可能なユニオン（`type` フィールドで区別）を使うと、`switch` 内で TS が各 case の action 型を自動的に絞り込む。`dispatch` 呼び出し時にも payload の一致がチェックされる――**コンパイル時に action のスペルミスやパラメータ不足を検出できる**

:::

---

### useContext

```tsx
type Theme = "light" | "dark";

type ThemeContextValue = {
  theme: Theme;
  toggleTheme: () => void;
};

// createContext 的类型参数
const ThemeContext = createContext<ThemeContextValue | null>(null);

// 封装 Hook，自动处理 null 检查
function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within ThemeProvider");
  }
  return context; // ThemeContextValue（不是 | null）
}

// 使用
function ThemeToggle() {
  const { theme, toggleTheme } = useTheme(); // ✅ 类型安全，无 null
  return <button onClick={toggleTheme}>{theme}</button>;
}
```

---

## イベント処理

```tsx
function Form() {
  // 内联写法：TS 自动推导事件类型
  return (
    <div>
      <input onChange={(e) => console.log(e.target.value)} />
      <button onClick={(e) => console.log(e.clientX)} />
    </div>
  );
}

// 提取为独立函数时需要手动标注
const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
  console.log(e.target.value);
};

const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
  e.preventDefault();
};

const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
  if (e.key === "Enter") {
    // ...
  }
};
```

| イベント | 型 |
| --- | --- |
| `onChange`（input） | `React.ChangeEvent<HTMLInputElement>` |
| `onClick` | `React.MouseEvent<HTMLButtonElement>` |
| `onSubmit` | `React.FormEvent<HTMLFormElement>` |
| `onKeyDown` | `React.KeyboardEvent<HTMLInputElement>` |
| `onFocus` / `onBlur` | `React.FocusEvent<HTMLInputElement>` |
| `onDrag` / `onDrop` | `React.DragEvent<HTMLDivElement>` |

::: tip

インラインの書き方ではイベント型が自動推論されるため、手動で型を書く必要はない。処理関数を外部に抽出した場合のみ型の記述が必要

:::
