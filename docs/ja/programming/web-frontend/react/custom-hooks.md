# 実用カスタム Hooks

> Custom Hooks

## useMediaQuery

> レスポンシブブレークポイント検出 -- CSS media query の JS ロジック分岐における代替手段

CSS media query はスタイルしか制御できないが、条件付きレンダリング、ブレークポイントごとのデータ取得、モバイルとデスクトップで異なるインタラクション -- これらは JS でブレークポイントを判定する必要がある。`matchMedia` API を使い `window.innerWidth` のポーリングではなく、パフォーマンスが良くシステムレベルの変更（ダークモードなど）にも対応できる

::: code-group

```tsx [使用例]
function ProductList() {
  const isMobile = useMediaQuery("(max-width: 768px)");
  const prefersDark = useMediaQuery("(prefers-color-scheme: dark)");

  // モバイルではサムネイルのみ、デスクトップではフルカードを読み込む
  if (isMobile) {
    return <CompactList />;
  }

  return <FullCardGrid theme={prefersDark ? "dark" : "light"} />;
}

function Dashboard() {
  const isWide = useMediaQuery("(min-width: 1200px)");

  return (
    <div>
      {/* ワイド画面ではサイドバー、狭い画面ではボトムナビ */}
      {isWide ? <Sidebar /> : <BottomNav />}
      <MainContent />
    </div>
  );
}
```

```ts [実装コード]
import { useState, useEffect, useCallback } from "react";

function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() => {
    // SSR 環境では window がないため、デフォルトで false を返す
    if (typeof window === "undefined") return false;
    return window.matchMedia(query).matches;
  });

  const handleChange = useCallback(
    (e: MediaQueryListEvent) => setMatches(e.matches),
    [],
  );

  useEffect(() => {
    const mql = window.matchMedia(query);
    setMatches(mql.matches); // query 変更時に現在の状態を同期
    mql.addEventListener("change", handleChange);
    return () => mql.removeEventListener("change", handleChange);
  }, [query, handleChange]);

  return matches;
}
```

:::

::: tip

- **使うべき場面**：JS でビューポート/システム設定に基づいて条件分岐する場合（異なるコンポーネントのレンダリング、異なるデータの取得、インタラクションモードの切り替え）
- **使うべきでない場面**：純粋なスタイルのレスポンシブ対応は CSS media query を使う。要素を非表示にするだけなら JS 判定を持ち込む必要はない
- **なぜ `matchMedia` であり `resize` リスナーではないか**：`matchMedia` はブラウザネイティブのブレークポイントマッチング機構で、ブレークポイントをまたぐときだけコールバックが発火する。`resize` は 1 ピクセルごとに発火し、自前でデバウンスを追加しても精度が落ちる
- SSR 互換：サーバーサイドでは初期値 `false` を返し、クライアントの hydrate 後に即座に修正される -- SEO 上重要なコンテンツには CSS 方式を推奨
:::

---

## useIntersectionObserver

> 要素の可視性検出 -- 無限スクロール、インプレッション計測、遅延読み込みのモダンな手法

`scroll` イベント + `getBoundingClientRect` はメインスレッドで実行され、リストが長くなるとカクつく。`IntersectionObserver` はブラウザレベルの非同期検出だが、ネイティブ API は observer の生成と破棄を手動管理する必要がある。Hook として封装すれば宣言的になる

::: code-group

```tsx [使用例]
// 無限スクロール：底部到達で追加読み込み
function InfiniteList() {
  const [items, setItems] = useState<Item[]>([]);
  const sentinelRef = useRef<HTMLDivElement>(null);

  const entry = useIntersectionObserver(sentinelRef, {
    rootMargin: "200px", // 200px 手前でトリガーし、ユーザーに読み込みを感じさせない
  });

  useEffect(() => {
    if (entry?.isIntersecting) {
      loadMoreItems().then((newItems) =>
        setItems((prev) => [...prev, ...newItems]),
      );
    }
  }, [entry?.isIntersecting]);

  return (
    <div>
      {items.map((item) => (
        <Card key={item.id} item={item} />
      ))}
      <div ref={sentinelRef} /> {/* 番兵要素 */}
    </div>
  );
}

// インプレッション計測：要素がビューポートに入ったら送信
function TrackableSection({
  id,
  children,
}: {
  id: string;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const entry = useIntersectionObserver(ref, { threshold: 0.5 });
  const reported = useRef(false);

  useEffect(() => {
    if (entry?.isIntersecting && !reported.current) {
      reported.current = true;
      analytics.track("section_viewed", { id });
    }
  }, [entry?.isIntersecting, id]);

  return <div ref={ref}>{children}</div>;
}
```

