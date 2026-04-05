---
prev: false
next: false
---

# TypeScript

JavaScript のスーパーセット——JS に**静的型システム**を追加し、実行時ではなくコンパイル時にエラーを検出する

::: warning 特徴:

- コンパイル時の型チェックで `undefined is not a function` 系の実行時エラーを排除
- 完全な型推論により、大部分のケースで手動の型注釈が不要
- 段階的な導入が可能——`.js` ファイルを順次 `.ts` に移行でき、一括リライト不要
- 強力な IDE サポート（自動補完、リファクタリング、定義ジャンプ）
- コンパイル後は純粋な JavaScript になり、実行時オーバーヘッドゼロ

:::

## 基礎概念

| 概念 | 一言説明 | 詳細 |
| --- | --- | --- |
| 基本型 | `string`、`number`、`boolean`、`null`、`undefined`、`bigint`、`symbol` | — |
| 特殊型 | `any`（チェック無効化）、`unknown`（安全な any）、`never`（あり得ない値）、`void`（戻り値なし） | [詳細](#特殊型) |
| ユニオン型 | `A \| B`——値は A または B | [詳細](#ユニオン型と型の絞り込み) |
| インターセクション型 | `A & B`——A と B の両方を満たす | [詳細](#インターセクション型) |
| リテラル型 | `"success" \| "error"`（`string` ではなく） | [詳細](#リテラル型) |
| 型エイリアス | `type Point = { x: number; y: number }` | — |
| インターフェース | `interface Point { x: number; y: number }` | [詳細](#type-vs-interface) |
| ジェネリクス | 型のパラメータ化、一度のロジックで複数の型に対応 | [詳細](/ja/programming/web-frontend/typescript/generics) |
| ユーティリティ型 | 組み込みの型変換（`Partial`、`Pick`、`Omit` 等） | [詳細](/ja/programming/web-frontend/typescript/utility-types) |
| 型の絞り込み | 条件判断で TS が自動的に型範囲を狭める | [詳細](#ユニオン型と型の絞り込み) |
| 型アサーション | `value as Type`——コンパイラに「私の方が分かっている」と伝える | [詳細](#型アサーション) |
| 型ガード | カスタム関数で TS の型絞り込みを支援 | [詳細](#カスタム型ガード) |

## 基本的な使い方

### 変数と関数

```ts
// 変数：大部分のケースで TS が自動推論するため、手動注釈不要
const name = "Alice"; // "Alice"（リテラル型）と推論
let age = 25; // number と推論
const scores: number[] = [90, 85, 92]; // 配列

// 関数：引数は注釈必須、戻り値は通常自動推論
function greet(name: string, age?: number): string {
  return age ? `${name} (${age})` : name;
}

// アロー関数
const add = (a: number, b: number) => a + b;

// 関数オーバーロード
function parse(input: string): number;
function parse(input: number): string;
function parse(input: string | number): number | string {
  return typeof input === "string" ? Number(input) : String(input);
}
```

---

### オブジェクトと配列

```ts
// オブジェクト型
type User = {
  id: string;
  name: string;
  email?: string; // オプショナル
  readonly createdAt: Date; // 読み取り専用
};

// インデックスシグネチャ——キーが不定の場合
type Dictionary = {
  [key: string]: unknown;
};

// Record の方が簡潔
type StatusMap = Record<string, boolean>;

// タプル——固定長で各位置の型が異なる配列
type Coordinate = [number, number];
type Response = [data: User, error: null] | [data: null, error: Error];
```

---

### 特殊型

```ts
// any: 全ての型チェックを無効化（エスケープハッチ、使用を避ける）
let data: any = fetchSomething();
data.foo.bar; // エラーにならないが、実行時にクラッシュする可能性あり

// unknown: 安全な any——絞り込んでから使用する必要がある
let input: unknown = getInput();
// input.toString()  // ❌ コンパイルエラー
if (typeof input === "string") {
  input.toUpperCase(); // ✅ 絞り込み後は使用可能
}

// never: 値を持ちえない型
function throwError(msg: string): never {
  throw new Error(msg); // 関数は正常に戻らない
}

// void: 関数に戻り値がない
function logMessage(msg: string): void {
  console.log(msg);
}
```

::: warning any vs unknown

- `any`：**型チェックを無効化**——任意の型に代入可能で、任意のプロパティにアクセス可能。JS → TS の段階的移行時の過渡期に使用
- `unknown`：**安全モード**——型を判定してから使用する必要がある。外部データ（API レスポンス、ユーザー入力、JSON.parse）には `any` ではなく `unknown` を使うべき

```ts
function handleApiResponse(data: unknown) {
  // ❌ data.name  → コンパイルエラー
  if (isUser(data)) {
    data.name; // ✅ 絞り込み後に安全に使用
  }
}
```

:::

---

### ユニオン型と型の絞り込み

ユニオン型は「値が A または B」を表す。使用時は条件判断で具体的な型に**絞り込む**必要がある：

```ts
type Result = { status: "success"; data: User } | { status: "error"; message: string };

function handleResult(result: Result) {
  // 判別可能なユニオン：共有フィールド status で絞り込み
  if (result.status === "success") {
    console.log(result.data.name); // TS は success ブランチと認識
  } else {
    console.log(result.message); // TS は error ブランチと認識
  }
}
```

よく使う絞り込み手段：

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

// in 演算子
type Fish = { swim: () => void };
type Bird = { fly: () => void };

function move(animal: Fish | Bird) {
  if ("swim" in animal) {
    animal.swim();
  } else {
    animal.fly();
  }
}

// Truthy チェック（null / undefined を排除）
function greet(name?: string) {
  if (name) {
    // string（undefined を排除）
    console.log(name.toUpperCase());
  }
}
```

---

### カスタム型ガード

組み込みの絞り込みでは不十分な場合（オブジェクトの具体的な構造チェックなど）、`is` キーワードで型ガード関数を定義する：

```ts
type User = { type: "user"; name: string; email: string };
type Admin = { type: "admin"; name: string; permissions: string[] };
type Account = User | Admin;

// 戻り値の型 `account is Admin` は TS に「true を返したら引数は Admin」と伝える
function isAdmin(account: Account): account is Admin {
  return account.type === "admin";
}

function showDashboard(account: Account) {
  if (isAdmin(account)) {
    console.log(account.permissions); // ✅ TS は Admin と認識
  }
}

// 実用的なシーン：null / undefined のフィルタリング
function isNonNull<T>(value: T | null | undefined): value is T {
  return value != null;
}

const items = [1, null, 2, undefined, 3];
const valid = items.filter(isNonNull); // number[]
```

---

### インターセクション型

インターセクション型は複数の型を合成する——新しい型は全ての型のプロパティを持つ：

```ts
type HasId = { id: string };
type HasTimestamp = { createdAt: Date; updatedAt: Date };
type HasName = { name: string };

// 3 つの型を全て満たす
type Entity = HasId & HasTimestamp & HasName;

// 実用例：既存の型にフィールドを追加
type WithPagination<T> = T & {
  page: number;
  pageSize: number;
  total: number;
};

type UserListResponse = WithPagination<{ users: User[] }>;
```

---

### リテラル型

リテラル型は変数を特定の値のみに制限する：

```ts
// 文字列リテラル
type HttpMethod = "GET" | "POST" | "PUT" | "DELETE";
type Theme = "light" | "dark";

// 数値リテラル
type DiceRoll = 1 | 2 | 3 | 4 | 5 | 6;

// テンプレートリテラル型——文字列のパターンマッチング
type EventName = `on${string}`; // "onClick"、"onSubmit" など
type CssProperty = `${string}-${string}`; // "font-size"、"margin-top" など
type Locale = `${string}-${string}`; // "zh-CN"、"en-US" など
```

::: tip const アサーション

`as const` は TS に値を最も狭いリテラル型として推論させる：

```ts
// as const なし
const config = { endpoint: "/api", method: "GET" };
// 型：{ endpoint: string; method: string }

// as const あり
const config = { endpoint: "/api", method: "GET" } as const;
// 型：{ readonly endpoint: "/api"; readonly method: "GET" }

// よくある用途：関数引数でリテラル型を保持
const ROUTES = ["/home", "/about", "/contact"] as const;
type Route = (typeof ROUTES)[number]; // "/home" | "/about" | "/contact"
```

:::

---

### type vs interface

```ts
// interface：オブジェクト構造の記述、宣言マージと extends をサポート
interface User {
  id: string;
  name: string;
}
interface Admin extends User {
  permissions: string[];
}

// type：より汎用的、ユニオン・インターセクション・タプル・プリミティブ型を記述可能
type ID = string | number;
type Pair = [string, number];
type Status = "active" | "inactive";
type UserOrAdmin = User | Admin;
```

| 機能 | `type` | `interface` |
| --- | --- | --- |
| オブジェクト構造 | ✅ | ✅ |
| `extends` 継承 | ❌（`&` で代替） | ✅ |
| 宣言マージ | ❌ | ✅（同名 interface は自動マージ） |
| ユニオン / インターセクション型 | ✅ | ❌ |
| タプル / プリミティブ型エイリアス | ✅ | ❌ |
| マップ型 / 条件付き型 | ✅ | ❌ |

::: tip 選択の指針

- **コンポーネント Props、API レスポンス構造** → どちらでもよい、チームで統一
- **ユニオン型、ユーティリティ型、複雑な型演算** → `type` のみ可能
- **宣言マージが必要**（サードパーティライブラリの型拡張）→ `interface`

:::

---

### 型アサーション

コンパイラに「この値の型は確実にこれ」と伝える——型チェックをバイパスし、責任は開発者に移る：

```ts
// as 構文（推奨）
const input = document.getElementById("username") as HTMLInputElement;
input.value = "Alice";

// 非 null アサーション !（値が null / undefined でないことを断言）
const el = document.querySelector(".header")!;
el.textContent = "Hello";
```

::: danger アサーションは型変換ではない

アサーションはコンパイラに「信じて」と伝えるだけで、実行時には何も変換しない。間違ったアサーションは実行時にクラッシュする：

```ts
const data = fetchData() as User; // 返却値が User 構造でなければ実行時エラー
```

アサーションより型絞り込み（`typeof`、`instanceof`、型ガード）を優先する。TS の推論が本当に不十分な場合のみアサーションを使う

:::
