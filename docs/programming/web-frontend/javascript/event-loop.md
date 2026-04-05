# 事件循环

> Event Loop

JavaScript 是单线程的——同一时间只能执行一段代码。Event Loop 是浏览器/Node.js 用来处理异步任务的调度机制

## 执行模型

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

**关键规则**：
1. 执行调用栈中的同步代码
2. 调用栈清空后，**清空所有微任务**（包括微任务中新产生的微任务）
3. 取出**一个**宏任务执行
4. 回到步骤 2（再次清空微任务）
5. 循环...

---

## 经典题目

### 基础执行顺序

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

### 微任务嵌套

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

### async/await 的本质

`async/await` 是 Promise 的语法糖——`await` 之后的代码相当于 `.then()` 的回调：

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
1. `console.log("4")` — 同步
2. `foo()` 开始执行：`console.log("1")` — 同步
3. `await bar()` → `bar()` 执行：`console.log("3")` — 同步
4. `await` 暂停 `foo()`，控制权返回外部
5. `console.log("5")` — 同步
6. 调用栈清空 → 执行微任务 → `console.log("2")`

---

### setTimeout 精度

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

::: warning 常见误区

- `setTimeout(fn, 0)` 不保证 0ms 后执行，只保证"不会比当前同步代码和微任务更早"
- 微任务队列如果不断产生新微任务（无限递归 `.then()`），宏任务会被饿死——页面卡死
- `requestAnimationFrame` 的执行时机在微任务之后、下一帧渲染之前

:::

---

## Node.js 的差异

Node.js 的事件循环有额外的阶段（`process.nextTick`、`setImmediate`）：

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
