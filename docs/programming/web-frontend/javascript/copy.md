# 深浅拷贝

## 前置：值类型 vs 引用类型

```
值类型（原始类型）                   引用类型
string, number, boolean,            object, array, function,
null, undefined, symbol, bigint     Map, Set, Date, RegExp ...

  变量 → 直接存值                     变量 → 存引用（地址）→ 堆中的对象
  赋值 = 复制值本身                   赋值 = 复制引用（指向同一个对象）
```

```js
// 值类型：赋值后互不影响
let a = 1;
let b = a;
b = 2;
console.log(a); // 1（不受影响）

// 引用类型：赋值后指向同一对象
let obj1 = { name: "Alice" };
let obj2 = obj1;
obj2.name = "Bob";
console.log(obj1.name); // 'Bob'（被修改了！）
```

::: warning
`=` 赋值只复制了引用（地址），两个变量指向堆中的同一个对象，所以修改 obj2 会影响 obj1
:::

## 浅拷贝

> Shallow Copy

**只复制第一层**。嵌套的引用类型仍然共享同一个引用

```
原对象              浅拷贝后
┌──────────┐       ┌──────────┐
│ name: 'A' │       │ name: 'A' │  ← 第一层：独立副本 ✅
│ addr: ──────┐     │ addr: ──────┐
└──────────┘  │    └──────────┘  │
              ▼                   ▼
          ┌────────┐  ◄──── 同一个对象！修改会互相影响 ❌
          │city:'东京'│
          └────────┘
```

### 常用方法

::: code-group

```js [展开运算符（推荐）]
const original = { a: 1, b: { c: 2 } };
const copy = { ...original };

copy.a = 99;
console.log(original.a); // 1 ✅ 第一层独立

copy.b.c = 99;
console.log(original.b.c); // 99 ❌ 嵌套对象被修改
```

```js [Object.assign()]
const original = { a: 1, b: { c: 2 } };
const copy = Object.assign({}, original);

copy.a = 99;
console.log(original.a); // 1 ✅

copy.b.c = 99;
console.log(original.b.c); // 99 ❌
```

```js [数组方法]
const arr = [1, [2, 3]];

// 以下都是浅拷贝
const copy1 = [...arr];
const copy2 = arr.slice();
const copy3 = Array.from(arr);

copy1[1][0] = 99;
console.log(arr[1][0]); // 99 ❌ 嵌套数组被修改
```

:::

## 深拷贝

> Deep Copy

递归复制所有层级，拷贝后的对象与原对象完全独立

### `structuredClone()`

ES2022 标准 API，所有现代浏览器和 Node.js 17+ 支持

```js
const original = {
  name: "Alice",
  date: new Date(),
  nested: { a: 1 },
  list: [1, 2, 3],
  map: new Map([["key", "value"]]),
  set: new Set([1, 2, 3]),
};

const copy = structuredClone(original);

copy.nested.a = 99;
console.log(original.nested.a); // 1 ✅ 完全独立
console.log(copy.date instanceof Date); // true ✅ 类型保留
console.log(copy.map instanceof Map); // true ✅
```

支持的类型：`Date`、`RegExp`、`Map`、`Set`、`ArrayBuffer`、`Blob`、循环引用等

```js
// ✅ 能处理循环引用
const obj = { a: 1 };
obj.self = obj;
const copy = structuredClone(obj); // 正常工作
```

**不支持的类型**：

```js
// ❌ 函数 — 抛出 DataCloneError
structuredClone({ fn: () => {} });

// ❌ DOM 节点
structuredClone({ el: document.body });

// ❌ 原型链（拷贝后是普通对象）
class User {
  greet() {}
}
const user = new User();
const copy = structuredClone(user);
console.log(copy instanceof User); // false
```

---

### `JSON.parse(JSON.stringify())`

简单粗暴，但坑很多。只适合纯数据（无特殊类型）的场景

```js
const original = { a: 1, nested: { b: 2 } };
const copy = JSON.parse(JSON.stringify(original));

copy.nested.b = 99;
console.log(original.nested.b); // 2 ✅
```

**踩坑清单**：

```js
const obj = {
  date: new Date(), // ❌ → 变成字符串
  regex: /abc/g, // ❌ → 变成空对象 {}
  fn: () => {}, // ❌ → 丢失
  undef: undefined, // ❌ → 丢失
  nan: NaN, // ❌ → 变成 null
  infinity: Infinity, // ❌ → 变成 null
  map: new Map(), // ❌ → 变成空对象 {}
  set: new Set([1, 2]), // ❌ → 变成空对象 {}
};

const copy = JSON.parse(JSON.stringify(obj));
// { date: "2024-01-01T...", regex: {}, nan: null, infinity: null, map: {}, set: {} }
// fn 和 undef 直接消失

// ❌ 循环引用 → 直接报错
const circular = { a: 1 };
circular.self = circular;
JSON.parse(JSON.stringify(circular)); // TypeError
```

::: warning
`JSON.parse(JSON.stringify())` 的核心问题：丢失 `undefined` 和函数、`Date` 变字符串、不能处理循环引用
:::

## 手写深拷贝

基础版 → WeakMap 处理循环引用 → 完整版处理特殊类型，详见[手写深拷贝](./deep-clone)

## 方法对比

| 方法 | 深/浅 | 循环引用 | Date | RegExp | Map/Set | 函数 |
|------|-------|---------|------|--------|---------|------|
| `...` / `Object.assign()` | 浅 | — | — | — | — | — |
| `JSON.parse(JSON.stringify())` | 深 | ❌ 报错 | ❌ 变字符串 | ❌ 变 `{}` | ❌ 变 `{}` | ❌ 丢失 |
| `structuredClone()` | 深 | ✅ | ✅ | ✅ | ✅ | ❌ 报错 |
| 手写递归 + WeakMap | 深 | ✅ | ✅ 需处理 | ✅ 需处理 | ✅ 需处理 | 可选 |

::: tip 选型建议
- **日常开发**：`structuredClone()` 就够用了
- **纯数据 JSON**：`JSON.parse(JSON.stringify())` 简单高效
- **浅层对象**：`...` 展开最简洁
- **需要拷贝函数或原型链**：手写或用 lodash 的 `cloneDeep`
:::
