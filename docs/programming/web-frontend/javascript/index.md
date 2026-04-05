---
prev: false
next: false
---

# JavaScript

动态类型、基于原型、支持多范式的脚本语言

::: warning 特点:

- **动态类型**：变量类型在运行时确定，灵活但需注意隐式转换
- **基于原型**：通过原型链实现继承，而非传统的类继承
- **事件驱动 + 异步**：单线程 + Event Loop + 非阻塞 I/O
- **一等公民函数**：函数可以赋值给变量、作为参数传递、作为返回值

:::

## 基础概念

| 概念 | 说明 | 详细 |
| --- | --- | --- |
| 事件循环 | 单线程如何处理异步——调用栈、微任务队列、宏任务队列的协作机制 | [详见](/programming/web-frontend/javascript/event-loop) |
| 闭包 | 函数"记住"定义时的作用域——数据封装、柯里化的基础 | [详见](/programming/web-frontend/javascript/closure) |
| this | `this` 取决于函数怎么被调用——四条绑定规则 + 箭头函数 | [详见](/programming/web-frontend/javascript/this) |
| 原型链 | JS 继承的底层机制——`__proto__` 链条上的属性查找 | [详见](/programming/web-frontend/javascript/prototype) |
| Promise / async-await | 异步编程的核心——回调地狱的解决方案 | [详见](/programming/web-frontend/javascript/async) |
| 深浅拷贝 | 值类型与引用类型的复制机制 | [详见](/programming/web-frontend/javascript/copy) |

## 基本使用

### 变量声明

```js
// let: 块级作用域，可重新赋值
let count = 0;
count = 1;

// const: 块级作用域，不可重新赋值（但对象属性可改）
const user = { name: "Alice" };
user.name = "Bob"; // ✅ 对象属性可改
// user = {};       // ❌ 不能重新赋值

// var: 函数作用域，有变量提升（不推荐）
```

::: warning let/const vs var

- `var` 有**变量提升**（声明被提升到函数顶部）和函数作用域，导致 `for` 循环中的经典闭包陷阱
- `let`/`const` 有**暂时性死区**（TDZ）和块级作用域，更安全
- 现代 JS 只用 `const`（默认）和 `let`（需要重新赋值时），不用 `var`

:::

---

### 解构与展开

```js
// 对象解构
const { name, age, email = "N/A" } = user; // 带默认值
const { name: userName } = user; // 重命名

// 数组解构
const [first, , third] = [1, 2, 3]; // 跳过第二个
const [head, ...rest] = [1, 2, 3, 4]; // rest = [2, 3, 4]

// 展开运算符
const merged = { ...defaults, ...userConfig }; // 对象合并（后者覆盖前者）
const combined = [...arr1, ...arr2]; // 数组合并

// 函数参数解构
function greet({ name, age }: User) {
  return `${name} (${age})`;
}
```

---

### 可选链与空值合并

```js
// 可选链 ?.（安全访问深层属性）
const city = user?.address?.city; // undefined（不会报错）
const first = arr?.[0]; // 数组安全访问
const result = fn?.(); // 函数安全调用

// 空值合并 ??（只在 null/undefined 时使用默认值）
const name = user.name ?? "匿名"; // "" 不会被替换（和 || 的区别）
const count = data.count ?? 0; // 0 不会被替换

// || 的问题：0、""、false 都会被替换
const port = config.port || 3000; // config.port = 0 时变成 3000 ❌
const port = config.port ?? 3000; // config.port = 0 时保持 0 ✅
```

---

### 数组高阶方法

```js
const users = [
  { name: "Alice", age: 25, active: true },
  { name: "Bob", age: 30, active: false },
  { name: "Charlie", age: 28, active: true },
];

// map: 变换每个元素
const names = users.map((u) => u.name);
// ["Alice", "Bob", "Charlie"]

// filter: 筛选
const activeUsers = users.filter((u) => u.active);
// [{ name: "Alice", ... }, { name: "Charlie", ... }]

// find: 找第一个匹配的
const bob = users.find((u) => u.name === "Bob");

// reduce: 归约
const totalAge = users.reduce((sum, u) => sum + u.age, 0); // 83

// some / every: 存在性 / 全称判断
users.some((u) => u.age > 29); // true
users.every((u) => u.active); // false

// flatMap: map + flatten
const tags = users.flatMap((u) => u.tags ?? []); // 展平嵌套数组
```
