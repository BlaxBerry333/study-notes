# レンダリング最適化

> Render Optimization -- re-render の範囲と頻度を制御する

## React.memo と参照安定性

> memo は浅い比較で re-render をブロックし、useMemo/useCallback が参照を安定させて memo を機能させる -- これらは一つの体系である

---

### memo の原理

`React.memo` でコンポーネントをラップすると、親コンポーネントの re-render 時に props を**浅い比較**する。プリミティブ型は値を、参照型は参照アドレスを比較する。props が変わった場合のみ re-render される

```tsx
const UserBadge = React.memo(function UserBadge({
  name,
  level,
}: {
  name: string;
  level: number;
}) {
  return (
    <span>
      {name} (Lv.{level})
    </span>
  );
});

function Dashboard() {
  const [notifications, setNotifications] = useState(0);

  return (
    <div>
      <span>通知: {notifications}</span>
      {/* notifications が変わっても Dashboard は re-render するが、UserBadge の props は変わらないのでスキップ */}
      <UserBadge name="Alice" level={5} />
    </div>
  );
}
```

---

### memo の無効化トラップ

親コンポーネントの re-render のたびに、インラインで生成されたオブジェクトや関数は**新しい参照**になり、memo の浅い比較は必ず失敗する：

```tsx
function Parent() {
  const [count, setCount] = useState(0);

  return (
    <FilteredList
      // ❌ {} !== {} → memo が無効化
      filters={{ status: "active", keyword: "" }}
      // ❌ 新しい関数参照 → memo が無効化
      onSelect={(id) => console.log(id)}
    />
  );
}
```

修正方法 -- `useMemo` / `useCallback` で参照を安定させる：

```tsx
function Parent() {
  const [count, setCount] = useState(0);

  const filters = useMemo(() => ({ status: "active", keyword: "" }), []);
  const onSelect = useCallback((id: string) => console.log(id), []);

  return <FilteredList filters={filters} onSelect={onSelect} />;
}
```

---

### 使用場面

::: code-group

```tsx [React.memo との併用]
// 子コンポーネントが memo を使っている場合、親コンポーネントは props の参照を安定させる必要がある
const Chart = React.memo(function Chart({
  data,
  onHover,
}: {
  data: ProcessedData[];
  onHover: (point: DataPoint) => void;
}) {
  return <canvas />;
});

function Dashboard() {
  const [rawData, setRawData] = useState<RawData[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const processedData = useMemo(
    () => rawData.map(transformExpensiveData),
    [rawData],
  );

  const handleHover = useCallback((point: DataPoint) => {
    setSelectedId(point.id);
  }, []);

  return <Chart data={processedData} onHover={handleHover} />;
}
```

```tsx [高コストな計算]
function SearchResults({ items, query }: { items: Item[]; query: string }) {
  // 10000 件のデータに対するファジー検索 + ソート
  const filtered = useMemo(() => {
    return items
      .filter((item) => fuzzyMatch(item.name, query))
      .sort((a, b) => relevanceScore(b, query) - relevanceScore(a, query));
  }, [items, query]);

  return (
    <ul>
      {filtered.map((item) => (
        <li key={item.id}>{item.name}</li>
      ))}
    </ul>
  );
}
```

```tsx [Hook の依存として]
function useDataFetcher(config: FetchConfig) {
  // 参照を安定させ、useEffect の無限ループを防ぐ
  const stableConfig = useMemo(() => config, [config.url, config.method]);

  useEffect(() => {
    fetchData(stableConfig);
  }, [stableConfig]);
}
```

:::

### 過剰使用

```tsx
function UserCard({ user }: { user: User }) {
  // ❌ 文字列結合に useMemo は不要
  const fullName = useMemo(
    () => `${user.firstName} ${user.lastName}`,
    [user.firstName, user.lastName],
  );

  // ❌ UserCard 自体が memo でラップされていないため、親の re-render 時に必ず re-render する
  // handleClick をキャッシュしても無意味
  const handleClick = useCallback(() => {
    console.log(user.id);
  }, [user.id]);

  return <div onClick={handleClick}>{fullName}</div>;
}
```

::: warning useMemo / useCallback のコスト

毎回 Hook ロジックの実行、依存配列の浅い比較、メモリへのキャッシュが行われる。計算自体が軽い場合（文字列結合、単純な条件判定）、キャッシュのオーバーヘッドが再計算より大きくなる可能性がある
:::

---

### React Compiler

React 19 で導入された React Compiler（旧 React Forget）はコンパイル時に memoization を**自動挿入**する。これにより：

