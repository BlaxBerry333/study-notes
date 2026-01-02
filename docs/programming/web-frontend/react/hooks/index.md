# React Hooks

Hooks 是 React 16.8 引入的新特性，让你在函数组件中使用状态和其他 React 特性。

## useState

用于在函数组件中添加状态。

```tsx
const [count, setCount] = useState(0);
```

## useEffect

用于处理副作用，如数据获取、订阅等。

```tsx
useEffect(() => {
  document.title = `Count: ${count}`;
}, [count]);
```

## useCallback

用于缓存回调函数，避免不必要的重渲染。

```tsx
const handleClick = useCallback(() => {
  setCount((c) => c + 1);
}, []);
```

## useMemo

用于缓存计算结果。

```tsx
const expensiveValue = useMemo(() => {
  return computeExpensiveValue(a, b);
}, [a, b]);
```
