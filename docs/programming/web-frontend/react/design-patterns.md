# React 组件设计模式

> Component Design Patterns

## 复合组件

> Compound Components

该设计模式通过组合 **父组件 + 语义化子组件** 来构建复杂 UI 结构

当一个组件有明确的父子关系结构且多个子组件之间共享状态，可考虑使用该设计模式来提高组件使用时的可读性和可维护性

::: code-group

```tsx [使用例子]
import { Layout } from "components";

function MyLayout() {
  return (
    // 外层 Layout：整体页面布局（侧边栏 + 主内容区）
    <Layout>
      <Layout.Aside />
      {/* 内层 Layout：主内容区布局（头部 + 内容 + 底部） */}
      <Layout>
        <Layout.Header />
        <Layout.Content />
        <Layout.Footer />
      </Layout>
    </Layout>
  );
}
```

```tsx [定义例子]
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

- 父组件负责状态与上下文，子组件只负责职责
- 通过 `React.Context` 在组件内共享状态
- 使用 `Object.assign` 导出子组件

:::

---

## 高阶组件

> Higher-Order Components (HOC)

高阶组件是一个**接收组件并返回新组件的函数**，用于复用组件逻辑

当需要为多个组件注入相同的 props、数据或行为时，可考虑使用该模式

::: code-group

```tsx [使用例子]
import { withAuth } from "hocs";

function Dashboard({ user }: { user: User }) {
  return <h1>欢迎，{user.name}</h1>;
}

// 用 HOC 包裹后，Dashboard 自动获得 user prop
export default withAuth(Dashboard);
```

```tsx [定义例子]
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

    if (!user) return <div>加载中...</div>;

    return <WrappedComponent {...(props as P)} user={user} />;
  };
}
```

:::

::: tip

- 命名约定：`with` 前缀（如 `withAuth`、`withTheme`）
- 不要在 render 方法内创建 HOC，会导致组件反复卸载和重建
- 现代 React 中 Custom Hooks 可以替代大部分 HOC 场景

:::

---

## Render Props

> Render Props Pattern

该设计模式通过将渲染逻辑作为 **函数 prop** 传入组件，让组件控制逻辑而由调用方决定 UI

当多个组件需要共享相同的行为逻辑但渲染完全不同时，可考虑使用该设计模式

::: code-group

```tsx [使用例子]
import { MouseTracker } from "components";

function App() {
  return (
    <MouseTracker
      render={({ x, y }) => (
        <p>
          鼠标位置：{x}, {y}
        </p>
      )}
    />
  );
}
```

```tsx [定义例子]
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

- 组件封装逻辑和状态，通过函数 prop 把数据交给调用方渲染
- `children` 也可以作为 render prop 使用：`children(data)`
- 现代 React 中 Custom Hooks 可以替代大部分 Render Props 场景

:::

---

## 无头组件

> Headless Components

该设计模式封装了组件的**交互逻辑、状态管理和可访问性（ARIA）**，但不渲染任何 UI

与普通 Custom Hook 的区别在于：无头组件通常处理复杂的键盘导航、焦点管理和 WAI-ARIA 属性，而不仅是简单的状态封装

::: code-group

```tsx [使用例子]
import { useSelect } from "hooks";

function CustomSelect() {
  const { isOpen, selectedOption, getToggleProps, getMenuProps, getOptionProps, options } =
    useSelect({
      options: [
        { value: "apple", label: "苹果" },
        { value: "banana", label: "香蕉" },
        { value: "cherry", label: "樱桃" },
      ],
    });

  return (
    <div>
      <button {...getToggleProps()}>
        {selectedOption ? selectedOption.label : "请选择..."}
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

```tsx [定义例子]
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

  // 点击外部关闭
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

  // 触发按钮的 props（含键盘导航和 ARIA 属性）
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

  // 下拉菜单的 props
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

  // 每个选项的 props
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

- 典型库：Headless UI、Radix UI、Downshift、TanStack Table
- 核心价值：封装复杂的交互逻辑和可访问性，使用方只关注 UI 样式
- 通过 `getXxxProps()` 模式返回 props 对象，使用方通过展开运算符应用到元素上

:::

---

## 受控组件

> Controlled Components

受控组件的值由**外部 props 控制**，组件本身不持有状态，通过回调函数通知外部更新

```tsx
interface SearchBoxProps {
  value: string;
  onChange: (value: string) => void;
}

function SearchBox({ value, onChange }: SearchBoxProps) {
  return (
    <input
      placeholder="实时搜索"
      value={value}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}

// 使用时由父组件管理状态
function App() {
  const [keyword, setKeyword] = useState("");

  return <SearchBox value={keyword} onChange={setKeyword} />;
}
```

::: tip

- 状态由 React 管理（props + state），随时可获取值
- 每次输入触发 re-render，容易实现实时验证和字段联动
- 适用场景：复杂表单、实时交互、字段间有联动

:::

---

## 非受控组件

> Uncontrolled Components

由 DOM 管理组件的状态

```tsx
import { useRef } from "react";

function SearchBox({ onSearch }: { onSearch: (value: string) => void }) {
  const ref = useRef<HTMLInputElement>(null);

  return (
    <>
      <input ref={ref} placeholder="提交时搜索" />
      <button onClick={() => onSearch(ref.current?.value ?? "")}>
        搜索
      </button>
    </>
  );
}
```

::: tip

- 状态由 DOM 管理（ref），需要时通过 ref 读取值
- 输入不触发 re-render，性能更好，但难以实现动态联动
- 适用场景：简单表单、仅提交时需要值、大型表单需考虑性能

:::
