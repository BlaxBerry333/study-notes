# 手写深拷贝

> Deep Clone Implementation

## 基础版

```js
function deepClone(obj) {
  if (obj === null || typeof obj !== "object") return obj;

  const copy = Array.isArray(obj) ? [] : {};
  for (const key in obj) {
    if (obj.hasOwnProperty(key)) {
      copy[key] = deepClone(obj[key]); // 递归
    }
  }
  return copy;
}
```

::: warning
循环引用会导致无限递归 → 栈溢出
:::

---

## WeakMap 处理循环引用

用 `WeakMap` 记录已拷贝过的对象，遇到重复引用直接返回

```js
function deepClone(obj, cache = new WeakMap()) {
  if (obj === null || typeof obj !== "object") return obj;

  // 循环引用检测
  if (cache.has(obj)) return cache.get(obj);

  const copy = Array.isArray(obj) ? [] : {};
  cache.set(obj, copy); // 先记录再递归，防止循环

  for (const key in obj) {
    if (obj.hasOwnProperty(key)) {
      copy[key] = deepClone(obj[key], cache);
    }
  }
  return copy;
}

// 验证
const obj = { a: 1 };
obj.self = obj;
const copy = deepClone(obj);
console.log(copy.self === copy); // true ✅ 循环引用被正确处理
console.log(copy !== obj); // true ✅ 是不同对象
```

::: warning
为什么用 `WeakMap` 而不是 `Map`？— WeakMap 的 key 是弱引用，拷贝完成后原对象如果没有其他引用就能被 GC 回收，不会造成内存泄漏
:::

---

## 完整版：特殊类型

```js
function deepClone(obj, cache = new WeakMap()) {
  // 原始类型直接返回
  if (obj === null || typeof obj !== "object") return obj;

  // 循环引用
  if (cache.has(obj)) return cache.get(obj);

  // 特殊类型处理
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

  // 普通对象和数组
  const copy = Array.isArray(obj) ? [] : {};
  cache.set(obj, copy);

  for (const key of Reflect.ownKeys(obj)) {
    // 包含 Symbol key
    copy[key] = deepClone(obj[key], cache);
  }
  return copy;
}
```

::: tip
通常写到"WeakMap 处理循环引用"就够了。特殊类型处理是加分项，需要时再补充
:::
