# クロージャ

> Closure

関数が定義時のスコープにある変数を「記憶」してアクセスする――たとえその関数がそのスコープの外で実行されても

## 基本概念

```js
function createCounter() {
  let count = 0; // 外部函数的局部变量

  return function increment() {
    count++; // 内部函数引用了外部变量 → 闭包
    return count;
  };
}

const counter = createCounter();
counter(); // 1
counter(); // 2
counter(); // 3
// count 没有被销毁——increment 函数"关住"了它
```

**クロージャの本質**：関数 + それが参照する外部変数 = クロージャ。内部関数が参照されている限り、外部関数のスコープはガベージコレクションされない

---

## よくある活用例

### データのカプセル化

```js
function createUser(name) {
  let _password = ""; // 私有变量，外部无法直接访问

  return {
    getName: () => name,
    setPassword: (pw) => {
      _password = pw;
    },
    checkPassword: (pw) => pw === _password,
  };
}

const user = createUser("Alice");
user.setPassword("secret");
user.checkPassword("secret"); // true
// user._password → undefined（无法访问）
```

---

### 関数のカリー化

```js
function multiply(a) {
  return function (b) {
    return a * b; // a 被闭包捕获
  };
}

const double = multiply(2);
const triple = multiply(3);
double(5); // 10
triple(5); // 15
```

---

### デバウンス / スロットル

```js
// 防抖：最后一次调用后等 delay 再执行
function debounce(fn, delay) {
  let timer; // 闭包捕获 timer
  return function (...args) {
    clearTimeout(timer);
    timer = setTimeout(() => fn.apply(this, args), delay);
  };
}

// 节流：每 interval 毫秒最多执行一次
function throttle(fn, interval) {
  let lastTime = 0; // 闭包捕获 lastTime
  return function (...args) {
    const now = Date.now();
    if (now - lastTime >= interval) {
      lastTime = now;
      fn.apply(this, args);
    }
  };
}
```

---

## 典型的な落とし穴

### for ループ + var

```js
// ❌ var 是函数作用域，循环结束后 i = 5
for (var i = 0; i < 5; i++) {
  setTimeout(() => console.log(i), 100);
}
// 输出: 5 5 5 5 5（所有回调共享同一个 i）

// ✅ 方案 1: 用 let（块级作用域，每次循环创建新变量）
for (let i = 0; i < 5; i++) {
  setTimeout(() => console.log(i), 100);
}
// 输出: 0 1 2 3 4

// ✅ 方案 2: 用 IIFE 创建闭包（ES5 时代的做法）
for (var i = 0; i < 5; i++) {
  (function (j) {
    setTimeout(() => console.log(j), 100);
  })(i);
}
```

---

### React Hooks における stale closure

```tsx
function Counter() {
  const [count, setCount] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      // ❌ count 被闭包捕获为初始值 0，永远打印 0
      console.log(count);
    }, 1000);
    return () => clearInterval(timer);
  }, []); // 空依赖 → effect 只在挂载时创建，闭包里的 count 永远是 0

  // ✅ 方案 1: 把 count 加入依赖数组
  useEffect(() => {
    const timer = setInterval(() => console.log(count), 1000);
    return () => clearInterval(timer);
  }, [count]); // count 变化时重新创建 effect

  // ✅ 方案 2: 用 ref 保存最新值
  const countRef = useRef(count);
  countRef.current = count;

  useEffect(() => {
    const timer = setInterval(() => {
      console.log(countRef.current); // 总是读到最新值
    }, 1000);
    return () => clearInterval(timer);
  }, []);
}
```

::: warning stale closure は React で最もよくあるバグの原因の一つ

- `useEffect`、`useCallback`、`useMemo` のコールバックはすべてクロージャ
- 依存配列でコールバック内で参照している state/props を漏らすと、クロージャは古い値をキャプチャする
- ESLint の `react-hooks/exhaustive-deps` ルールで依存の漏れを自動検出できる

:::

---

## メモリリーク

クロージャはガベージコレクションを妨げる――クロージャのライフサイクルが長い場合、参照されている変数は解放されない：

```js
// ❌ 潜在内存泄漏
function setup() {
  const hugeData = new Array(1000000).fill("x"); // 大数组

  return function process() {
    // 即使 process 不使用 hugeData，
    // 某些引擎可能仍保留整个作用域
    return "done";
  };
}

// ✅ 及时解除引用
function setup() {
  let hugeData = new Array(1000000).fill("x");
  const result = processData(hugeData);
  hugeData = null; // 手动释放

  return function getResult() {
    return result;
  };
}
```

::: tip

- イベントリスナーが外部の大きなオブジェクトを参照している場合、コンポーネント破棄時に `removeEventListener` すること
- `setInterval` のコールバックはクロージャ――`clearInterval` を忘れる = メモリリーク
- React の `useEffect` がクリーンアップ関数を返すのは、まさにこの問題を解決するため

:::
