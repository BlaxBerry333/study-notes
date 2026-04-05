---
prev: false
next: false
---

# TypeScript

JavaScript 的超集——在 JS 基础上增加**静态类型系统**，编译时捕获错误而非运行时崩溃

::: warning 特点:

- 编译时类型检查，消除 `undefined is not a function` 类运行时错误
- 完整的类型推导，大部分场景不需要手动标注类型
- 渐进式采用——`.js` 文件可以逐步迁移为 `.ts`，不需要一次性重写
- 强大的 IDE 支持（自动补全、重构、跳转定义），编辑器就是最好的文档
- 编译后产物是纯 JavaScript，零运行时开销

:::

## 基础概念

| 概念 | 一句话说明 | 详细 |
| --- | --- | --- |
| 基本类型 | `string`、`number`、`boolean`、`null`、`undefined`、`bigint`、`symbol` | — |
| 特殊类型 | `any`（跳过检查）、`unknown`（安全的 any）、`never`（不可能的值）、`void`（无返回） | [详见](#特殊类型) |
| 联合类型 | `A \| B`——值可以是 A 或 B | [详见](#联合类型与类型收窄) |
| 交叉类型 | `A & B`——同时满足 A 和 B | [详见](#交叉类型) |
| 字面量类型 | `"success" \| "error"` 而非 `string` | [详见](#字面量类型) |
| 类型别名 | `type Point = { x: number; y: number }` | — |
| 接口 | `interface Point { x: number; y: number }` | [详见](#type-vs-interface) |
| 泛型 | 类型的参数化，写一次逻辑适配多种类型 | [详见](/programming/web-frontend/typescript/generics) |
| 工具类型 | 内置的类型变换（`Partial`、`Pick`、`Omit` 等） | [详见](/programming/web-frontend/typescript/utility-types) |
| 类型收窄 | 通过条件判断让 TS 自动缩小类型范围 | [详见](#联合类型与类型收窄) |
| 类型断言 | `value as Type`——告诉编译器"我比你更清楚" | [详见](#类型断言) |
| 类型守卫 | 自定义函数帮助 TS 收窄类型 | [详见](#自定义类型守卫) |

## 基本使用

### 变量与函数

```ts
// 变量：大部分情况 TS 自动推导，不需要手动标注
const name = "Alice"; // 推导为 "Alice"（字面量类型）
let age = 25; // 推导为 number
const scores: number[] = [90, 85, 92]; // 数组

// 函数：参数必须标注，返回值通常自动推导
function greet(name: string, age?: number): string {
  return age ? `${name} (${age})` : name;
}

// 箭头函数
const add = (a: number, b: number) => a + b;

// 函数重载
function parse(input: string): number;
function parse(input: number): string;
function parse(input: string | number): number | string {
  return typeof input === "string" ? Number(input) : String(input);
}
```

---

### 对象与数组

```ts
// 对象类型
type User = {
  id: string;
  name: string;
  email?: string; // 可选属性
  readonly createdAt: Date; // 只读
};

// 索引签名——键不确定时
type Dictionary = {
  [key: string]: unknown;
};

// Record 更简洁
type StatusMap = Record<string, boolean>;

// 元组——固定长度、每个位置类型不同的数组
type Coordinate = [number, number];
type Response = [data: User, error: null] | [data: null, error: Error];
```

---

### 特殊类型

```ts
// any: 跳过一切类型检查（逃生舱，尽量不用）
let data: any = fetchSomething();
data.foo.bar; // 不报错，运行时可能炸

// unknown: 安全的 any——必须收窄后才能使用
let input: unknown = getInput();
// input.toString()  // ❌ 编译错误
if (typeof input === "string") {
  input.toUpperCase(); // ✅ 收窄后可用
}

// never: 不可能有值的类型
function throwError(msg: string): never {
  throw new Error(msg); // 函数永远不会正常返回
}

// void: 函数没有返回值
function logMessage(msg: string): void {
  console.log(msg);
}
```

::: warning any vs unknown

- `any`：**关闭类型检查**——可以赋值给任何类型，也可以访问任何属性。用于渐进式迁移 JS → TS 的过渡期
- `unknown`：**开启安全模式**——必须先判断类型才能使用。接收外部数据（API 响应、用户输入、JSON.parse）时应该用 `unknown` 而非 `any`

```ts
function handleApiResponse(data: unknown) {
  // ❌ data.name  → 编译错误
  if (isUser(data)) {
    data.name; // ✅ 收窄后安全使用
  }
}
```

:::

---

### 联合类型与类型收窄

联合类型表示"值可以是 A 或 B"，使用时需要通过条件判断**收窄**到具体类型：

```ts
type Result = { status: "success"; data: User } | { status: "error"; message: string };

function handleResult(result: Result) {
  // 可辨识联合：通过共有字段 status 收窄
  if (result.status === "success") {
    console.log(result.data.name); // TS 知道这里是 success 分支
  } else {
    console.log(result.message); // TS 知道这里是 error 分支
  }
}
```

常见的收窄手段：

```ts
// typeof
function format(value: string | number) {
  if (typeof value === "string") return value.trim();
  return value.toFixed(2);
}

// instanceof
function getLength(input: string | string[]) {
  if (input instanceof Array) return input.length;
  return input.length;
}

// in 操作符
type Fish = { swim: () => void };
type Bird = { fly: () => void };

function move(animal: Fish | Bird) {
  if ("swim" in animal) {
    animal.swim();
  } else {
    animal.fly();
  }
}

// 真值检查（排除 null / undefined）
function greet(name?: string) {
  if (name) {
    // string（排除了 undefined）
    console.log(name.toUpperCase());
  }
}
```

---

### 自定义类型守卫

当内置的收窄手段不够用时（比如需要检查对象的具体结构），用 `is` 关键字定义类型守卫函数：

```ts
type User = { type: "user"; name: string; email: string };
type Admin = { type: "admin"; name: string; permissions: string[] };
type Account = User | Admin;

// 返回类型 `account is Admin` 告诉 TS：如果返回 true，参数就是 Admin
function isAdmin(account: Account): account is Admin {
  return account.type === "admin";
}

function showDashboard(account: Account) {
  if (isAdmin(account)) {
    console.log(account.permissions); // ✅ TS 知道是 Admin
  }
}

// 实用场景：过滤 null / undefined
function isNonNull<T>(value: T | null | undefined): value is T {
  return value != null;
}

const items = [1, null, 2, undefined, 3];
const valid = items.filter(isNonNull); // number[]（不是 (number | null | undefined)[]）
```

---

### 交叉类型

交叉类型将多个类型合并为一个——新类型同时拥有所有类型的属性：

```ts
type HasId = { id: string };
type HasTimestamp = { createdAt: Date; updatedAt: Date };
type HasName = { name: string };

// 同时满足三个类型
type Entity = HasId & HasTimestamp & HasName;
// 等价于 { id: string; name: string; createdAt: Date; updatedAt: Date }

// 实际用途：给已有类型添加额外字段
type WithPagination<T> = T & {
  page: number;
  pageSize: number;
  total: number;
};

type UserListResponse = WithPagination<{ users: User[] }>;
```

---

### 字面量类型

字面量类型限定变量只能是某些特定值，而非宽泛的 `string` / `number`：

```ts
// 字符串字面量
type HttpMethod = "GET" | "POST" | "PUT" | "DELETE";
type Theme = "light" | "dark";

// 数字字面量
type DiceRoll = 1 | 2 | 3 | 4 | 5 | 6;

// 模板字面量类型——字符串的模式匹配
type EventName = `on${string}`; // "onClick"、"onSubmit" 等
type CssProperty = `${string}-${string}`; // "font-size"、"margin-top" 等
type Locale = `${string}-${string}`; // "zh-CN"、"en-US" 等
```

::: tip const 断言

`as const` 让 TS 把值推导为最窄的字面量类型，而不是宽泛的 `string` / `number`：

```ts
// 不加 as const
const config = { endpoint: "/api", method: "GET" };
// 类型：{ endpoint: string; method: string }

// 加 as const
const config = { endpoint: "/api", method: "GET" } as const;
// 类型：{ readonly endpoint: "/api"; readonly method: "GET" }

// 常见用途：作为函数参数时保留字面量类型
const ROUTES = ["/home", "/about", "/contact"] as const;
type Route = (typeof ROUTES)[number]; // "/home" | "/about" | "/contact"
```

:::

---

### type vs interface

```ts
// interface：描述对象结构，支持声明合并和 extends
interface User {
  id: string;
  name: string;
}
interface Admin extends User {
  permissions: string[];
}

// type：更通用，可以描述联合、交叉、元组、原始类型
type ID = string | number;
type Pair = [string, number];
type Status = "active" | "inactive";
type UserOrAdmin = User | Admin;
```

| 能力 | `type` | `interface` |
| --- | --- | --- |
| 对象结构 | ✅ | ✅ |
| `extends` 继承 | ❌（用 `&` 交叉代替） | ✅ |
| 声明合并 | ❌ | ✅（同名 interface 自动合并） |
| 联合 / 交叉类型 | ✅ | ❌ |
| 元组 / 原始类型别名 | ✅ | ❌ |
| 映射类型 / 条件类型 | ✅ | ❌ |

::: tip 选择建议

- **组件 Props、API 响应结构**→ 用哪个都行，团队统一即可
- **联合类型、工具类型、复杂类型运算** → 只能用 `type`
- **需要声明合并**（扩展第三方库类型）→ 用 `interface`

:::

---

### 类型断言

告诉编译器"我确定这个值的类型"——绕过类型检查，责任转移给开发者：

```ts
// as 语法（推荐）
const input = document.getElementById("username") as HTMLInputElement;
input.value = "Alice";

// 非空断言 !（断言值不是 null / undefined）
const el = document.querySelector(".header")!;
el.textContent = "Hello";
```

::: danger 断言不是类型转换

断言只是告诉编译器"信我"，运行时不做任何转换。如果断言错了，运行时照样崩：

```ts
const data = fetchData() as User; // 如果返回的不是 User 结构，运行时出错
```

优先用类型收窄（`typeof`、`instanceof`、类型守卫）而非断言。只在 TS 的推导确实不够智能时才用断言

:::
