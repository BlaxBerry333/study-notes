# 手書きディープコピー

> Deep Clone Implementation

## 基礎版

```js
function deepClone(obj) {
  if (obj === null || typeof obj !== "object") return obj;

  const copy = Array.isArray(obj) ? [] : {};
  for (const key in obj) {
    if (obj.hasOwnProperty(key)) {
      copy[key] = deepClone(obj[key]); // 再帰
    }
  }
  return copy;
}
```

::: warning
循環参照があると無限再帰 → スタックオーバーフローが発生する
:::

---

## WeakMap で循環参照を処理

`WeakMap` でコピー済みのオブジェクトを記録し、重複する参照に遭遇したらそのまま返す

```js
function deepClone(obj, cache = new WeakMap()) {
  if (obj === null || typeof obj !== "object") return obj;

  // 循環参照の検出
  if (cache.has(obj)) return cache.get(obj);

  const copy = Array.isArray(obj) ? [] : {};
  cache.set(obj, copy); // 再帰の前に記録しておく（循環防止）

  for (const key in obj) {
    if (obj.hasOwnProperty(key)) {
      copy[key] = deepClone(obj[key], cache);
    }
  }
  return copy;
}

// 検証
const obj = { a: 1 };
obj.self = obj;
const copy = deepClone(obj);
console.log(copy.self === copy); // true ✅ 循環参照が正しく処理されている
console.log(copy !== obj); // true ✅ 異なるオブジェクトである
```

::: warning
なぜ `Map` ではなく `WeakMap` を使うのか？ ── WeakMap のキーは弱参照であり、コピー完了後に元のオブジェクトへの参照がなくなれば GC で回収される。メモリリークを防止できる
:::

---

## 完全版：特殊な型の処理

```js
function deepClone(obj, cache = new WeakMap()) {
  // プリミティブ型はそのまま返す
  if (obj === null || typeof obj !== "object") return obj;

  // 循環参照
  if (cache.has(obj)) return cache.get(obj);

  // 特殊な型の処理
  if (obj instanceof Date) return new Date(obj);
  if (obj instanceof RegExp) return new RegExp(obj.source, obj.flags);
  if (obj instanceof Map) {
    const map = new Map();
    cache.set(obj, map);
    obj.forEach((val, key) =>
      map.set(deepClone(key, cache), deepClone(val, cache)),
    );
    return map;
  }
  if (obj instanceof Set) {
    const set = new Set();
    cache.set(obj, set);
    obj.forEach((val) => set.add(deepClone(val, cache)));
    return set;
  }

  // 通常のオブジェクトと配列
  const copy = Array.isArray(obj) ? [] : {};
  cache.set(obj, copy);

  for (const key of Reflect.ownKeys(obj)) {
    // Symbol キーも含む
    copy[key] = deepClone(obj[key], cache);
  }
  return copy;
}
```

::: tip
通常は「WeakMap で循環参照を処理」まで書ければ十分である。特殊な型の処理は加点要素であり、必要に応じて追加すればよい
:::
