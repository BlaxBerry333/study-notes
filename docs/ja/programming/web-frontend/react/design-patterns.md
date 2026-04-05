# React コンポーネント設計パターン

> Component Design Patterns

## 複合コンポーネント

> Compound Components
このパターンは**親コンポーネント + セマンティックな子コンポーネント**を組み合わせて複雑な UI 構造を構築する

コンポーネントに明確な親子構造があり、複数の子コンポーネント間で状態を共有する場合、このパターンを使うことでコンポーネント利用時の可読性と保守性を向上できる

::: code-group

```tsx [使用例]
import { Layout } from "components";

function MyLayout() {
  return (
    // 外側の Layout：ページ全体のレイアウト（サイドバー + メインコンテンツ）
    <Layout>
      <Layout.Aside />
      {/* 内側の Layout：メインコンテンツのレイアウト（ヘッダー + コンテンツ + フッター） */}
      <Layout>
        <Layout.Header />
        <Layout.Content />
        <Layout.Footer />
      </Layout>
    </Layout>
  );
}
```

```tsx [定義例]
const LayoutContext = React.createContext(null);

function LayoutRoot({ children }) {
  const [state, setState] = React.useState();
  return (
    <LayoutContext.Provider value={{ state, setState }}>
      <div>{children}</div>
    </LayoutContext.Provider>
  );
}

function LayoutAside() {
  const { state } = React.useContext(LayoutContext);
  return <aside>{state}</aside>;
}
function LayoutHeader() {
  const { state } = React.useContext(LayoutContext);
  return <header>{state}</header>;
}
function LayoutContent() {
  const { state } = React.useContext(LayoutContext);
  return <main>{state}</main>;
}
function LayoutFooter() {
  const { state } = React.useContext(LayoutContext);
  return <footer>{state}</footer>;
}

export const Layout = Object.assign(LayoutRoot, {
  Aside: LayoutAside,
  Header: LayoutHeader,
  Content: LayoutContent,
  Footer: LayoutFooter,
});
```

:::

::: tip

- 親コンポーネントが状態とコンテキストを管理し、子コンポーネントは各自の責務のみを担う
- `React.Context` でコンポーネント間の状態を共有する
- `Object.assign` で子コンポーネントをエクスポートする
:::

---

## 高階コンポーネント

> Higher-Order Components (HOC)

高階コンポーネントは**コンポーネントを受け取り新しいコンポーネントを返す関数**であり、コンポーネントロジックの再利用に使う

複数のコンポーネントに同じ props、データ、振る舞いを注入したい場合にこのパターンを検討する

::: code-group

```tsx [使用例]
import { withAuth } from "hocs";

function Dashboard({ user }: { user: User }) {
  return <h1>ようこそ、{user.name}</h1>;
}

// HOC でラップすると、Dashboard は自動的に user prop を取得する
export default withAuth(Dashboard);
```

```tsx [定義例]
import { useEffect, useState, ComponentType } from "react";

interface WithAuthProps {
  user: User;
}

function withAuth<P extends WithAuthProps>(
  WrappedComponent: ComponentType<P>
) {
  return function AuthenticatedComponent(
    props: Omit<P, keyof WithAuthProps>
  ) {
    const [user, setUser] = useState<User | null>(null);

    useEffect(() => {
      fetchCurrentUser().then(setUser);
    }, []);

    if (!user) return <div>読み込み中...</div>;

    return <WrappedComponent {...(props as P)} user={user} />;
  };
}
```

:::

::: tip

- 命名規約：`with` プレフィックス（例：`withAuth`、`withTheme`）
- render メソッド内で HOC を作成してはならない。コンポーネントが繰り返しアンマウント・再生成される
- モダンな React では Custom Hooks が大部分の HOC のユースケースを代替できる
:::

---

## Render Props
このパターンはレンダリングロジックを**関数 prop** としてコンポーネントに渡し、コンポーネントがロジックを制御しつつ呼び出し側が UI を決定する

複数のコンポーネントが同じ振る舞いロジックを共有するがレンダリングが全く異なる場合にこのパターンを検討する

::: code-group

```tsx [使用例]
import { MouseTracker } from "components";

function App() {
  return (
    <MouseTracker
      render={({ x, y }) => (
        <p>
          マウス位置：{x}, {y}
        </p>
      )}
    />
  );
}
```

```tsx [定義例]
import { useState, useEffect } from "react";

interface MousePosition {
  x: number;
  y: number;
}

interface MouseTrackerProps {
  render: (position: MousePosition) => React.ReactNode;
}

function MouseTracker({ render }: MouseTrackerProps) {
  const [position, setPosition] = useState<MousePosition>({ x: 0, y: 0 });

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      setPosition({ x: e.clientX, y: e.clientY });
    };
    window.addEventListener("mousemove", handleMouseMove);
    return () => window.removeEventListener("mousemove", handleMouseMove);
  }, []);

  return <>{render(position)}</>;
}
```

:::

::: tip

- コンポーネントがロジックと状態をカプセル化し、関数 prop を通じてデータを呼び出し側に渡してレンダリングさせる
- `children` も render prop として使える：`children(data)`
- モダンな React では Custom Hooks が大部分の Render Props のユースケースを代替できる
:::

---

## ヘッドレスコンポーネント

> Headless Components

このパターンはコンポーネントの**インタラクションロジック、状態管理、アクセシビリティ（ARIA）**をカプセル化するが、UI は一切レンダリングしない

