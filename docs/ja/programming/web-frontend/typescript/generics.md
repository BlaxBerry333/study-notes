# ジェネリクス

> Generics

型のパラメータ化――ロジックを一度書くだけで、複数の型に対応しつつ型安全を保つ

## 基本構文

```ts
// 不用泛型：返回 any，丢失类型信息
function identity(value: any): any {
  return value;
}
const result = identity("hello"); // any 😢

// 用泛型：T 是类型参数，调用时自动推导
function identity<T>(value: T): T {
  return value;
}
const result = identity("hello"); // string ✅
const num = identity(42); // number ✅
```

---

### ジェネリクス関数

```ts
// 数组的第一个元素
function first<T>(arr: T[]): T | undefined {
  return arr[0];
}
first([1, 2, 3]); // number | undefined
first(["a", "b"]); // string | undefined

// 多个类型参数
function pair<A, B>(a: A, b: B): [A, B] {
  return [a, b];
}
pair("name", 42); // [string, number]

// 带默认类型参数
function createState<T = string>(initial: T) {
  let state = initial;
  return {
    get: () => state,
    set: (value: T) => {
      state = value;
    },
  };
}
```

---

### ジェネリクスインターフェースと型

```ts
// 泛型接口：API 响应的通用结构
interface ApiResponse<T> {
  data: T;
  status: number;
  message: string;
}

type UserResponse = ApiResponse<User>;
// { data: User; status: number; message: string }

type ListResponse<T> = ApiResponse<T[]>;
// { data: T[]; status: number; message: string }

// 实际使用
async function fetchUser(id: string): Promise<ApiResponse<User>> {
  const res = await fetch(`/api/users/${id}`);
  return res.json();
}
```

---

### ジェネリクスクラス

```ts
class Stack<T> {
  private items: T[] = [];

  push(item: T): void {
    this.items.push(item);
  }

  pop(): T | undefined {
    return this.items.pop();
  }

  peek(): T | undefined {
    return this.items[this.items.length - 1];
  }
}

const numStack = new Stack<number>();
numStack.push(1);
numStack.push(2);
numStack.pop(); // number | undefined
```

---

## ジェネリクス制約

> `extends` で型パラメータが満たすべき条件を制限する

### 基本制約

```ts
// T 必须有 length 属性
function logLength<T extends { length: number }>(value: T): void {
  console.log(value.length);
}
logLength("hello"); // ✅ string 有 length
logLength([1, 2, 3]); // ✅ 数组有 length
// logLength(123);    // ❌ number 没有 length
```

---

### keyof 制約

```ts
// K 必须是 T 的键
function getProperty<T, K extends keyof T>(obj: T, key: K): T[K] {
  return obj[key];
}

const user = { name: "Alice", age: 25 };
getProperty(user, "name"); // string
getProperty(user, "age"); // number
// getProperty(user, "email"); // ❌ "email" 不是 user 的键
```

::: tip keyof

`keyof T` はオブジェクト型のすべてのキーをユニオン型として抽出する：

```ts
type User = { name: string; age: number; email: string };
type UserKey = keyof User; // "name" | "age" | "email"
```

:::

---

### 条件付き制約

```ts
// 根据输入类型决定输出类型
type IsString<T> = T extends string ? true : false;

type A = IsString<"hello">; // true
type B = IsString<42>; // false

// 实用：提取 Promise 内的类型
type Unwrap<T> = T extends Promise<infer U> ? U : T;

type A = Unwrap<Promise<string>>; // string
type B = Unwrap<number>; // number（不是 Promise，原样返回）
```

---

## よく使うジェネリクスパターン

### ファクトリ関数

```ts
function createInstance<T>(ctor: new (...args: any[]) => T, ...args: any[]): T {
  return new ctor(...args);
}
```

---

### 型安全なイベントシステム

```ts
type EventMap = {
  login: { userId: string };
  logout: undefined;
  error: { code: number; message: string };
};

class EventBus<T extends Record<string, any>> {
  private handlers = new Map<keyof T, Set<Function>>();

  on<K extends keyof T>(event: K, handler: (payload: T[K]) => void): void {
    if (!this.handlers.has(event)) {
      this.handlers.set(event, new Set());
    }
    this.handlers.get(event)!.add(handler);
  }

  emit<K extends keyof T>(event: K, payload: T[K]): void {
    this.handlers.get(event)?.forEach((handler) => handler(payload));
  }
}

const bus = new EventBus<EventMap>();
bus.on("login", (payload) => {
  console.log(payload.userId); // ✅ 自动推导为 { userId: string }
});
// bus.emit("login", { code: 1 }); // ❌ 类型不匹配
```

---

### Builder パターン

```ts
class QueryBuilder<T extends Record<string, any>> {
  private filters: Partial<T> = {};
  private sortField?: keyof T;

  where<K extends keyof T>(field: K, value: T[K]): this {
    this.filters[field] = value;
    return this;
  }

  orderBy(field: keyof T): this {
    this.sortField = field;
    return this;
  }

  build() {
    return { filters: this.filters, sort: this.sortField };
  }
}

type User = { name: string; age: number; active: boolean };

new QueryBuilder<User>()
  .where("name", "Alice") // ✅ value 必须是 string
  .where("age", 25) // ✅ value 必须是 number
  // .where("age", "25")    // ❌ age 要 number 不是 string
  .orderBy("name")
  .build();
```

---

## ジェネリクスと React

### Props ジェネリクス

```tsx
// 通用列表组件
interface ListProps<T> {
  items: T[];
  renderItem: (item: T) => React.ReactNode;
  keyExtractor: (item: T) => string;
}

function List<T>({ items, renderItem, keyExtractor }: ListProps<T>) {
  return (
    <ul>
      {items.map((item) => (
        <li key={keyExtractor(item)}>{renderItem(item)}</li>
      ))}
    </ul>
  );
}

// 使用时 T 自动从 items 推导
<List
  items={users}
  renderItem={(user) => <span>{user.name}</span>} // user: User ✅
  keyExtractor={(user) => user.id}
/>;
```

---

### Hook ジェネリクス

```tsx
// 泛型 Hook：类型安全的 localStorage
function useLocalStorage<T>(key: string, defaultValue: T) {
  const [value, setValue] = useState<T>(() => {
    const stored = localStorage.getItem(key);
    return stored ? (JSON.parse(stored) as T) : defaultValue;
  });

  useEffect(() => {
    localStorage.setItem(key, JSON.stringify(value));
  }, [key, value]);

  return [value, setValue] as const;
}

// 使用
const [theme, setTheme] = useLocalStorage("theme", "dark");
// theme: string, setTheme: Dispatch<SetStateAction<string>>

const [user, setUser] = useLocalStorage<User | null>("user", null);
// user: User | null
```

::: warning 特徴: ジェネリクスの使用原則

- **推論できるなら明示しない**：`identity("hello")` であり `identity<string>("hello")` ではない
- **制約は厳しいほど良い**：`<T extends string>` は `<T>` より望ましい。TS がコンパイル時により多くのエラーを検出できる
- **ジェネリクスのためのジェネリクスにしない**：関数が一つの型しか扱わないなら、具体的な型を直接書く。ジェネリクスは不要
- **深いネストを避ける**：`A<B<C<D>>>` は読みにくい。`type` エイリアスで中間ステップに分割することを検討する

:::
