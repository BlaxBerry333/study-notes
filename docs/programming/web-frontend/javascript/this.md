# this

> JavaScript 中 `this` 的值取决于**函数怎么被调用**，而非在哪里定义

## 四条绑定规则

按优先级从高到低：

```txt
① new 绑定        → this = 新创建的对象
② 显式绑定        → this = call/apply/bind 指定的对象
③ 隐式绑定        → this = 调用者（obj.fn() → obj）
④ 默认绑定        → this = window（严格模式下 undefined）
⑤ 箭头函数（特殊） → 没有自己的 this，继承定义时外层的 this
```

---

### 默认绑定

独立调用函数时，`this` 指向全局对象（严格模式下 `undefined`）：

```js
function greet() {
  console.log(this);
}

greet(); // window（浏览器）/ global（Node）
// 严格模式下 → undefined
```

---

### 隐式绑定

通过对象调用时，`this` 指向该对象：

```js
const user = {
  name: "Alice",
  greet() {
    console.log(this.name);
  },
};

user.greet(); // "Alice" — this = user
```

::: danger 隐式绑定丢失

把方法赋值给变量或作为回调传递时，`this` 会丢失：

```js
const greet = user.greet;
greet(); // undefined — 独立调用，退化为默认绑定

// 回调中丢失
setTimeout(user.greet, 100); // undefined — setTimeout 内部是独立调用

// 解构也会丢失
const { greet } = user;
greet(); // undefined
```

这是 JS 中**最常见的 this 陷阱**——React class 组件中 `onClick={this.handleClick}` 就是这个问题

:::

---

### 显式绑定

用 `call` / `apply` / `bind` 手动指定 `this`：

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

| 方法 | 是否立即调用 | 参数传递方式 | 用途 |
| --- | --- | --- | --- |
| `call` | ✅ | 逐个传 `fn.call(obj, a, b)` | 借用方法 |
| `apply` | ✅ | 数组传 `fn.apply(obj, [a, b])` | 参数是数组时 |
| `bind` | ❌（返回新函数） | 逐个传 | 固定 this（事件回调、定时器） |

---

### new 绑定

`new` 调用构造函数时，`this` 指向新创建的实例对象：

```js
function Person(name) {
  // this = 新创建的空对象 {}
  this.name = name;
  // 自动 return this
}

const alice = new Person("Alice");
console.log(alice.name); // "Alice"
```

`new` 的过程：
1. 创建空对象 `{}`
2. 将空对象的 `__proto__` 指向构造函数的 `prototype`
3. 将 `this` 绑定到空对象，执行构造函数
4. 如果构造函数没有显式 return 对象，返回 `this`

---

### 箭头函数

箭头函数**没有自己的 this**——它继承定义时外层作用域的 `this`，且无法被 `call`/`apply`/`bind` 改变：

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

::: warning 箭头函数不适合的场景

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

## 综合判断题

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

## React 中的 this

### class 组件（了解即可）

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

### 函数组件不需要关心 this

函数组件中没有 `this` 的问题——Hooks + 闭包替代了 `this.state` / `this.props`：

```tsx
function Counter() {
  const [count, setCount] = useState(0);
  // 不需要 this，直接用闭包中的 count
  return <button onClick={() => setCount(count + 1)}>{count}</button>;
}
```

::: tip 为什么函数组件是趋势

class 组件的三大痛点——`this` 绑定问题、生命周期方法逻辑分散、难以复用有状态逻辑——函数组件 + Hooks 全部解决了。现代 React 项目几乎不再使用 class 组件，但面试可能会问 `this` 相关的 class 组件问题来考察 JS 基础

:::
