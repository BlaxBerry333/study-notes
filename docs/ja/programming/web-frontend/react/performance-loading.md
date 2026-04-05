# ロードパフォーマンス

> Loading Performance -- 初期表示のバンドルサイズを削減し、リソースをオンデマンドで読み込み、大量データの場面を最適化する

## コード分割と遅延読み込み

> 必要なコードだけをオンデマンドで読み込み、ユーザーは現在必要な chunk のみをダウンロードする

---

### React.lazy + Suspense

```tsx
import { lazy, Suspense } from "react";

const AdminDashboard = lazy(() => import("./AdminDashboard"));
const UserSettings = lazy(() => import("./UserSettings"));

function App() {
  const [page, setPage] = useState<"admin" | "settings">("admin");

  return (
    <Suspense fallback={<PageSkeleton />}>
      {page === "admin" && <AdminDashboard />}
      {page === "settings" && <UserSettings />}
    </Suspense>
  );
}
```

---

### ルートレベルの分割

最も一般的でコスパの高い分割戦略 -- ページごとに 1 つの chunk：

```tsx
import { lazy, Suspense } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";

const Home = lazy(() => import("./pages/Home"));
const About = lazy(() => import("./pages/About"));
const Dashboard = lazy(() => import("./pages/Dashboard"));

function App() {
  return (
    <BrowserRouter>
      <Suspense fallback={<GlobalSpinner />}>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/about" element={<About />} />
          <Route path="/dashboard" element={<Dashboard />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}
```

---

### プリロード

マウスホバー時に import をトリガーし、クリック時にはコンポーネントが準備済みになる：

```tsx
const AdminDashboard = lazy(() => import("./AdminDashboard"));

function NavLink() {
  return (
    <Link to="/admin" onMouseEnter={() => import("./AdminDashboard")}>
      管理画面
    </Link>
  );
}
```

::: tip

- `React.lazy` はモジュールの `default export` が React コンポーネントであることを要求する
- `Suspense` の `fallback` は軽量な loading UI にすべきである（スケルトン > スピナー > 空白）
- 過度な分割はしない：chunk ごとに HTTP リクエストのオーバーヘッドがある。「ルート」か「大型機能モジュール」単位で分割すれば十分
- re-export の罠：`index.ts` が barrel export で全コンポーネントを再エクスポートしている場合、`lazy(() => import('./components'))` は barrel 全体を読み込む。import パスは具体的なファイルを指定すること
:::

---

## 画像とリソースの最適化

> コード以外のリソースが読み込みとランタイムに与える影響を削減する

---

### 画像の遅延読み込み

```tsx
// 最もシンプルな方法：ブラウザネイティブの loading="lazy"
function ImageGallery({ images }: { images: ImageItem[] }) {
  return (
    <div>
      {images.map((img) => (
        <img
          key={img.id}
          src={img.src}
          alt={img.alt}
          loading="lazy" // ビューポートに入る前は読み込まない
          decoding="async" // メインスレッドをブロックせずにデコード
          width={img.width} // レイアウトシフト（CLS）を防止
          height={img.height}
        />
      ))}
    </div>
  );
}
```

より細かい制御が必要な場合（事前トリガー、カスタムプレースホルダーなど）は Intersection Observer を使う：

```tsx
function LazyImage({
  src,
  alt,
  ...props
}: React.ImgHTMLAttributes<HTMLImageElement>) {
  const [isVisible, setIsVisible] = useState(false);
  const imgRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = imgRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: "200px" }, // 200px 手前から読み込み開始
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={imgRef}>
      {isVisible ? <img src={src} alt={alt} {...props} /> : <Placeholder />}
    </div>
  );
}
```

---

### 動的インポート

重量級ライブラリを初期表示で読み込む必要はない。動的 `import()` でオンデマンドに取り込む：