```ts [実装コード]
import { useState, useEffect, type RefObject } from "react";

interface UseIntersectionOptions {
  threshold?: number | number[];
  rootMargin?: string;
  root?: Element | null;
}

function useIntersectionObserver(
  ref: RefObject<Element | null>,
  options: UseIntersectionOptions = {},
): IntersectionObserverEntry | null {
  const [entry, setEntry] = useState<IntersectionObserverEntry | null>(null);

  const { threshold = 0, rootMargin = "0px", root = null } = options;

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([observedEntry]) => setEntry(observedEntry),
      { threshold, rootMargin, root },
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [ref, threshold, rootMargin, root]);

  return entry;
}
```

:::

::: tip

- **使うべき場面**：無限スクロール、インプレッション計測、画像/コンポーネントの遅延読み込み、スクロールアニメーション
- **使うべきでない場面**：ページのスクロール量を知りたいだけ（`scroll` イベントを使う）、ピクセル精度の位置が必要（`getBoundingClientRect` を使う）
- **`rootMargin` が重要**：正の値にすると事前にトリガーできる（プリロード）。負の値にすると遅延トリガーになる（要素がビューポートに一定距離入ってから可視と判定）
- **`threshold`**：`0` は 1 ピクセルでも見えたらトリガー、`0.5` は 50% 可視でトリガー、`1` は完全に可視 -- 業務要件に応じて選択する
:::

---

## useAbortController

> リクエストキャンセル管理 -- コンポーネントのライフサイクルに自動追従する AbortSignal

コンポーネントのアンマウント時に進行中の fetch をキャンセルするのは基本的な衛生管理であり、ページの高速切り替え時に古いリクエストをキャンセルして競合状態を防ぐのも同様である。`AbortController` の手動管理は煩雑で（生成、signal の受け渡し、AbortError の catch、クリーンアップ）、この Hook はライフサイクルを自動管理する signal の提供に専念する

::: code-group

```tsx [使用例]
function UserProfile({ userId }: { userId: string }) {
  const [user, setUser] = useState<User | null>(null);
  const getSignal = useAbortController();

  useEffect(() => {
    // getSignal() を呼ぶたびに前の controller を abort する
    // userId を高速に切り替えると、古いリクエストは自動的にキャンセルされる
    const signal = getSignal();

    fetch(`/api/users/${userId}`, { signal })
      .then((res) => res.json())
      .then(setUser)
      .catch((err) => {
        if (!signal.aborted) console.error(err); // キャンセル以外のエラーのみ処理
      });
  }, [userId, getSignal]);

  return user ? <div>{user.name}</div> : <div>読み込み中...</div>;
}

// 手動トリガーのリクエストと組み合わせる
function SearchPanel() {
  const [results, setResults] = useState<Result[]>([]);
  const getSignal = useAbortController();

  const handleSearch = async (query: string) => {
    const signal = getSignal(); // 前回の検索を自動キャンセル

    const res = await fetch(`/api/search?q=${query}`, { signal });
    if (!signal.aborted) {
      setResults(await res.json());
    }
  };

  return (
    <div>
      <input onChange={(e) => handleSearch(e.target.value)} />
      {results.map((r) => (
        <div key={r.id}>{r.title}</div>
      ))}
    </div>
  );
}
```

```ts [実装コード]
import { useRef, useCallback, useEffect } from "react";

function useAbortController(): () => AbortSignal {
  const controllerRef = useRef<AbortController | null>(null);

  // コンポーネントのアンマウント時に abort
  useEffect(() => {
    return () => controllerRef.current?.abort();
  }, []);

  const getSignal = useCallback((): AbortSignal => {
    // 呼び出しのたびに前の controller を abort（競合状態の処理）
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;
    return controller.signal;
  }, []);

  return getSignal;
}
```

:::

::: tip

- **使うべき場面**：コンポーネント内の fetch リクエスト、高速切り替えによる競合状態（検索入力、タブ切り替え、ルーティング遷移）
- **使うべきでない場面**：TanStack Query / SWR / useRequest などのリクエストライブラリを既に使っている場合、それらは内部でキャンセルと競合処理を行っている
- **なぜ signal ではなく関数を返すのか**：新しいリクエストのたびに新しい controller を作成し古いものを abort する必要があるため。signal を直接返すと「新しいリクエストが古いリクエストを自動キャンセルする」競合制御が実現できない
- **AbortError の処理**：`fetch` が abort されると `AbortError` で reject される。`signal.aborted` でキャンセルかどうかを判定し、キャンセルをエラーとして処理しないようにする
:::

