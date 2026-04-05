# ユーティリティ型

> Utility Types

TypeScript 組み込みの型変換――既存の型から新しい型を生成し、重複定義を避ける

## よく使うユーティリティ型

| ユーティリティ型 | 機能 | 等価な書き方 |
| --- | --- | --- |
| `Partial<T>` | すべてのプロパティを省略可能にする | `{ [K in keyof T]?: T[K] }` |
| `Required<T>` | すべてのプロパティを必須にする | `{ [K in keyof T]-?: T[K] }` |
| `Readonly<T>` | すべてのプロパティを読み取り専用にする | `{ readonly [K in keyof T]: T[K] }` |
| `Pick<T, K>` | T から K に対応するプロパティを選択 | `{ [P in K]: T[P] }` |
| `Omit<T, K>` | T から K に対応するプロパティを除外 | `Pick<T, Exclude<keyof T, K>>` |
| `Record<K, V>` | キーが K、値が V のオブジェクト | `{ [P in K]: V }` |
| `Extract<T, U>` | ユニオン型 T から U に代入可能なメンバーを抽出 | -- |
| `Exclude<T, U>` | ユニオン型 T から U に代入可能なメンバーを除外 | -- |
| `NonNullable<T>` | `null` と `undefined` を除外 | `Exclude<T, null \| undefined>` |
| `ReturnType<T>` | 関数の戻り値の型を抽出 | -- |
| `Parameters<T>` | 関数のパラメータの型を抽出（タプル） | -- |
| `Awaited<T>` | Promise 内部の型を抽出（再帰的にアンラップ） | -- |

---

## プロパティ修飾

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

::: warning 特徴: Readonly は浅い

```ts
type State = Readonly<{
  users: User[];
  settings: { theme: string };
}>;

const state: State = { users: [], settings: { theme: "dark" } };
// state.users = [];           // ❌ 顶层属性只读
state.settings.theme = "light"; // ✅ 嵌套对象的属性仍然可改！
```

深い読み取り専用が必要な場合は、再帰型またはサードパーティライブラリ（`ts-essentials` の `DeepReadonly` など）を使用する

:::

---

## プロパティ選択

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

## ユニオン型操作

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

## 関数型の抽出

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

::: tip ReturnType の実践的な価値

関数がサードパーティライブラリのものであったり構造が複雑な場合、`ReturnType` で直接抽出すれば、型を手動で同期管理する必要がない：

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

## マップ型と条件付き型

> カスタムユーティリティ型の基礎――これを理解してはじめて複雑な型定義が読める

### マップ型

`in` でキーのユニオン型を走査し、新しいオブジェクト型を生成する：

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

### 条件付き型

`T extends U ? X : Y`――型レベルの三項演算子：

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

### テンプレートリテラル型

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

::: warning 特徴: カスタムユーティリティ型が必要な場合

- 組み込みユーティリティ型で解決できる → そのまま使う。車輪の再発明はしない
- 複数箇所で同じ型変換を繰り返している → ユーティリティ型として抽出する
- サードパーティライブラリの `.d.ts` を読むとき → マップ型/条件付き型を理解していないと読めない
- 型のネストが 3 層を超える → `type` エイリアスで中間ステップに分割する。一行に書かない

:::