通常の Custom Hook との違いは、ヘッドレスコンポーネントが複雑なキーボードナビゲーション、フォーカス管理、WAI-ARIA 属性を扱う点であり、単純な状態カプセル化に留まらない

::: code-group

```tsx [使用例]
import { useSelect } from "hooks";

function CustomSelect() {
  const { isOpen, selectedOption, getToggleProps, getMenuProps, getOptionProps, options } =
    useSelect({
      options: [
        { value: "apple", label: "りんご" },
        { value: "banana", label: "バナナ" },
        { value: "cherry", label: "さくらんぼ" },
      ],
    });

  return (
    <div>
      <button {...getToggleProps()}>
        {selectedOption ? selectedOption.label : "選択してください..."}
      </button>
      {isOpen && (
        <ul {...getMenuProps()}>
          {options.map((option, index) => (
            <li key={option.value} {...getOptionProps({ option, index })}>
              {option.label}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
```

```tsx [定義例]
import { useState, useCallback, useRef, useEffect } from "react";

interface Option {
  value: string;
  label: string;
}

interface UseSelectProps {
  options: Option[];
  onChange?: (option: Option) => void;
}

function useSelect({ options, onChange }: UseSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedOption, setSelectedOption] = useState<Option | null>(null);
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  // 外部クリックで閉じる
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const select = useCallback(
    (option: Option) => {
      setSelectedOption(option);
      setIsOpen(false);
      onChange?.(option);
    },
    [onChange]
  );

  // トグルボタンの props（キーボードナビゲーションと ARIA 属性を含む）
  const getToggleProps = useCallback(
    () => ({
      role: "combobox" as const,
      "aria-expanded": isOpen,
      "aria-haspopup": "listbox" as const,
      onClick: () => setIsOpen((prev) => !prev),
      onKeyDown: (e: React.KeyboardEvent) => {
        if (e.key === "ArrowDown") {
          e.preventDefault();
          setIsOpen(true);
        } else if (e.key === "Escape") {
          setIsOpen(false);
        }
      },
    }),
    [isOpen]
  );

  // ドロップダウンメニューの props
  const getMenuProps = useCallback(
    () => ({
      role: "listbox" as const,
      "aria-activedescendant": options[highlightedIndex]?.value,
      onKeyDown: (e: React.KeyboardEvent) => {
        if (e.key === "ArrowDown") {
          e.preventDefault();
          setHighlightedIndex((i) => Math.min(i + 1, options.length - 1));
        } else if (e.key === "ArrowUp") {
          e.preventDefault();
          setHighlightedIndex((i) => Math.max(i - 1, 0));
        } else if (e.key === "Enter") {
          select(options[highlightedIndex]);
        } else if (e.key === "Escape") {
          setIsOpen(false);
        }
      },
    }),
    [highlightedIndex, options, select]
  );

  // 各オプションの props
  const getOptionProps = useCallback(
    ({ option, index }: { option: Option; index: number }) => ({
      role: "option" as const,
      id: option.value,
      "aria-selected": selectedOption?.value === option.value,
      onClick: () => select(option),
      onMouseEnter: () => setHighlightedIndex(index),
    }),
    [selectedOption, select]
  );

  return {
    isOpen,
    selectedOption,
    highlightedIndex,
    options,
    getToggleProps,
    getMenuProps,
    getOptionProps,
    containerRef,
  };
}
```

:::

::: tip

- 代表的なライブラリ：Headless UI、Radix UI、Downshift、TanStack Table
- 核心的な価値：複雑なインタラクションロジックとアクセシビリティをカプセル化し、利用側は UI スタイルのみに集中できる
- `getXxxProps()` パターンで props オブジェクトを返し、利用側がスプレッド演算子で要素に適用する
:::

---

## 制御コンポーネント

> Controlled Components

制御コンポーネントの値は**外部の props によって制御**され、コンポーネント自身は状態を持たず、コールバック関数で外部に更新を通知する

```tsx
interface SearchBoxProps {
  value: string;
  onChange: (value: string) => void;
}

function SearchBox({ value, onChange }: SearchBoxProps) {
  return (
    <input
      placeholder="リアルタイム検索"
      value={value}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}

// 使用時は親コンポーネントが状態を管理する
function App() {
  const [keyword, setKeyword] = useState("");

  return <SearchBox value={keyword} onChange={setKeyword} />;
}
```

::: tip

- 状態は React が管理（props + state）し、いつでも値を取得できる
- 入力のたびに re-render が発生し、リアルタイムバリデーションやフィールド連動を実装しやすい
- 適用場面：複雑なフォーム、リアルタイムインタラクション、フィールド間の連動
:::

---

## 非制御コンポーネント

> Uncontrolled Components

DOM がコンポーネントの状態を管理する

```tsx
import { useRef } from "react";

function SearchBox({ onSearch }: { onSearch: (value: string) => void }) {
  const ref = useRef<HTMLInputElement>(null);

  return (
    <>
      <input ref={ref} placeholder="送信時に検索" />
      <button onClick={() => onSearch(ref.current?.value ?? "")}>
        検索
      </button>
    </>
  );
}
```

::: tip

- 状態は DOM が管理（ref）し、必要なときに ref で値を読み取る
- 入力時に re-render が発生しないためパフォーマンスは良いが、動的な連動の実装が難しい
- 適用場面：シンプルなフォーム、送信時のみ値が必要な場合、大規模フォームでパフォーマンスを考慮する場合
:::
