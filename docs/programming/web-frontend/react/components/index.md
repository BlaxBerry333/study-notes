# React 组件

组件是 React 应用的构建块。

## 函数组件

推荐使用函数组件 + Hooks 的方式编写 React 应用。

```tsx
function Button({ children, onClick }: ButtonProps) {
  return <button onClick={onClick}>{children}</button>;
}
```

## Props 设计

良好的 Props 设计让组件更易用：

- 使用 TypeScript 定义类型
- 提供合理的默认值
- 避免过多的 Props

## 组合模式

通过组合而非继承来复用组件逻辑。

```tsx
function Card({ children, header }: CardProps) {
  return (
    <div className="card">
      <div className="card-header">{header}</div>
      <div className="card-body">{children}</div>
    </div>
  );
}
```
