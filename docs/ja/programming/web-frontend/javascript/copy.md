# シャローコピーとディープコピー

## 前提：値型 vs 参照型

```
値型（プリミティブ型）                参照型
string, number, boolean,            object, array, function,
null, undefined, symbol, bigint     Map, Set, Date, RegExp ...

  変数 → 値を直接格納                  変数 → 参照（アドレス）を格納 → ヒープ上のオブジェクト
  代入 = 値そのもののコピー             代入 = 参照のコピー（同じオブジェクトを指す）
```

```js
// 値型：代入後は互いに影響しない
let a = 1;
let b = a;
b = 2;
console.log(a); // 1（影響なし）

// 参照型：代入後は同じオブジェクトを指す
let obj1 = { name: "Alice" };
let obj2 = obj1;
obj2.name = "Bob";
console.log(obj1.name); // 'Bob'（変更されている！）
```

::: warning
`=` による代入は参照（アドレス）をコピーしただけで、2つの変数はヒープ上の同一オブジェクトを指している。そのため obj2 の変更が obj1 にも影響する
:::

## シャローコピー

> Shallow Copy

**第1階層のみコピー**する。ネストされた参照型は同じ参照を共有したまま

```
元のオブジェクト        シャローコピー後
┌──────────┐       ┌──────────┐
│ name: 'A' │       │ name: 'A' │  ← 第1階層：独立したコピー ✅
│ addr: ──────┐     │ addr: ──────┐
└──────────┘  │    └──────────┘  │
              ▼                   ▼
          ┌────────┐  ◄──── 同一オブジェクト！変更が互いに影響する ❌
          │city:'東京'│
          └────────┘
```

### よく使う方法

::: code-group

```js [スプレッド構文（推奨）]
const original = { a: 1, b: { c: 2 } };
const copy = { ...original };

copy.a = 99;
console.log(original.a); // 1 ✅ 第1階層は独立

copy.b.c = 99;
console.log(original.b.c); // 99 ❌ ネストされたオブジェクトが変更される
```

```js [Object.assign()]
const original = { a: 1, b: { c: 2 } };
const copy = Object.assign({}, original);

copy.a = 99;
console.log(original.a); // 1 ✅

copy.b.c = 99;
console.log(original.b.c); // 99 ❌
```

```js [配列メソッド]
const arr = [1, [2, 3]];

// 以下はすべてシャローコピー
const copy1 = [...arr];
const copy2 = arr.slice();
const copy3 = Array.from(arr);

copy1[1][0] = 99;
console.log(arr[1][0]); // 99 ❌ ネストされた配列が変更される
```

:::

## ディープコピー

> Deep Copy

すべての階層を再帰的にコピーし、コピー後のオブジェクトは元のオブジェクトと完全に独立する

### `structuredClone()`

ES2022 標準 API。すべてのモダンブラウザと Node.js 17+ で対応

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
console.log(original.nested.a); // 1 ✅ 完全に独立
console.log(copy.date instanceof Date); // true ✅ 型が保持される
console.log(copy.map instanceof Map); // true ✅
```

対応する型：`Date`、`RegExp`、`Map`、`Set`、`ArrayBuffer`、`Blob`、循環参照など

```js
// ✅ 循環参照を処理できる
const obj = { a: 1 };
obj.self = obj;
const copy = structuredClone(obj); // 正常に動作
```

**非対応の型**：

```js
// ❌ 関数 — DataCloneError がスローされる
structuredClone({ fn: () => {} });

// ❌ DOM ノード
structuredClone({ el: document.body });

// ❌ プロトタイプチェーン（コピー後はプレーンオブジェクトになる）
class User {
  greet() {}
}
const user = new User();
const copy = structuredClone(user);
console.log(copy instanceof User); // false
```

---

### `JSON.parse(JSON.stringify())`

シンプルだが落とし穴が多い。純粋なデータ（特殊な型なし）の場合のみ適している

```js
const original = { a: 1, nested: { b: 2 } };
const copy = JSON.parse(JSON.stringify(original));

copy.nested.b = 99;
console.log(original.nested.b); // 2 ✅
```

**注意すべき落とし穴**：

```js
const obj = {
  date: new Date(), // ❌ → 文字列になる
  regex: /abc/g, // ❌ → 空オブジェクト {} になる
  fn: () => {}, // ❌ → 消失する
  undef: undefined, // ❌ → 消失する
  nan: NaN, // ❌ → null になる
  infinity: Infinity, // ❌ → null になる
  map: new Map(), // ❌ → 空オブジェクト {} になる
  set: new Set([1, 2]), // ❌ → 空オブジェクト {} になる
};

const copy = JSON.parse(JSON.stringify(obj));
// { date: "2024-01-01T...", regex: {}, nan: null, infinity: null, map: {}, set: {} }
// fn と undef は完全に消失

// ❌ 循環参照 → エラーが発生
const circular = { a: 1 };
circular.self = circular;
JSON.parse(JSON.stringify(circular)); // TypeError
```

::: warning
`JSON.parse(JSON.stringify())` の主な問題点：`undefined` と関数が消失する、`Date` が文字列になる、循環参照を処理できない
:::

## 手書きディープコピー

基礎版 → WeakMap で循環参照を処理 → 完全版で特殊な型を処理。詳細は[手書きディープコピー](./deep-clone)を参照

## 方法の比較

| 方法 | 深/浅 | 循環参照 | Date | RegExp | Map/Set | 関数 |
|------|-------|---------|------|--------|---------|------|
| `...` / `Object.assign()` | 浅 | — | — | — | — | — |
| `JSON.parse(JSON.stringify())` | 深 | ❌ エラー | ❌ 文字列化 | ❌ `{}` になる | ❌ `{}` になる | ❌ 消失 |
| `structuredClone()` | 深 | ✅ | ✅ | ✅ | ✅ | ❌ エラー |
| 手書き再帰 + WeakMap | 深 | ✅ | ✅ 要対応 | ✅ 要対応 | ✅ 要対応 | 対応可能 |

::: tip 選定の指針
- **日常の開発**：`structuredClone()` で十分
- **純粋な JSON データ**：`JSON.parse(JSON.stringify())` がシンプルで高効率
- **浅い階層のオブジェクト**：`...` スプレッドが最も簡潔
- **関数やプロトタイプチェーンのコピーが必要**：手書きか lodash の `cloneDeep`
:::
