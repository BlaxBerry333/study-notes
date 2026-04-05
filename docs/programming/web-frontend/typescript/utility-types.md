# 工具类型

> Utility Types

TypeScript 内置的类型变换——基于已有类型生成新类型，避免重复定义

## 常用工具类型

| 工具类型 | 作用 | 等价写法 |
| --- | --- | --- |
| `Partial<T>` | 所有属性变为可选 | `{ [K in keyof T]?: T[K] }` |
| `Required<T>` | 所有属性变为必填 | `{ [K in keyof T]-?: T[K] }` |
| `Readonly<T>` | 所有属性变为只读 | `{ readonly [K in keyof T]: T[K] }` |
| `Pick<T, K>` | 从 T 中选取 K 对应的属性 | `{ [P in K]: T[P] }` |
| `Omit<T, K>` | 从 T 中排除 K 对应的属性 | `Pick<T, Exclude<keyof T, K>>` |
| `Record<K, V>` | 键为 K、值为 V 的对象 | `{ [P in K]: V }` |
| `Extract<T, U>` | 从联合类型 T 中提取可赋值给 U 的成员 | — |
| `Exclude<T, U>` | 从联合类型 T 中排除可赋值给 U 的成员 | — |
| `NonNullable<T>` | 排除 `null` 和 `undefined` | `Exclude<T, null \| undefined>` |
| `ReturnType<T>` | 提取函数的返回类型 | — |
| `Parameters<T>` | 提取函数的参数类型（元组） | — |
| `Awaited<T>` | 提取 Promise 内部的类型（递归解包） | — |

---

## 属性修饰类

### Partial / Required / Readonly

```ts
type User = {
  id: string;
  name: string;
  email: string;
};

// Partial: 更新时只传需要改的字段
function updateUser(id: string, updates: Partial<User>) {
  // updates: { id?: string; name?: string; email?: string }
}
updateUser("1", { name: "Bob" }); // ✅ 只改 name

// Required: 确保配置项全部填写
type Config = {
  host?: string;
  port?: number;
  ssl?: boolean;
};
function createServer(config: Required<Config>) {
  // 所有字段都是必填
}

// Readonly: 防止意外修改
function processUser(user: Readonly<User>) {
  // user.name = "Bob"; // ❌ 编译错误
}
```

::: warning Readonly 是浅层的

```ts
type State = Readonly<{
  users: User[];
  settings: { theme: string };
}>;

const state: State = { users: [], settings: { theme: "dark" } };
// state.users = [];           // ❌ 顶层属性只读
state.settings.theme = "light"; // ✅ 嵌套对象的属性仍然可改！
```

需要深层只读时，用递归类型或第三方库（如 `ts-essentials` 的 `DeepReadonly`）

:::

---

## 属性选取类

### Pick / Omit

```ts
type User = {
  id: string;
  name: string;
  email: string;
  password: string;
  createdAt: Date;
};

// Pick: 只要其中几个属性
type UserProfile = Pick<User, "id" | "name" | "email">;
// { id: string; name: string; email: string }

// Omit: 排除敏感字段
type PublicUser = Omit<User, "password">;
// { id: string; name: string; email: string; createdAt: Date }

// 组合使用：API 创建时不需要 id 和 createdAt
type CreateUserInput = Omit<User, "id" | "createdAt" | "password">;
// { name: string; email: string }
```

---

### Record

```ts
// 键为固定联合类型
type Status = "pending" | "active" | "disabled";
type StatusConfig = Record<Status, { label: string; color: string }>;

const statusConfig: StatusConfig = {
  pending: { label: "待审核", color: "yellow" },
  active: { label: "已激活", color: "green" },
  disabled: { label: "已禁用", color: "gray" },
  // 少写一个会报错 ✅
};

// 动态键
type UserMap = Record<string, User>;
```

---

## 联合类型操作

### Extract / Exclude

```ts
type Event =
  | { type: "click"; x: number; y: number }
  | { type: "keypress"; key: string }
  | { type: "scroll"; offset: number };

// Extract: 提取 type 为 "click" 的成员
type ClickEvent = Extract<Event, { type: "click" }>;
// { type: "click"; x: number; y: number }

// Exclude: 排除 type 为 "scroll" 的成员
type InteractiveEvent = Exclude<Event, { type: "scroll" }>;
// { type: "click"; ... } | { type: "keypress"; ... }

// 简单联合类型
type AllStatus = "active" | "inactive" | "pending" | "deleted";
type ActiveStatus = Extract<AllStatus, "active" | "pending">;
// "active" | "pending"
type VisibleStatus = Exclude<AllStatus, "deleted">;
// "active" | "inactive" | "pending"
```