- 将来は re-render 最適化のために手動で `useMemo` / `useCallback` を書く必要がなくなる
- Compiler はより正確な依存関係を分析でき、手動より信頼性が高い
- ただし Compiler はアーキテクチャレベルの最適化（状態の局所化、Context の分割など）は**行わない**

::: tip useMemo / useCallback が必要かの判断

1. `React.memo` コンポーネントに渡している？ → 必要
2. 他の Hook の依存（`useEffect`、`useMemo`）になっている？ → 必要
3. 計算が本当に高コスト（大きな配列の走査、複雑な変換）？ → 必要
4. 上記のいずれでもない？ → **不要**
:::

---

## key の正しい使い方

> key は warning を消すだけのものではない -- 誤った key は状態の混乱とパフォーマンス問題を引き起こす

---

### index を key にした場合の問題

リスト項目に**内部状態**（input の値、checkbox の選択、展開/折りたたみ）がある場合、index を key にすると状態のずれが発生する：

```tsx
// ❌ 最初の項目を削除すると、2 番目の項目が 1 番目の input 状態を「引き継ぐ」
function TodoList({
  todos,
  onRemove,
}: {
  todos: Todo[];
  onRemove: (id: string) => void;
}) {
  return (
    <ul>
      {todos.map((todo, index) => (
        // index=0 を削除すると、元の index=1 が index=0 になる
        // React は key=0 のコンポーネントがまだ存在すると判断し、古い DOM と状態を再利用する
        <li key={index}>
          <input defaultValue={todo.text} />
          <button onClick={() => onRemove(todo.id)}>削除</button>
        </li>
      ))}
    </ul>
  );
}

// ✅ 安定した一意の識別子を key にする
{
  todos.map((todo) => (
    <li key={todo.id}>
      <input defaultValue={todo.text} />
      <button onClick={() => onRemove(todo.id)}>削除</button>
    </li>
  ));
}
```

::: tip index を key にして安全な唯一の場面

リストが**静的**（追加・削除・並べ替えがない）かつリスト項目に**内部状態がない**場合。典型例：ナビゲーションメニュー、静的なタグリスト
:::

---

### key による強制 remount

key を変更すると React は古いコンポーネントインスタンスを破棄し、新しいインスタンスを作成する。**全ての内部状態がリセットされる**。これは有用なテクニックである：

```tsx
// ユーザー切り替え時に Profile の全内部状態（フォーム値、スクロール位置など）をリセット
function App() {
  const [userId, setUserId] = useState("alice");

  // userId が変わる → key が変わる → Profile がまるごと unmount + remount
  return <Profile key={userId} userId={userId} />;
}
```

::: warning

remount のコストは re-render よりはるかに高い（完全なマウントライフサイクルを経て、useEffect を再トリガーする）。本当に**全状態のリセット**が必要な場合にのみ使い、「コンポーネントのリフレッシュ」の近道として乱用しない
:::

---

### key と diff パフォーマンス

React の diff アルゴリズムは key を使って新旧リスト項目を対応付ける。安定した key がないと、React は順番に逐一比較するしかなく、大量の不要な DOM 操作が発生する：

```tsx
// リストの先頭に 1 項目を挿入した場合
// 安定した key なし：React は全項目が変わったと判断し、N 個の DOM ノードを更新
// 安定した key あり：React は挿入が 1 件だけだと識別し、1 個の DOM ノードだけ操作
```

---

## 状態の局所化

> State Colocation -- 状態を本当に必要な場所に置き、ゼロコストで re-render 範囲を縮小する

---

### 状態を高い位置に置きすぎる

```tsx
// ❌ searchQuery を App レベルに置くと、入力のたびに Sidebar、Footer が re-render される
function App() {
  const [searchQuery, setSearchQuery] = useState("");
  const [user, setUser] = useState<User | null>(null);

  return (
    <div>
      <Header user={user} />
      <SearchBar query={searchQuery} onChange={setSearchQuery} />
      <ProductList query={searchQuery} />
      <Sidebar />
      <Footer />
    </div>
  );
}
```

---

### 状態の局所化

```tsx
function App() {
  const [user, setUser] = useState<User | null>(null);

  return (
    <div>
      <Header user={user} />
      <SearchSection />
      <Sidebar />
      <Footer />
    </div>
  );
}

function SearchSection() {
  const [searchQuery, setSearchQuery] = useState("");

  return (
    <>
      <SearchBar query={searchQuery} onChange={setSearchQuery} />
      <ProductList query={searchQuery} />
    </>
  );
}
```