---

## useOptimisticUpdate

> 楽観的更新 -- 先に UI を変更してからリクエストを送り、失敗時にロールバックする

いいね、お気に入り、todo のチェックなどの操作は、サーバーの応答を待ってから UI を更新すると明らかな遅延が生じる。楽観的更新は期待される結果で先に画面を更新し、リクエスト成功後にサーバーデータで上書きし、失敗時は操作前の状態にロールバックする。React 19 には組み込みの `useOptimistic` があるが、React 18 プロジェクトでは自前で実装する必要があり、原理を理解することはこのパターンを習得する上で重要である

::: code-group

```tsx [使用例]
function LikeButton({
  postId,
  initialCount,
  initialLiked,
}: {
  postId: string;
  initialCount: number;
  initialLiked: boolean;
}) {
  const [likeState, updateOptimistic, { rollback, confirm }] =
    useOptimisticUpdate({
      count: initialCount,
      liked: initialLiked,
    });

  const handleToggleLike = async () => {
    const nextLiked = !likeState.liked;
    const nextCount = likeState.count + (nextLiked ? 1 : -1);

    // 即座に UI を更新（初回呼び出し時にスナップショットを保存）
    updateOptimistic({ liked: nextLiked, count: nextCount });

    try {
      // リクエストを送信し、サーバーの返却値で上書き（スナップショットは上書きしない）
      const serverState = await toggleLike(postId);
      updateOptimistic(serverState); // 実データで修正
      confirm(); // 今回の楽観的更新の完了をマーク
    } catch {
      rollback(); // 失敗時はスナップショットにロールバック
    }
  };

  return (
    <button onClick={handleToggleLike}>
      {likeState.liked ? "❤️" : "🤍"} {likeState.count}
    </button>
  );
}

function TodoItem({ todo }: { todo: Todo }) {
  const [state, updateOptimistic, { rollback, confirm }] =
    useOptimisticUpdate(todo);

  const handleToggle = async () => {
    updateOptimistic({ ...state, completed: !state.completed });

    try {
      await updateTodo(todo.id, { completed: !todo.completed });
      confirm();
    } catch {
      rollback();
    }
  };

  return (
    <li style={{ opacity: state.completed ? 0.5 : 1 }}>
      <input
        type="checkbox"
        checked={state.completed}
        onChange={handleToggle}
      />
      {state.text}
    </li>
  );
}
```

```ts [実装コード]
import { useState, useRef, useCallback } from "react";

function useOptimisticUpdate<T>(initialState: T) {
  const [state, setState] = useState(initialState);
  const snapshotRef = useRef(initialState);
  const isPendingRef = useRef(false);

  const updateOptimistic = useCallback((next: T) => {
    setState((prev) => {
      if (!isPendingRef.current) {
        // 初回の楽観的更新時のみスナップショットを保存し、連続呼び出しでは上書きしない
        snapshotRef.current = prev;
        isPendingRef.current = true;
      }
      return next;
    });
  }, []);

  const rollback = useCallback(() => {
    isPendingRef.current = false;
    setState(snapshotRef.current);
  }, []);

  const confirm = useCallback(() => {
    isPendingRef.current = false;
  }, []);

  return [state, updateOptimistic, { rollback, confirm }] as const;
}
```

:::

::: tip

- **使うべき場面**：操作後に即座にフィードバックが必要な場面 -- いいね、お気に入り、ドラッグ並べ替え、todo チェック、クイック編集
- **使うべきでない場面**：操作失敗のコストが高い場合（決済、復元不可能なデータの削除） -- これらはサーバー確認後に UI を更新すべきである
- **React 19 の `useOptimistic`**：組み込みの方式で Transition と深く統合されている。プロジェクトが React 19 + Server Actions を使っているなら、組み込み版を優先する
- **スナップショット戦略**：`snapshotRef` は初回の楽観的更新前の状態を保存する。`isPendingRef` により連続した高速操作（ユーザーが素早く 2 回いいねを押すなど）でもスナップショットが上書きされず、rollback は常に真の元の状態に戻せる。サーバー成功後に `confirm()` を呼んで pending フラグをリセットし、次の楽観的更新に備える。失敗時は `rollback()` でスナップショットを復元しフラグをリセットする
- **`updateOptimistic` の参照安定性**：`setState(prev => ...)` の関数形式で現在の値を取得するため、`state` へのクロージャ依存を回避している。依存配列が空なので、state の変化で関数参照が再生成されない
:::

