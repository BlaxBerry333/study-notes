# this

> JavaScript における `this` の値は**関数がどのように呼び出されるか**で決まり、どこで定義されたかではない

## 4つのバインディングルール

優先度の高い順：

```txt
① new 绑定        → this = 新创建的对象
② 显式绑定        → this = call/apply/bind 指定的对象
③ 隐式绑定        → this = 调用者（obj.fn() → obj）
④ 默认绑定        → this = window（严格模式下 undefined）
⑤ 箭头函数（特殊） → 没有自己的 this，继承定义时外层的 this
```

---

### デフォルトバインディング

関数を単独で呼び出す場合、`this` はグローバルオブジェクトを指す（strictモードでは `undefined`）：

```js
function greet() {
  console.log(this);
}

greet(); // window（浏览器）/ global（Node）
// 严格模式下 → undefined
```

---

### 暗黙的バインディング

オブジェクト経由で呼び出す場合、`this` はそのオブジェクトを指す：

```js
const user = {
  name: "Alice",
  greet() {
    console.log(this.name);
  },
};

user.greet(); // "Alice" — this = user
```

::: danger 暗黙的バインディングの消失

メソッドを変数に代入したりコールバックとして渡すと、`this` が失われる：

```js
const greet = user.greet;
greet(); // undefined — 独立调用，退化为默认绑定

// 回调中丢失
setTimeout(user.greet, 100); // undefined — setTimeout 内部是独立调用

// 解构也会丢失
const { greet } = user;
greet(); // undefined
```

これは JS で**最もよくある this の罠**――React class コンポーネントの `onClick={this.handleClick}` がまさにこの問題

:::

---

### 明示的バインディング

`call` / `apply` / `bind` で手動的に `this` を指定する：

```js
function greet(greeting) {
  console.log(`${greeting}, ${this.name}`);
}

const user = { name: "Alice" };

// call: 立即调用，参数逐个传
greet.call(user, "Hello"); // "Hello, Alice"

// apply: 立即调用，参数用数组
greet.apply(user, ["Hello"]); // "Hello, Alice"

// bind: 返回新函数，永久绑定 this（不立即调用）
const greetAlice = greet.bind(user);
greetAlice("Hi"); // "Hi, Alice"

// bind 后再 call 也改不了 this
greetAlice.call({ name: "Bob" }, "Hey"); // "Hey, Alice"（仍然是 Alice）
```

| メソッド | 即時呼び出し | 引数の渡し方 | 用途 |
| --- | --- | --- | --- |
| `call` | はい | 個別に `fn.call(obj, a, b)` | メソッドの借用 |
| `apply` | はい | 配列で `fn.apply(obj, [a, b])` | 引数が配列の場合 |
| `bind` | いいえ（新しい関数を返す） | 個別に | this の固定（イベントコールバック、タイマー） |

---

### new バインディング

`new` でコンストラクタ関数を呼び出すと、`this` は新しく作成されたインスタンスオブジェクトを指す：

```js
function Person(name) {
  // this = 新创建的空对象 {}
  this.name = name;
  // 自动 return this
}

const alice = new Person("Alice");
console.log(alice.name); // "Alice"
```

`new` のプロセス：
1. 空のオブジェクト `{}` を作成
2. 空のオブジェクトの `__proto__` をコンストラクタ関数の `prototype` に向ける
3. `this` を空のオブジェクトにバインドし、コンストラクタ関数を実行
4. コンストラクタ関数が明示的にオブジェクトを return しなければ、`this` を返す

---

### アロー関数

アロー関数は**独自の this を持たない**――定義時の外側スコープの `this` を継承し、`call`/`apply`/`bind` で変更できない：

```js
const user = {
  name: "Alice",

  // 普通函数：this = 调用者
  greet() {
    console.log(this.name); // "Alice"

    // 箭头函数：继承 greet 的 this
    const inner = () => {
      console.log(this.name); // "Alice" ✅
    };
    inner();

    // 普通函数：独立调用，this 丢失
    const inner2 = function () {
      console.log(this.name); // undefined ❌
    };
    inner2();
  },
};

user.greet();
```

::: warning アロー関数が適さないケース

```js
// ❌ 对象方法——箭头函数的 this 不是 obj，而是外层（可能是 window）
const obj = {
  name: "Alice",
  greet: () => {
    console.log(this.name); // undefined（this 是外层作用域的，不是 obj）
  },
};

// ❌ 需要动态 this 的回调
button.addEventListener("click", () => {
  console.log(this); // 不是 button，而是外层 this
});

// ✅ 这些场景用普通函数
const obj = {
  name: "Alice",
  greet() {
    console.log(this.name); // "Alice"
  },
};
```

:::

---

## 総合判断問題

```js
const obj = {
  name: "Alice",
  greet() {
    return this.name;
  },
  nested: {
    name: "Bob",
    greet() {
      return this.name;
    },
  },
};

obj.greet();               // "Alice"   — 隐式绑定，this = obj
obj.nested.greet();        // "Bob"     — 隐式绑定，this = obj.nested

const fn = obj.greet;
fn();                      // undefined — 隐式绑定丢失，默认绑定

const fn2 = obj.greet.bind(obj);
fn2();                     // "Alice"   — bind 显式绑定

new obj.greet();           // undefined — new 绑定，this 是新对象（没有 name 属性）
```

---

## React における this

### class コンポーネント（参考程度に）

```tsx
class Counter extends React.Component {
  state = { count: 0 };

  // ❌ 普通方法作为回调时 this 丢失
  handleClick() {
    this.setState({ count: this.state.count + 1 }); // this 是 undefined
  }

  // ✅ 方案 1: 箭头函数（类属性语法，this 永远指向实例）
  handleClick = () => {
    this.setState({ count: this.state.count + 1 });
  };

  // ✅ 方案 2: constructor 中 bind
  constructor(props) {
    super(props);
    this.handleClick = this.handleClick.bind(this);
  }

  render() {
    return <button onClick={this.handleClick}>{this.state.count}</button>;
  }
}
```

---

### 関数コンポーネントでは this を気にする必要がない

関数コンポーネントには `this` の問題がない――Hooks + クロージャが `this.state` / `this.props` を代替する：

```tsx
function Counter() {
  const [count, setCount] = useState(0);
  // 不需要 this，直接用闭包中的 count
  return <button onClick={() => setCount(count + 1)}>{count}</button>;
}
```

::: tip なぜ関数コンポーネントがトレンドなのか

class コンポーネントの3つの問題点――`this` バインディングの問題、ライフサイクルメソッドにロジックが分散する、ステートフルなロジックの再利用が困難――これらすべてを関数コンポーネント + Hooks が解決した。モダン React プロジェクトではほぼ class コンポーネントを使わないが、面接では JS の基礎を問うために `this` 関連の class コンポーネントの質問が出ることがある

:::
