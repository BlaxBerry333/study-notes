# 非同期プログラミング

> Promise / async-await

## Promise

Promise は非同期操作の最終結果を表す――3つの状態：`pending`（保留中）、`fulfilled`（成功）、`rejected`（失敗）

```js
// 创建 Promise
const promise = new Promise((resolve, reject) => {
  setTimeout(() => {
    const success = true;
    if (success) {
      resolve("数据"); // → fulfilled
    } else {
      reject(new Error("失败")); // → rejected
    }
  }, 1000);
});

// 消费 Promise
promise
  .then((data) => console.log(data)) // 成功回调
  .catch((err) => console.error(err)) // 失败回调
  .finally(() => console.log("完成")); // 无论成功失败都执行
```

::: warning 状態は不可逆

Promise は一度 `pending` から `fulfilled` または `rejected` に変わると、再び変更できない。`resolve` / `reject` を複数回呼び出しても、最初の1回のみ有効

:::

---

### チェーン呼び出し

`.then()` は新しい Promise を返すため、チェーン呼び出しでコールバックのネストを避けられる：

```js
// ❌ 回调地狱
getUser(id, (user) => {
  getPosts(user.id, (posts) => {
    getComments(posts[0].id, (comments) => {
      console.log(comments);
    });
  });
});

// ✅ Promise 链
getUser(id)
  .then((user) => getPosts(user.id))
  .then((posts) => getComments(posts[0].id))
  .then((comments) => console.log(comments))
  .catch((err) => console.error(err)); // 任何一步失败都会到这里
```

---

### スタティックメソッド

```js
// Promise.all: 全部成功才成功，一个失败就失败
const [users, posts] = await Promise.all([fetchUsers(), fetchPosts()]);

// Promise.allSettled: 等所有完成，不管成功失败
const results = await Promise.allSettled([api1(), api2(), api3()]);
results.forEach((result) => {
  if (result.status === "fulfilled") console.log(result.value);
  if (result.status === "rejected") console.log(result.reason);
});

// Promise.race: 第一个完成的（无论成功失败）
const result = await Promise.race([fetchData(), timeout(5000)]);

// Promise.any: 第一个成功的（忽略失败）
const fastest = await Promise.any([cdn1(), cdn2(), cdn3()]);
```

| メソッド | 成功条件 | 失敗条件 | 用途 |
| --- | --- | --- | --- |
| `all` | 全て成功 | いずれか失敗 | 並列リクエスト、全て必要な場合 |
| `allSettled` | 常に fulfilled | --- | 並列リクエスト、各結果を知りたい場合 |
| `race` | 最初に完了 | 最初に完了（reject の場合） | タイムアウト制御 |
| `any` | 最初に成功 | 全て失敗 | 冗長リクエスト、最速の成功を取得 |

---

## async / await

Promise のシンタックスシュガーで、同期スタイルで非同期コードを記述できる：

```js
// async 函数始终返回 Promise
async function getUser(id) {
  // await 暂停函数执行，等待 Promise resolve
  const response = await fetch(`/api/users/${id}`);
  const user = await response.json();
  return user; // 自动包装为 Promise.resolve(user)
}
```

---

### エラーハンドリング

```js
// try/catch 捕获 await 的 reject
async function fetchData() {
  try {
    const res = await fetch("/api/data");
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (err) {
    console.error("请求失败:", err);
    return null; // 返回默认值
  }
}
```

---

### 並列 vs 直列

```js
// ❌ 串行：两个请求依次执行，总耗时 = t1 + t2
async function slow() {
  const users = await fetchUsers(); // 等 1s
  const posts = await fetchPosts(); // 再等 1s
  // 总共 2s
}

// ✅ 并行：同时发起，总耗时 = max(t1, t2)
async function fast() {
  const [users, posts] = await Promise.all([
    fetchUsers(), // 同时发起
    fetchPosts(), // 同时发起
  ]);
  // 总共 1s
}
```

::: warning よくあるエラー

```js
// ❌ forEach 里用 await 不会等待
items.forEach(async (item) => {
  await processItem(item); // 这些是并行执行的，不是串行！
});

// ✅ 串行处理：用 for...of
for (const item of items) {
  await processItem(item);
}

// ✅ 并行处理：用 Promise.all + map
await Promise.all(items.map((item) => processItem(item)));
```

:::

---

## 実践パターン

### タイムアウト制御

```js
function withTimeout(promise, ms) {
  const timeout = new Promise((_, reject) =>
    setTimeout(() => reject(new Error(`超时: ${ms}ms`)), ms),
  );
  return Promise.race([promise, timeout]);
}

// 使用
const data = await withTimeout(fetch("/api/slow"), 5000);
```

---

### リトライ

```js
async function retry(fn, maxRetries = 3, delay = 1000) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      if (attempt === maxRetries) throw err;
      await new Promise((r) => setTimeout(r, delay * attempt)); // 指数退避
    }
  }
}

// 使用
const data = await retry(() => fetch("/api/flaky").then((r) => r.json()));
```

---

### 同時実行数制御

```js
// 最多同时执行 N 个 Promise
async function parallel(tasks, concurrency = 3) {
  const results = [];
  let index = 0;

  async function worker() {
    while (index < tasks.length) {
      const i = index++;
      results[i] = await tasks[i]();
    }
  }

  await Promise.all(Array.from({ length: concurrency }, worker));
  return results;
}

// 使用：100 个请求，最多同时 5 个
const tasks = urls.map((url) => () => fetch(url));
const results = await parallel(tasks, 5);
```