---

## useFormField

> 単一フィールドのフォーム状態管理 -- 値 + バリデーション + エラー + touched の最小単位

react-hook-form を再発明するのではなく、「1 つのフィールド」の完全なライフサイクルを処理する。設定ページ、検索フィルター、シンプルなダイアログフォームなど、重量級フォームライブラリを導入するほどでもない場面で、値、バリデーション、エラーメッセージ、touched 状態（ユーザーが操作してからエラーを表示し、フォームを開いた直後に画面が赤字だらけにならないようにする）を管理する

::: code-group

```tsx [使用例]
function SettingsPage() {
  const username = useFormField("", (value) => {
    if (!value.trim()) return "ユーザー名は必須";
    if (value.length < 3) return "3 文字以上必要";
    if (!/^[a-zA-Z0-9_]+$/.test(value)) return "英数字とアンダースコアのみ使用可能";
    return null;
  });

  const email = useFormField("", (value) => {
    if (!value.trim()) return "メールアドレスは必須";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return "メールアドレスの形式が正しくない";
    return null;
  });

  const handleSubmit = () => {
    // 全フィールドの touched 状態をトリガーし、バリデーションエラーを表示
    username.touch();
    email.touch();

    if (!username.error && !email.error) {
      saveSettings({ username: username.value, email: email.value });
    }
  };

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        handleSubmit();
      }}
    >
      <div>
        <input {...username.inputProps} placeholder="ユーザー名" />
        {username.showError && <span className="error">{username.error}</span>}
      </div>
      <div>
        <input {...email.inputProps} type="email" placeholder="メールアドレス" />
        {email.showError && <span className="error">{email.error}</span>}
      </div>
      <button type="submit">保存</button>
    </form>
  );
}
```

```ts [実装コード]
import { useState, useMemo, useCallback } from "react";

type Validator = (value: string) => string | null;

function useFormField(initialValue: string, validate?: Validator) {
  const [value, setValue] = useState(initialValue);
  const [touched, setTouched] = useState(false);

  const error = useMemo(() => validate?.(value) ?? null, [value, validate]);

  // touched 後にのみエラーを表示
  const showError = touched && error !== null;

  const touch = useCallback(() => setTouched(true), []);
  const reset = useCallback(() => {
    setValue(initialValue);
    setTouched(false);
  }, [initialValue]);

  // input に直接スプレッドできる
  const inputProps = useMemo(
    () => ({
      value,
      onChange: (e: React.ChangeEvent<HTMLInputElement>) =>
        setValue(e.target.value),
      onBlur: () => setTouched(true),
    }),
    [value],
  );

  return { value, error, touched, showError, inputProps, touch, reset };
}
```

:::

::: tip

- **使うべき場面**：設定ページ、検索フィルター、シンプルなダイアログの 2-3 フィールド -- react-hook-form を導入するほどでもない軽量な場面
- **使うべきでない場面**：複雑なフォーム（10+ フィールド、ネスト構造、動的フィールド、フィールド連動） -- これらは react-hook-form や Formik を使う
- **touched の意味**：ユーザーが操作していないフィールドにはエラーを表示すべきでない。`onBlur` 時に touched をマークし、送信時に `touch()` で全エラーを強制表示する
- **`inputProps` パターン**：`<input>` に直接スプレッドできるオブジェクトを返し、ボイラープレートを削減する。同じパターンは Formik の `getFieldProps` や Downshift の `getInputProps` にも見られる
- **`validate` の依存安定性**：`validate` 関数をコンポーネント内でインライン定義すると、毎回の render で新しい参照になり `useMemo` が繰り返し実行される。バリデーションロジック自体は軽いのでパフォーマンスに影響しないが、バリデーション関数に副作用がある場合（あるべきではない）は `useCallback` で参照を安定させる必要がある
:::

---

## useStateWithHistory

> undo/redo 付き状態 -- 状態の履歴スタックを管理する

リッチテキストエディタ、キャンバス、マルチステップフォームウィザード、ビジュアル設定ツール -- これらの場面ではユーザーは Ctrl+Z を期待する。単純な `useState` ではなく、履歴スタックとポインタを管理し、undo、redo、任意の履歴位置へのジャンプをサポートする

::: code-group

