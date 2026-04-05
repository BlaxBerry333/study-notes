# 异步编程

> Promise / async-await

## Promise

Promise 表示一个异步操作的最终结果——三种状态：`pending`（进行中）、`fulfilled`（成功）、`rejected`（失败）

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

::: warning 状态不可逆

Promise 一旦从 `pending` 变为 `fulfilled` 或 `rejected`，就不能再变。多次调用 `resolve` / `reject` 只有第一次生效

:::

---

### 链式调用

`.then()` 返回新的 Promise，可以链式调用避免回调嵌套：

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

### 静态方法

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

| 方法 | 成功条件 | 失败条件 | 用途 |
| --- | --- | --- | --- |
| `all` | 全部成功 | 任一失败 | 并行请求，全部需要 |
| `allSettled` | 永远 fulfilled | — | 并行请求，需要知道每个结果 |
| `race` | 第一个完成 | 第一个完成（如果是 reject） | 超时控制 |
| `any` | 第一个成功 | 全部失败 | 冗余请求，取最快成功的 |

---

## async / await

Promise 的语法糖——用同步风格写异步代码：

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

### 错误处理

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

### 并行 vs 串行

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

::: warning 常见错误

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

## 实战模式

### 超时控制

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

### 重试

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

### 并发控制

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