---

### NonNullable

```ts
type MaybeUser = User | null | undefined;
type DefiniteUser = NonNullable<MaybeUser>; // User

// 实际场景：数组 filter 后的类型
const results: (string | null)[] = ["a", null, "b", null, "c"];
const valid: string[] = results.filter((x): x is string => x !== null);
```

---

## 函数类型提取

### ReturnType / Parameters / Awaited

```ts
function createUser(name: string, age: number) {
  return { id: crypto.randomUUID(), name, age, createdAt: new Date() };
}

// ReturnType: 提取返回类型（不用手动定义）
type User = ReturnType<typeof createUser>;
// { id: string; name: string; age: number; createdAt: Date }

// Parameters: 提取参数类型（元组）
type CreateUserParams = Parameters<typeof createUser>;
// [name: string, age: number]

// Awaited: 解包 Promise
type UserResponse = Awaited<ReturnType<typeof fetchUser>>;
// 如果 fetchUser 返回 Promise<ApiResponse<User>>，结果是 ApiResponse<User>
```

::: tip ReturnType 的实战价值

当函数是第三方库的或者结构复杂时，用 `ReturnType` 直接提取，不用手动同步维护类型：

```ts
// 第三方库返回的复杂类型
import { useForm } from "react-hook-form";
type FormReturn = ReturnType<typeof useForm<UserFormData>>;

// 自己的工具函数
const buildQuery = (params: SearchParams) => ({ ... });
type Query = ReturnType<typeof buildQuery>;
```

:::

---

## 映射类型与条件类型

> 自定义工具类型的基础——理解后才能读懂复杂的类型定义

### 映射类型

用 `in` 遍历键的联合类型，生成新的对象类型：

```ts
// Partial 的实现
type MyPartial<T> = {
  [K in keyof T]?: T[K];
};

// 所有属性变为 getter
type Getters<T> = {
  [K in keyof T as `get${Capitalize<string & K>}`]: () => T[K];
};

type User = { name: string; age: number };
type UserGetters = Getters<User>;
// { getName: () => string; getAge: () => number }
```

---

### 条件类型

`T extends U ? X : Y`——类型层面的三元表达式：

```ts
// 基础
type IsArray<T> = T extends any[] ? true : false;
type A = IsArray<string[]>; // true
type B = IsArray<number>; // false

// infer: 在条件类型中提取内部类型
type ElementType<T> = T extends (infer E)[] ? E : never;
type A = ElementType<string[]>; // string
type B = ElementType<number>; // never

// 提取函数返回类型（ReturnType 的实现）
type MyReturnType<T> = T extends (...args: any[]) => infer R ? R : never;

// 提取 Promise 内部类型（递归）
type DeepAwaited<T> = T extends Promise<infer U> ? DeepAwaited<U> : T;
type A = DeepAwaited<Promise<Promise<string>>>; // string
```

---

### 模板字面量类型

```ts
// 基础
type EventName = `${"click" | "focus" | "blur"}Handler`;
// "clickHandler" | "focusHandler" | "blurHandler"

// 内置字符串操作类型
type Upper = Uppercase<"hello">; // "HELLO"
type Lower = Lowercase<"HELLO">; // "hello"
type Cap = Capitalize<"hello">; // "Hello"
type Uncap = Uncapitalize<"Hello">; // "hello"

// 组合：自动生成事件处理器类型
type DOMEvents = "click" | "scroll" | "keydown";
type EventHandlers = {
  [E in DOMEvents as `on${Capitalize<E>}`]: (event: Event) => void;
};
// { onClick: ...; onScroll: ...; onKeydown: ... }
```

::: warning 何时需要自定义工具类型

- 内置工具类型能解决 → 直接用，不造轮子
- 多处重复相同的类型变换 → 抽成工具类型
- 读三方库的 `.d.ts` 时 → 需要理解映射/条件类型才能看懂
- 类型嵌套超过 3 层 → 用 `type` 别名拆分中间步骤，不要写成一行

:::
