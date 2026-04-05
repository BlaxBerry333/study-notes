---
prev: false
next: false
---

# JavaScript

動的型付け、プロトタイプベース、マルチパラダイム対応のスクリプト言語

::: warning 特徴:

- **動的型付け**：変数の型は実行時に決定される。柔軟だが暗黙的な型変換に注意が必要
- **プロトタイプベース**：従来のクラス継承ではなく、プロトタイプチェーンによる継承
- **イベント駆動 + 非同期**：シングルスレッド + Event Loop + ノンブロッキング I/O
- **第一級関数**：関数を変数に代入、引数として渡す、戻り値として返すことが可能

:::

## 基礎概念

| 概念 | 説明 | 詳細 |
| --- | --- | --- |
| イベントループ | シングルスレッドで非同期を処理する仕組み――コールスタック、マイクロタスクキュー、マクロタスクキューの連携 | [詳細](/ja/programming/web-frontend/javascript/event-loop) |
| クロージャ | 関数が定義時のスコープを「記憶」する――データのカプセル化、カリー化の基礎 | [詳細](/ja/programming/web-frontend/javascript/closure) |
| this | `this` は関数の呼び出し方法で決まる――4つのバインディングルール + アロー関数 | [詳細](/ja/programming/web-frontend/javascript/this) |
| プロトタイプチェーン | JS の継承の根底にある仕組み――`__proto__` チェーン上のプロパティ検索 | [詳細](/ja/programming/web-frontend/javascript/prototype) |
| Promise / async-await | 非同期プログラミングの核心――コールバック地獄の解決策 | [詳細](/ja/programming/web-frontend/javascript/async) |
| シャローコピーとディープコピー | 値型と参照型のコピーの仕組み | [詳細](/ja/programming/web-frontend/javascript/copy) |

## 基本的な使い方

### 変数宣言

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

- `var` には**変数の巻き上げ**（宣言が関数のトップに引き上げられる）と関数スコープがあり、`for` ループでの典型的なクロージャの罠を引き起こす
- `let`/`const` には**一時的デッドゾーン**（TDZ）とブロックスコープがあり、より安全
- モダン JS では `const`（デフォルト）と `let`（再代入が必要な場合）のみ使用し、`var` は使わない

:::

---

### 分割代入とスプレッド

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

### オプショナルチェーンと Nullish Coalescing

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

### 配列の高階メソッド

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
