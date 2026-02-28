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
    <Layout>
      <Layout.Aside />
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

## 无头组件

> Headless Components

该设计模式只处理组件内逻辑、状态、可访问性，不关任何注样式

当使用组件时想完全掌控 UI/UX 但不处理基础逻辑时可考虑使用该设计模式

---

## 受控组件

> Controlled Components

由 React 管理组件的状态

```tsx
import { useState, useEffect } from "react";

function SearchBox(props) {
  const [keyword, setKeyword] = useState("");

  useEffect(() => {
    props.onSearch(keyword);
  }, [keyword]);

  return (
    <input
      placeholder="实时搜索"
      value={keyword}
      onChange={(e) => setKeyword(e.target.value)}
    />
  );
}
```

::: tip 适用场景

- 需要实时验证
- 字段之间有联动

:::

---

## 非受控组件

> Uncontrolled Components

由 DOM 管理组件的状态

```tsx
import { useRef } from "react";

function SearchBox({ onSearch }) {
  const ref = useRef<HTMLInputElement>(null);

  return (
    <>
      <input ref={ref} placeholder="提交时搜索" />
      <button onClick={() => onSearch(ref.current!.value)}>搜索</button>
    </>
  );
}
```

::: tip 适用场景

- 简单表单、仅提交时才需要值
- 大型表单、要考虑 re-render 性能

:::