```tsx
// ❌ 初期表示で 200KB+ のライブラリを読み込む
import dayjs from "dayjs";
import ExcelJS from "exceljs";

// ✅ ユーザーがトリガーしたときに読み込む
async function handleExport(data: ReportData[]) {
  const ExcelJS = await import("exceljs");
  const workbook = new ExcelJS.Workbook();
  // ...生成してダウンロード
}

async function formatRelativeTime(date: Date) {
  const dayjs = (await import("dayjs")).default;
  const relativeTime = (await import("dayjs/plugin/relativeTime")).default;
  dayjs.extend(relativeTime);
  return dayjs(date).fromNow();
}
```

::: tip

- `loading="lazy"` はブラウザサポートが十分に広い。シンプルな場面では優先的に使う
- Intersection Observer 方式はカスタムプレースホルダーやプリロード距離の調整が必要な場面に適する
- 動的インポートされたモジュールはブラウザにキャッシュされ、2 回目以降の `import()` では再ダウンロードされない
- 頻繁に使う重量級ライブラリを動的インポートにすると逆に遅延が増す -- 「たまにしか使わない」ライブラリにのみ適用する
:::

---

## リスト仮想化

> 可視領域内の要素だけをレンダリングする -- 長大なリストパフォーマンスの究極的な手法

リストが数百から数千件のデータを持つ場合、全てを DOM にレンダリングすると初期レンダリングが遅く、スクロールがカクつき、メモリ使用量が高くなる。仮想化の核心的な考え方：**ユーザーが見える数十件だけをレンダリングする**

::: code-group

```tsx [react-window]
import { FixedSizeList } from "react-window";

function VirtualizedList({ items }: { items: Item[] }) {
  return (
    <FixedSizeList
      height={600}
      width="100%"
      itemCount={items.length}
      itemSize={80}
      itemData={items}
    >
      {({ index, style, data }) => (
        <div style={style} key={data[index].id}>
          <h4>{data[index].name}</h4>
          <p>{data[index].description}</p>
        </div>
      )}
    </FixedSizeList>
  );
}
```

```tsx [TanStack Virtual（推奨）]
import { useVirtualizer } from "@tanstack/react-virtual";

function VirtualizedList({ items }: { items: Item[] }) {
  const parentRef = useRef<HTMLDivElement>(null);

  const virtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 80,
    overscan: 5, // 上下に 5 件多くレンダリングし、スクロール時の白画面を軽減
  });

  return (
    <div ref={parentRef} style={{ height: 600, overflow: "auto" }}>
      <div style={{ height: virtualizer.getTotalSize(), position: "relative" }}>
        {virtualizer.getVirtualItems().map((virtualRow) => (
          <div
            key={virtualRow.key}
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              width: "100%",
              height: virtualRow.size,
              transform: `translateY(${virtualRow.start}px)`,
            }}
          >
            {items[virtualRow.index].name}
          </div>
        ))}
      </div>
    </div>
  );
}
```

:::

::: tip

- **react-window**：軽量（~6KB gzip）、API がシンプルで、固定行高のシンプルな場面に適する
- **TanStack Virtual**（推奨）：フレームワーク非依存で、動的行高・水平/グリッド仮想化をサポート
- `overscan` は可視領域外に何件多くレンダリングするかを制御する。適度に大きくすると高速スクロール時の白画面を軽減できる
- 仮想化は万能ではない -- リスト項目に複雑なインタラクション（ドラッグ、展開/折りたたみ）がある場合、実装コストが著しく増加する
- 経験的な閾値：リストが 200-300 件を超えてパフォーマンス問題がある場合に検討する。早すぎる最適化はしない
:::

---

## 並行機能

> useTransition / useDeferredValue -- 緊急更新と非緊急更新を区別し、UI のレスポンスを維持する

React 18 の並行機能により、特定の状態更新を「非緊急」とマークでき、React はユーザーインタラクションを優先処理し、計算量の大きいレンダリングを遅延させる

### useTransition

状態更新を低優先度としてマークし、高優先度の更新（ユーザー入力）が割り込める：