---

### children パターン

コンポーネントが状態を管理しているが子コンポーネントがその状態に依存しない場合、`children` で無関係な部分を「外に出す」：

```tsx
// ❌ theme の状態変更 → ExpensiveContent も re-render
function AnimatedBackground() {
  const [theme, setTheme] = useState("light");

  return (
    <div className={`bg-${theme}`}>
      <button
        onClick={() => setTheme((t) => (t === "light" ? "dark" : "light"))}
      >
        テーマ切替
      </button>
      <ExpensiveContent />
    </div>
  );
}

// ✅ children は親コンポーネントで生成されるため、ThemeWrapper の re-render は children に影響しない
function App() {
  return (
    <ThemeWrapper>
      <ExpensiveContent />
    </ThemeWrapper>
  );
}

function ThemeWrapper({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState("light");

  return (
    <div className={`bg-${theme}`}>
      <button
        onClick={() => setTheme((t) => (t === "light" ? "dark" : "light"))}
      >
        テーマ切替
      </button>
      {children}
    </div>
  );
}
```

::: tip

- 状態の局所化はゼロコストの最適化 -- 追加の API を導入せず、コード構造を調整するだけ
- `children` パターンの原理：JSX 要素は `React.createElement()` の戻り値（オブジェクト）であり、親コンポーネントで生成された後は参照が固定されるため、子コンポーネントの re-render で再生成されない
:::

---

## Context のパフォーマンストラップ

> Context の value が変わる = 全ての消費者が re-render。value のどの部分を使っているかに関係なく、React.memo でもブロックできない

---

### Provider の新オブジェクトトラップ

```tsx
// ❌ App が re-render するたびに新しい value オブジェクトが生成される → 全消費者が re-render
function App() {
  const [theme, setTheme] = useState("dark");
  const [locale, setLocale] = useState("zh-CN");

  return (
    <ThemeContext.Provider value={{ theme, setTheme, locale, setLocale }}>
      <Page />
    </ThemeContext.Provider>
  );
}

// theme しか使っていないのに、locale が変わっても re-render される
function ThemedButton() {
  const { theme } = useContext(ThemeContext);
  return <button className={theme}>Click</button>;
}
```

---

### useMemo で value を安定させる

```tsx
function App() {
  const [theme, setTheme] = useState("dark");
  const [locale, setLocale] = useState("zh-CN");

  const value = useMemo(
    () => ({ theme, setTheme, locale, setLocale }),
    [theme, locale],
  );

  return (
    <ThemeContext.Provider value={value}>
      <Page />
    </ThemeContext.Provider>
  );
}
```

---

### Context の分割

変化頻度の異なるデータを別の Context に分割する：

```tsx
const ThemeContext = createContext<{
  theme: string;
  setTheme: (t: string) => void;
}>();
const LocaleContext = createContext<{
  locale: string;
  setLocale: (l: string) => void;
}>();

function AppProviders({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState("dark");
  const [locale, setLocale] = useState("zh-CN");

  const themeValue = useMemo(() => ({ theme, setTheme }), [theme]);
  const localeValue = useMemo(() => ({ locale, setLocale }), [locale]);

  return (
    <ThemeContext.Provider value={themeValue}>
      <LocaleContext.Provider value={localeValue}>
        {children}
      </LocaleContext.Provider>
    </ThemeContext.Provider>
  );
}

// ✅ locale が変わっても ThemedButton は re-render されない
function ThemedButton() {
  const { theme } = useContext(ThemeContext);
  return <button className={theme}>Click</button>;
}
```

---

### データと操作の分割

ほぼ変わらない dispatch/setter と頻繁に変わる state を分離する：

```tsx
const StateContext = createContext<AppState>();
const DispatchContext = createContext<React.Dispatch<Action>>();

function AppProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState);

  return (
    <DispatchContext.Provider value={dispatch}>
      <StateContext.Provider value={state}>{children}</StateContext.Provider>
    </DispatchContext.Provider>
  );
}

// ✅ 操作のトリガーだけが必要なコンポーネントは state の変化で re-render されない
function AddButton() {
  const dispatch = useContext(DispatchContext);
  return <button onClick={() => dispatch({ type: "ADD" })}>追加</button>;
}
```

::: warning

Context は状態管理ライブラリの代替ではない。頻繁に更新されるグローバル状態（フォーム、リアルタイムデータ）を Context で管理すると大量の不要な re-render が発生する。このような場面では Zustand、Jotai などを検討すべきである -- これらは selector レベルの精密なサブスクリプションをサポートする
:::