```tsx [使用例]
function DrawingCanvas() {
  const [color, setColor, { undo, redo, canUndo, canRedo }] =
    useStateWithHistory("#000000");

  return (
    <div>
      <input
        type="color"
        value={color}
        onChange={(e) => setColor(e.target.value)}
      />
      <button disabled={!canUndo} onClick={undo}>
        元に戻す
      </button>
      <button disabled={!canRedo} onClick={redo}>
        やり直し
      </button>
      <Canvas brushColor={color} />
    </div>
  );
}

function FormWizard() {
  const [step, setStep, { undo: goBack, canUndo: canGoBack, history }] =
    useStateWithHistory(0, { maxHistory: 20 });

  const steps = [<StepOne />, <StepTwo />, <StepThree />];

  return (
    <div>
      <div>
        ステップ {step + 1} / {steps.length}（訪問済み {history.length} ステップ）
      </div>
      {steps[step]}
      <button disabled={!canGoBack} onClick={goBack}>
        前へ
      </button>
      <button
        disabled={step >= steps.length - 1}
        onClick={() => setStep(step + 1)}
      >
        次へ
      </button>
    </div>
  );
}
```

```ts [実装コード]
import { useState, useCallback, useRef } from "react";

interface HistoryOptions {
  maxHistory?: number;
}

interface HistoryControls {
  undo: () => void;
  redo: () => void;
  go: (index: number) => void;
  canUndo: boolean;
  canRedo: boolean;
  history: readonly unknown[];
}

function useStateWithHistory<T>(
  initialValue: T,
  options: HistoryOptions = {},
): [T, (value: T) => void, HistoryControls] {
  const { maxHistory = 50 } = options;
  const [state, setStateRaw] = useState(initialValue);
  const [pointer, setPointer] = useState(0);

  // 履歴スタックは ref（内容変更で re-render 不要）、ポインタは state（canUndo/canRedo の更新に必要）
  const historyRef = useRef<T[]>([initialValue]);

  const setState = useCallback(
    (value: T) => {
      const history = historyRef.current;

      setPointer((prevPointer) => {
        // 新しい操作時に pointer 以降の「未来」の記録を破棄
        const newHistory = history.slice(0, prevPointer + 1);
        newHistory.push(value);

        // 上限超過時は最古の記録を削除
        if (newHistory.length > maxHistory) {
          newHistory.shift();
        }

        historyRef.current = newHistory;
        return newHistory.length - 1;
      });
      setStateRaw(value);
    },
    [maxHistory],
  );

  const undo = useCallback(() => {
    setPointer((prev) => {
      if (prev <= 0) return prev;
      const newPointer = prev - 1;
      setStateRaw(historyRef.current[newPointer]);
      return newPointer;
    });
  }, []);

  const redo = useCallback(() => {
    setPointer((prev) => {
      if (prev >= historyRef.current.length - 1) return prev;
      const newPointer = prev + 1;
      setStateRaw(historyRef.current[newPointer]);
      return newPointer;
    });
  }, []);

  const go = useCallback((index: number) => {
    setPointer(() => {
      const clamped = Math.max(
        0,
        Math.min(index, historyRef.current.length - 1),
      );
      setStateRaw(historyRef.current[clamped]);
      return clamped;
    });
  }, []);

  return [
    state,
    setState,
    {
      undo,
      redo,
      go,
      canUndo: pointer > 0,
      canRedo: pointer < historyRef.current.length - 1,
      history: historyRef.current,
    },
  ];
}
```

:::

::: tip

- **使うべき場面**：undo/redo が必要なあらゆるインタラクション -- エディタ、キャンバス、ビジュアル設定ツール、マルチステップフォームの「前へ」
- **使うべきでない場面**：シンプルな状態切り替え（トグル、タブ） -- undo の必要がなければ履歴スタックを無駄に管理しない
- **`maxHistory` でメモリリーク防止**：デフォルト上限は 50 件。状態が大きなオブジェクト（キャンバスデータなど）の場合は小さく設定するか、完全なスナップショットではなく diff のみの保存を検討する
- **なぜ履歴スタックは ref、ポインタは state なのか**：履歴スタックの内容変更は re-render を必要としないため、ref で保存して不要なレンダリングを避ける。一方ポインタ（pointer）は state にする必要がある。`canUndo`/`canRedo` がポインタ位置に依存して判定するためで、ポインタも ref にすると、undo が底に達したとき state の値が変わらず（React の bailout 最適化）、`canUndo` が true から false に変わらずボタンの状態が固まってしまう
:::