```tsx
function FilterableProductList({ products }: { products: Product[] }) {
  const [query, setQuery] = useState("");
  const [filteredProducts, setFilteredProducts] = useState(products);
  const [isPending, startTransition] = useTransition();

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setQuery(value); // 緊急：入力欄は即座に応答

    startTransition(() => {
      // 非緊急：リストのフィルタリングは遅延可能
      const filtered = products.filter((p) =>
        p.name.toLowerCase().includes(value.toLowerCase()),
      );
      setFilteredProducts(filtered);
    });
  };

  return (
    <div>
      <input value={query} onChange={handleChange} placeholder="商品を検索..." />
      {isPending && <span>更新中...</span>}
      <ProductGrid products={filteredProducts} />
    </div>
  );
}
```

---

### useDeferredValue

値の更新を遅延させ、コンポーネントはまず古い値でレンダリングする。**props を受け取るだけで setState を制御できない場面**に適する：

```tsx
function SearchResults({ query }: { query: string }) {
  const deferredQuery = useDeferredValue(query);

  const results = useMemo(
    () => heavyFilter(allItems, deferredQuery),
    [deferredQuery],
  );

  const isStale = query !== deferredQuery;

  return (
    <div style={{ opacity: isStale ? 0.7 : 1 }}>
      {results.map((item) => (
        <ResultCard key={item.id} item={item} />
      ))}
    </div>
  );
}
```

---

### 比較

|            | useTransition            | useDeferredValue         |
| ---------- | ------------------------ | ------------------------ |
| 制御対象   | 状態更新（setter の呼び出し） | 値（通常は props）       |
| 使用場所   | 更新をトリガーするコンポーネント | 値を消費する子コンポーネント |
| 典型的な場面 | setState を制御できる場所 | props を受け取るだけの場所 |
| isPending  | あり                     | なし（新旧の値を自分で比較） |

::: warning

並行機能は総計算量を減らすのではなく、優先度を再配分するだけである。計算自体が >100ms なら、ユーザーは依然として遅延を感じる。ただし入力欄はカクつかなくなる。真に CPU 集約的な計算には Web Worker でメインスレッドから移す必要がある
:::

---

## Web Worker で計算をオフロード

> CPU 集約的なタスクをメインスレッドから移す -- useTransition では解決できない場面

### Worker 通信

::: code-group

```ts [worker.ts]
// 独立ファイル、Worker スレッドで実行
self.onmessage = (e: MessageEvent<{ type: string; payload: any }>) => {
  const { type, payload } = e.data;

  if (type === "PROCESS_CSV") {
    const rows = payload.csv.split("\n");
    const result = rows.map((row: string) => {
      // 高コストな行ごとのパースと集計をシミュレート
      const cols = row.split(",");
      return {
        sum: cols.reduce((acc: number, v: string) => acc + Number(v), 0),
        avg:
          cols.reduce((acc: number, v: string) => acc + Number(v), 0) /
          cols.length,
      };
    });
    self.postMessage({ type: "PROCESS_CSV_RESULT", payload: result });
  }
};
```

```ts [useWorker.ts]
import { useRef, useEffect, useCallback, useState } from "react";

function useWorker<TResult>(workerFactory: () => Worker) {
  const workerRef = useRef<Worker | null>(null);
  const [result, setResult] = useState<TResult | null>(null);
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    const worker = workerFactory();
    workerRef.current = worker;

    worker.onmessage = (e: MessageEvent) => {
      setResult(e.data.payload);
      setProcessing(false);
    };

    worker.onerror = (err) => {
      console.error("Worker error:", err);
      setProcessing(false);
    };

    return () => worker.terminate();
  }, []);

  const postMessage = useCallback((message: any) => {
    setProcessing(true);
    workerRef.current?.postMessage(message);
  }, []);

  return { result, processing, postMessage };
}
```

```tsx [使用例]
function CsvAnalyzer() {
  const { result, processing, postMessage } = useWorker<AnalysisResult[]>(
    () =>
      new Worker(new URL("./worker.ts", import.meta.url), { type: "module" }),
  );

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    file.text().then((csv) => {
      postMessage({ type: "PROCESS_CSV", payload: { csv } });
    });
  };

  return (
    <div>
      <input type="file" accept=".csv" onChange={handleFileUpload} />
      {processing && <p>処理中... UI はスムーズに保たれる</p>}
      {result && <DataTable data={result} />}
    </div>
  );
}
```

