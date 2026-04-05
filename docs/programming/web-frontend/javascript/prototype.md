# 原型链

> Prototype Chain

JavaScript 的继承机制——对象通过原型链向上查找属性和方法

## 核心概念

```txt
                    null
                     ↑ __proto__
              ┌──────────────┐
              │ Object.proto │  ← 原型链终点
              │  .toString() │
              │  .hasOwn...  │
              └──────┬───────┘
                     ↑ __proto__
              ┌──────────────┐          ┌──────────────┐
              │ Person.proto │ ←─────── │  Person      │
              │  .greet()    │ prototype│ (构造函数)    │
              └──────┬───────┘          └──────────────┘
                     ↑ __proto__
              ┌──────────────┐
              │   alice      │
              │  .name       │  ← new Person("Alice") 的实例
              │  .age        │
              └──────────────┘
```

```js
function Person(name, age) {
  this.name = name; // 实例属性
  this.age = age;
}

Person.prototype.greet = function () {
  return `I'm ${this.name}`;
};

const alice = new Person("Alice", 25);

alice.greet(); // "I'm Alice" — 在 Person.prototype 上找到
alice.toString(); // "[object Object]" — 在 Object.prototype 上找到
alice.foo; // undefined — 原型链查找到 null，没找到
```

**三个关键属性**：

| 属性 | 说明 |
| --- | --- |
| `__proto__` | 实例的隐式原型，指向构造函数的 `prototype`（属性查找沿此链向上） |
| `prototype` | 构造函数的显式原型，被 `new` 出的实例共享 |
| `constructor` | `prototype` 上的属性，指回构造函数 |

```js
alice.__proto__ === Person.prototype; // true
Person.prototype.constructor === Person; // true
alice.__proto__.__proto__ === Object.prototype; // true
Object.prototype.__proto__ === null; // true — 原型链终点
```

---

## 属性查找机制

访问 `obj.prop` 时：
1. 在 `obj` 自身查找
2. 没找到 → 沿 `__proto__` 到原型对象上查找
3. 继续向上直到 `Object.prototype`
4. 还没找到 → 返回 `undefined`

```js
alice.hasOwnProperty("name"); // true — 自身属性
alice.hasOwnProperty("greet"); // false — 原型上的
"greet" in alice; // true — in 操作符会查原型链
```

::: warning 属性遮蔽

在实例上设置和原型同名的属性，会遮蔽原型上的：

```js
alice.greet = function () {
  return "override!";
};
alice.greet(); // "override!" — 自身属性优先
delete alice.greet;
alice.greet(); // "I'm Alice" — 恢复使用原型上的
```

:::

---

## ES6 class 语法

`class` 是原型链的语法糖——底层机制完全一样：

```js
class Person {
  constructor(name, age) {
    this.name = name;
    this.age = age;
  }

  greet() {
    return `I'm ${this.name}`;
  }

  // 静态方法——挂在构造函数上，不在 prototype 上
  static create(name) {
    return new Person(name, 0);
  }
}

class Student extends Person {
  constructor(name, age, grade) {
    super(name, age); // 调用父类构造函数
    this.grade = grade;
  }

  study() {
    return `${this.name} is studying`;
  }
}
```

等价于：

```js
function Person(name, age) {
  this.name = name;
  this.age = age;
}
Person.prototype.greet = function () {
  return `I'm ${this.name}`;
};

function Student(name, age, grade) {
  Person.call(this, name, age); // super()
  this.grade = grade;
}
Student.prototype = Object.create(Person.prototype); // extends
Student.prototype.constructor = Student;
Student.prototype.study = function () {
  return `${this.name} is studying`;
};
```

---

## 常见问题

### instanceof 的原理

`a instanceof B` 检查 `B.prototype` 是否在 `a` 的原型链上：

```js
alice instanceof Person; // true
alice instanceof Object; // true（Object.prototype 在原型链上）
[] instanceof Array; // true
[] instanceof Object; // true
```

---

### Object.create

创建一个以指定对象为原型的新对象：

```js
const proto = {
  greet() {
    return `I'm ${this.name}`;
  },
};

const user = Object.create(proto);
user.name = "Alice";
user.greet(); // "I'm Alice"
user.__proto__ === proto; // true

// Object.create(null) — 无原型对象（纯净字典）
const dict = Object.create(null);
dict.toString; // undefined（没有原型链）
```

---

### 为什么不推荐修改原生原型

```js
// ❌ 不要这么做
Array.prototype.last = function () {
  return this[this.length - 1];
};

// 问题：
// 1. 所有数组实例都受影响——全局污染
// 2. 和第三方库、未来 JS 标准可能冲突
// 3. for...in 遍历对象时会意外出现
```

::: tip

- 现代 JS 用 `class` 语法，不需要手动操作 `prototype`
- 理解原型链是为了：debug 时看 `__proto__` 链、理解 `instanceof`、理解 `this` 绑定
- `Object.create(null)` 在需要纯净字典（无 `toString` 等方法干扰）时有用

:::
