---
prev: false
next: false
---

# React

声明式 UI 库——用组件描述界面，状态变化时自动更新 DOM

::: warning 特点:

- **声明式**：描述"UI 应该是什么样"，而非"怎么操作 DOM"
- **组件化**：UI = 组件树，每个组件管理自己的状态和渲染
- **单向数据流**：数据从父组件通过 props 向下传递，事件通过回调向上传递
- **虚拟 DOM**：state 变化 → 生成新虚拟 DOM → diff → 最小化真实 DOM 操作

:::

## 基础概念

| 概念 | 一句话说明 |
| --- | --- |
| JSX | JavaScript 的语法扩展——HTML-like 写法编译为 `React.createElement` |
| 组件 | 接收 props、返回 JSX 的函数（函数组件是现代标准） |
| Props | 父组件传给子组件的数据——只读，不能修改 |
| State | 组件内部的可变数据——通过 `useState` 管理，变化触发 re-render |
| Hooks | 在函数组件中使用状态和副作用的机制——`useState`、`useEffect`、`useRef` 等 |
| Re-render | state/props 变化时组件重新执行——生成新的虚拟 DOM 用于 diff |

---

### Hooks 速查

| Hook | 用途 | 关键点 |
| --- | --- | --- |
| `useState` | 组件内状态 | 更新触发 re-render |
| `useEffect` | 副作用（数据获取、订阅、DOM 操作） | 依赖数组控制执行时机 |
| `useRef` | 持久化引用（DOM 元素 / 可变值） | 修改不触发 re-render |
| `useMemo` | 缓存计算结果 | 依赖不变时跳过重新计算 |
| `useCallback` | 缓存函数引用 | 配合 `React.memo` 使用 |
| `useReducer` | 复杂状态逻辑 | state + action 模式 |
| `useContext` | 消费 Context 值 | value 变化时消费者 re-render |
| `useTransition` | 标记低优先级更新 | 保持 UI 响应 |
| `useDeferredValue` | 延迟值更新 | 接收 props 时的替代方案 |

---

#### 基础

- [组件设计模式](/programming/web-frontend/react/design-patterns)
- [实用自定义 Hooks](/programming/web-frontend/react/custom-hooks)

#### 性能优化

- [渲染优化](/programming/web-frontend/react/performance)
- [加载性能](/programming/web-frontend/react/performance-loading)

#### 进阶

- [状态管理](/programming/web-frontend/react/state-management)
- [Hooks 深入](/programming/web-frontend/react/hooks-deep)