:::

::: tip

- `new URL('./worker.ts', import.meta.url)` は Vite/Webpack 5 がサポートする Worker のインポート方式
- Worker スレッドは DOM にアクセスできず、`postMessage` のみで通信する（構造化クローン、関数は渡せない）
- 適する場面：CSV/JSON 大量ファイルのパース、クライアントサイド暗号化、画像フィルター処理、複雑な数学計算
- 適さない場面：単純なリストフィルタリング、通常のフォームバリデーション -- Worker の通信オーバーヘッドが計算自体より大きくなる
:::

::: warning Worker vs useTransition の使い分け

| 場面                                 | 方式                                 |
| ------------------------------------ | ------------------------------------ |
| 数千件のフィルタリング/ソート（<50ms） | `useMemo` で十分                     |
| フィルタリング/ソートで入力がカクつく（50-200ms） | `useTransition` / `useDeferredValue` |
| 大量ファイルのパース、暗号化、画像処理（>200ms） | Web Worker                           |

:::

---

## Core Web Vitals

> Google が定義するユーザー体験のコア指標——SEO ランキングとユーザーリテンションに影響

| 指標 | 意味 | 良好 | 不良 | 最適化の方向 |
| --- | --- | --- | --- | --- |
| **LCP** | 最大コンテンツの描画——ページの主要コンテンツがどれだけ早く表示されるか | < 2.5s | > 4s | ファーストビューのリソース読み込み最適化 |
| **INP** | インタラクション遅延——ユーザー操作から UI 応答までの時間 | < 200ms | > 500ms | メインスレッドのブロッキング削減 |
| **CLS** | 累積レイアウトシフト——ページコンテンツが予期せず移動する程度 | < 0.1 | > 0.25 | 画像/広告のサイズ事前確保 |

---

### LCP 最適化

```tsx
// 重要な画像のプリロード
<link rel="preload" href="/hero.webp" as="image" />

// ファーストビューの画像は lazy load しない
<img src="/hero.webp" fetchPriority="high" /> // ファーストビューの重要画像
<img src="/below.webp" loading="lazy" />       // 非ファーストビューのみ lazy

// ブロッキングリソースの削減
<link rel="preconnect" href="https://fonts.googleapis.com" />
<script async src="/analytics.js" />
```

---

### INP 最適化

```tsx
// 重い処理でインタラクションをブロックしない
const [isPending, startTransition] = useTransition();

function handleClick() {
  startTransition(() => {
    // 重い計算を transition に入れ、次のインタラクションをブロックしない
    setFilteredItems(heavyFilter(items));
  });
}

// さらに重い計算は Web Worker に移す（上記の Web Worker セクション参照）
```

---

### CLS 最適化

```tsx
// ✅ 画像には常にサイズを指定——読み込み後のレイアウトジャンプ防止
<img src={src} width={800} height={600} alt={alt} />

// ✅ スケルトンスクリーンで場所を確保——非同期コンテンツ読み込み前のレイアウト安定化
<Suspense fallback={<CardSkeleton />}>
  <AsyncCard />
</Suspense>

// ❌ 既存コンテンツの上に動的に要素を挿入しない
// ❌ サイズ未指定の iframe / 広告 / フォント切り替えによるちらつきを避ける
```

::: tip 計測ツール

- **Chrome DevTools → Lighthouse**：ローカル測定、具体的な最適化提案
- **Chrome DevTools → Performance**：ランタイムパフォーマンスの記録、ロングタスクの分析
- **web.dev/measure**：オンライン測定、実ユーザーデータを使用
- `web-vitals` npm パッケージ：コード内で実ユーザー指標をレポート

```ts
import { onLCP, onINP, onCLS } from "web-vitals";

onLCP(console.log);
onINP(console.log);
onCLS(console.log);
```

:::
