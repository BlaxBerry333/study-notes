# イベントループ

> Event Loop

JavaScript はシングルスレッドで、同時に1つのコードしか実行できない。Event Loop はブラウザ/Node.js が非同期タスクを処理するためのスケジューリングメカニズム

## 実行モデル

```txt
┌─────────────────────────────────────────────────┐
│                   调用栈                         │
│              (Call Stack)                        │
│         同步代码在这里执行                        │
│         一次只能执行一个任务                       │
└─────────────────────┬───────────────────────────┘
                      │ 栈空后检查
                      ▼
┌─────────────────────────────────────────────────┐
│              微任务队列                           │
│           (Microtask Queue)                     │
│     Promise.then / queueMicrotask               │
│     MutationObserver                            │
│     ⚡ 优先级最高，全部执行完才继续                 │
└─────────────────────┬───────────────────────────┘
                      │ 微任务队列清空后
                      ▼
┌─────────────────────────────────────────────────┐
│              宏任务队列                           │
│           (Macrotask Queue)                     │
│     setTimeout / setInterval                    │
│     I/O / UI 渲染 / requestAnimationFrame       │
│     📦 每次只取一个，然后回去检查微任务             │
└─────────────────────────────────────────────────┘
```

**重要なルール**：
1. コールスタック内の同期コードを実行する
2. コールスタックが空になったら、**全てのマイクロタスクをクリア**する（マイクロタスク内で新たに生成されたマイクロタスクも含む）
3. **1つの**マクロタスクを取り出して実行する
4. ステップ2に戻る（再びマイクロタスクをクリア）
5. ループ...

---

## 典型的な問題

### 基本的な実行順序

```js
console.log("1"); // 同步

setTimeout(() => {
  console.log("2"); // 宏任务
}, 0);

Promise.resolve().then(() => {
  console.log("3"); // 微任务
});

console.log("4"); // 同步

// 输出: 1 → 4 → 3 → 2
// 同步代码先执行完 → 微任务 → 宏任务
```

---

### マイクロタスクのネスト

```js
Promise.resolve()
  .then(() => {
    console.log("1");
    return Promise.resolve("2");
  })
  .then((val) => {
    console.log(val);
  });

Promise.resolve().then(() => {
  console.log("3");
});

// 输出: 1 → 3 → 2
// return Promise.resolve() 不是直接 resolve，而是要经过额外的微任务处理
// 因此 "2" 被推迟了，让同一轮微任务中排在后面的 "3" 先执行
```

---

### async/await の本質

`async/await` は Promise のシンタックスシュガーで、`await` 以降のコードは `.then()` のコールバックに相当する：

```js
async function foo() {
  console.log("1"); // 同步
  await bar(); // 等价于 bar().then(() => { ... })
  console.log("2"); // 微任务（await 之后）
}

async function bar() {
  console.log("3"); // 同步
}

console.log("4"); // 同步
foo();
console.log("5"); // 同步

// 输出: 4 → 1 → 3 → 5 → 2
```

分析：
1. `console.log("4")` — 同期処理
2. `foo()` の実行開始：`console.log("1")` — 同期処理
3. `await bar()` → `bar()` を実行：`console.log("3")` — 同期処理
4. `await` で `foo()` を一時停止、制御が外部に戻る
5. `console.log("5")` — 同期処理
6. コールスタックが空になる → マイクロタスクを実行 → `console.log("2")`

---

### setTimeout の精度

```js
// setTimeout(fn, 0) 不是"立即执行"
// 而是"在当前同步代码和微任务执行完后，尽快执行"
// 最小延迟约 4ms（浏览器限制）

console.log("start");
setTimeout(() => console.log("timeout"), 0);
Promise.resolve().then(() => console.log("promise"));
console.log("end");

// start → end → promise → timeout
// Promise（微任务）永远先于 setTimeout（宏任务）
```

::: warning よくある誤解

- `setTimeout(fn, 0)` は 0ms 後の実行を保証するのではなく、「現在の同期コードとマイクロタスクより早くならない」ことだけを保証する
- マイクロタスクキューが新しいマイクロタスクを生成し続ける（無限再帰 `.then()`）と、マクロタスクが実行されなくなり、ページがフリーズする
- `requestAnimationFrame` の実行タイミングはマイクロタスクの後、次のフレームのレンダリング前

:::

---

## Node.js の違い

Node.js のイベントループには追加のフェーズ（`process.nextTick`、`setImmediate`）がある：

```js
// process.nextTick: 比 Promise.then 优先级更高
Promise.resolve().then(() => console.log("promise"));
process.nextTick(() => console.log("nextTick"));

// nextTick → promise

// setImmediate: 在 I/O 回调之后执行
setTimeout(() => console.log("timeout"), 0);
setImmediate(() => console.log("immediate"));

// 顺序不确定（取决于事件循环启动速度）
// 但在 I/O 回调内部，setImmediate 总是先于 setTimeout
```
