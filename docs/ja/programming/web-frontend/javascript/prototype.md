# プロトタイプチェーン

> Prototype Chain

JavaScript の継承メカニズム――オブジェクトがプロトタイプチェーンを通じてプロパティやメソッドを上方向に検索する

## コア概念

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

**3つの重要なプロパティ**：

| プロパティ | 説明 |
| --- | --- |
| `__proto__` | インスタンスの暗黙的プロトタイプ。コンストラクタ関数の `prototype` を指す（プロパティ検索はこのチェーンを辿る） |
| `prototype` | コンストラクタ関数の明示的プロトタイプ。`new` で生成されたインスタンスが共有する |
| `constructor` | `prototype` 上のプロパティで、コンストラクタ関数を指し返す |

```js
alice.__proto__ === Person.prototype; // true
Person.prototype.constructor === Person; // true
alice.__proto__.__proto__ === Object.prototype; // true
Object.prototype.__proto__ === null; // true — 原型链终点
```

---

## プロパティ検索メカニズム

`obj.prop` にアクセスする際：
1. `obj` 自身で検索
2. 見つからない → `__proto__` を辿ってプロトタイプオブジェクトで検索
3. `Object.prototype` まで上方向に検索を続ける
4. まだ見つからない → `undefined` を返す

```js
alice.hasOwnProperty("name"); // true — 自身属性
alice.hasOwnProperty("greet"); // false — 原型上的
"greet" in alice; // true — in 操作符会查原型链
```

::: warning プロパティのシャドウイング

インスタンスにプロトタイプと同名のプロパティを設定すると、プロトタイプ上のプロパティをシャドウする：

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

## ES6 class 構文

`class` はプロトタイプチェーンのシンタックスシュガーで、内部の仕組みは全く同じ：

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

等価な記述：

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

## よくある質問

### instanceof の原理

`a instanceof B` は `B.prototype` が `a` のプロトタイプチェーン上にあるかを確認する：

```js
alice instanceof Person; // true
alice instanceof Object; // true（Object.prototype 在原型链上）
[] instanceof Array; // true
[] instanceof Object; // true
```

---

### Object.create

指定したオブジェクトをプロトタイプとする新しいオブジェクトを作成する：

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

### ネイティブプロトタイプの変更が推奨されない理由

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

- モダン JS では `class` 構文を使い、手動で `prototype` を操作する必要はない
- プロトタイプチェーンを理解する目的：デバッグ時に `__proto__` チェーンを確認する、`instanceof` を理解する、`this` バインディングを理解する
- `Object.create(null)` は純粋な辞書（`toString` などのメソッドの干渉がない）が必要な場合に有用

:::
