# 加载性能

> Loading Performance — 减少首屏体积，按需加载资源，优化大数据量场景

## 代码分割与懒加载

> 按需加载代码，让用户只下载当前需要的 chunk

### React.lazy + Suspense

```tsx
import { lazy, Suspense } from 'react'

const AdminDashboard = lazy(() => import('./AdminDashboard'))
const UserSettings = lazy(() => import('./UserSettings'))

function App() {
  const [page, setPage] = useState<'admin' | 'settings'>('admin')

  return (
    <Suspense fallback={<PageSkeleton />}>
      {page === 'admin' && <AdminDashboard />}
      {page === 'settings' && <UserSettings />}
    </Suspense>
  )
}
```

### 路由级分割

最常见也是性价比最高的分割策略 — 每个页面一个 chunk：

```tsx
import { lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'

const Home = lazy(() => import('./pages/Home'))
const About = lazy(() => import('./pages/About'))
const Dashboard = lazy(() => import('./pages/Dashboard'))

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
  )
}
```

### 预加载

鼠标悬停时触发 import，点击时组件已经就绪：

```tsx
const AdminDashboard = lazy(() => import('./AdminDashboard'))

function NavLink() {
  return (
    <Link
      to="/admin"
      onMouseEnter={() => import('./AdminDashboard')}
    >
      管理后台
    </Link>
  )
}
```

::: tip

- `React.lazy` 要求模块的 `default export` 是 React 组件
- `Suspense` 的 `fallback` 应该是轻量的 loading UI（骨架屏 > Spinner > 空白）
- 不要过度分割：每个 chunk 有 HTTP 请求开销，按"路由"或"大型功能模块"拆分即可
- 重导出陷阱：`index.ts` barrel export 了所有组件时，`lazy(() => import('./components'))` 会加载整个 barrel。确保 import 路径指向具体文件

:::

---

## 图片与资源优化

> 减少非代码资源对加载和运行时的影响

### 图片懒加载

```tsx
// 最简方案：浏览器原生 loading="lazy"
function ImageGallery({ images }: { images: ImageItem[] }) {
  return (
    <div>
      {images.map(img => (
        <img
          key={img.id}
          src={img.src}
          alt={img.alt}
          loading="lazy"           // 进入视口前不加载
          decoding="async"         // 不阻塞主线程解码
          width={img.width}        // 避免布局偏移（CLS）
          height={img.height}
        />
      ))}
    </div>
  )
}
```

当需要更精细的控制（如提前触发加载、自定义 placeholder）时，用 Intersection Observer：

```tsx
function LazyImage({ src, alt, ...props }: React.ImgHTMLAttributes<HTMLImageElement>) {
  const [isVisible, setIsVisible] = useState(false)
  const imgRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = imgRef.current
    if (!el) return

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true)
          observer.disconnect()
        }
      },
      { rootMargin: '200px' } // 提前 200px 开始加载
    )

    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  return (
    <div ref={imgRef}>
      {isVisible ? <img src={src} alt={alt} {...props} /> : <Placeholder />}
    </div>
  )
}
```

### 动态导入非组件模块

重型库不一定要在首屏加载。用动态 `import()` 按需引入：

```tsx
// ❌ 首屏就加载 200KB+ 的库
import dayjs from 'dayjs'
import ExcelJS from 'exceljs'

// ✅ 用户触发时才加载
async function handleExport(data: ReportData[]) {
  const ExcelJS = await import('exceljs')
  const workbook = new ExcelJS.Workbook()
  // ...生成并下载
}

async function formatRelativeTime(date: Date) {
  const dayjs = (await import('dayjs')).default
  const relativeTime = (await import('dayjs/plugin/relativeTime')).default
  dayjs.extend(relativeTime)
  return dayjs(date).fromNow()
}
```

::: tip

- `loading="lazy"` 浏览器支持已经非常好，简单场景优先使用
- Intersection Observer 方案适合需要自定义 placeholder、预加载距离的场景
- 动态导入的模块会被浏览器缓存，第二次 `import()` 同一模块不会重新下载
- 对于频繁使用的重型库，动态导入反而增加延迟 — 只对"偶尔用到"的库这么做

:::

---

## 列表虚拟化

> 只渲染可视区域内的元素 — 长列表性能的终极方案

当列表有成百上千条数据时，全部渲染到 DOM 会导致初始渲染慢、滚动卡顿、内存占用高。虚拟化的核心思想：**只渲染用户能看到的那几十条**

::: code-group

```tsx [react-window]
import { FixedSizeList } from 'react-window'

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
  )
}
```

```tsx [TanStack Virtual（推荐）]
import { useVirtualizer } from '@tanstack/react-virtual'

function VirtualizedList({ items }: { items: Item[] }) {
  const parentRef = useRef<HTMLDivElement>(null)

  const virtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 80,
    overscan: 5, // 上下多渲染 5 条，减少滚动白屏
  })

  return (
    <div ref={parentRef} style={{ height: 600, overflow: 'auto' }}>
      <div style={{ height: virtualizer.getTotalSize(), position: 'relative' }}>
        {virtualizer.getVirtualItems().map(virtualRow => (
          <div
            key={virtualRow.key}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: virtualRow.size,
              transform: `translateY(${virtualRow.start}px)`,
            }}
          >
            {items[virtualRow.index].name}
          </div>
        ))}
      </div>
    </div>
  )
}
```

:::

::: tip

- **react-window**：轻量（~6KB gzip），API 简单，适合固定行高的简单场景
- **TanStack Virtual**（推荐）：框架无关，支持动态行高、水平/网格虚拟化
- `overscan` 控制可视区域外多渲染几条，适当增大可减少快速滚动时的白屏
- 虚拟化不是万能的 — 列表项有复杂交互（拖拽、展开收起）时实现成本显著增加
- 经验阈值：列表超过 200-300 条且有性能问题时再考虑，别提前优化

:::

---

## 并发特性

> useTransition / useDeferredValue — 区分紧急更新和非紧急更新，保持 UI 响应

React 18 的并发特性允许标记某些状态更新为"非紧急"，让 React 优先处理用户交互，延迟处理计算量大的渲染

### useTransition

将状态更新标记为低优先级，高优先级更新（用户输入）可以打断它：

```tsx
function FilterableProductList({ products }: { products: Product[] }) {
  const [query, setQuery] = useState('')
  const [filteredProducts, setFilteredProducts] = useState(products)
  const [isPending, startTransition] = useTransition()

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    setQuery(value) // 紧急：输入框立即响应

    startTransition(() => {
      // 非紧急：列表过滤可以延迟
      const filtered = products.filter(p =>
        p.name.toLowerCase().includes(value.toLowerCase())
      )
      setFilteredProducts(filtered)
    })
  }

  return (
    <div>
      <input value={query} onChange={handleChange} placeholder="搜索商品..." />
      {isPending && <span>更新中...</span>}
      <ProductGrid products={filteredProducts} />
    </div>
  )
}
```

### useDeferredValue

延迟一个值的更新，让组件先用旧值渲染，适合**你只能接收 props 而不能控制 setState 的场景**：

```tsx
function SearchResults({ query }: { query: string }) {
  const deferredQuery = useDeferredValue(query)

  const results = useMemo(
    () => heavyFilter(allItems, deferredQuery),
    [deferredQuery]
  )

  const isStale = query !== deferredQuery

  return (
    <div style={{ opacity: isStale ? 0.7 : 1 }}>
      {results.map(item => <ResultCard key={item.id} item={item} />)}
    </div>
  )
}
```

### useTransition vs useDeferredValue

| | useTransition | useDeferredValue |
|---|---|---|
| 控制的对象 | 状态更新（setter 调用） | 一个值（通常是 props） |
| 使用位置 | 触发更新的组件 | 消费值的子组件 |
| 典型场景 | 你能控制 setState 的地方 | 你只能接收 props |
| isPending | 有 | 没有（需自己比较新旧值） |

::: warning

并发特性不减少总计算量，只是重新安排优先级。如果计算本身 >100ms，用户仍会感知延迟，只是输入框不卡了。对于真正 CPU 密集的计算，需要用 Web Worker 移出主线程

:::

---

## Web Worker 卸载计算

> 把 CPU 密集任务移出主线程 — useTransition 解决不了的场景

useTransition 只是调度优先级，计算仍然在主线程上执行。对于真正昂贵的任务（大数据处理、加密、图像处理），需要把计算完全移出主线程

### React + Worker 通信

::: code-group

```ts [worker.ts]
// 独立文件，运行在 Worker 线程
self.onmessage = (e: MessageEvent<{ type: string; payload: any }>) => {
  const { type, payload } = e.data

  if (type === 'PROCESS_CSV') {
    const rows = payload.csv.split('\n')
    const result = rows.map((row: string) => {
      // 模拟昂贵的逐行解析和统计
      const cols = row.split(',')
      return {
        sum: cols.reduce((acc: number, v: string) => acc + Number(v), 0),
        avg: cols.reduce((acc: number, v: string) => acc + Number(v), 0) / cols.length,
      }
    })
    self.postMessage({ type: 'PROCESS_CSV_RESULT', payload: result })
  }
}
```

```ts [useWorker.ts]
import { useRef, useEffect, useCallback, useState } from 'react'

function useWorker<TResult>(workerFactory: () => Worker) {
  const workerRef = useRef<Worker | null>(null)
  const [result, setResult] = useState<TResult | null>(null)
  const [processing, setProcessing] = useState(false)

  useEffect(() => {
    const worker = workerFactory()
    workerRef.current = worker

    worker.onmessage = (e: MessageEvent) => {
      setResult(e.data.payload)
      setProcessing(false)
    }

    worker.onerror = (err) => {
      console.error('Worker error:', err)
      setProcessing(false)
    }

    return () => worker.terminate()
  }, [])

  const postMessage = useCallback((message: any) => {
    setProcessing(true)
    workerRef.current?.postMessage(message)
  }, [])

  return { result, processing, postMessage }
}
```

```tsx [使用例子]
function CsvAnalyzer() {
  const { result, processing, postMessage } = useWorker<AnalysisResult[]>(
    () => new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' })
  )

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    file.text().then(csv => {
      postMessage({ type: 'PROCESS_CSV', payload: { csv } })
    })
  }

  return (
    <div>
      <input type="file" accept=".csv" onChange={handleFileUpload} />
      {processing && <p>处理中... UI 保持流畅</p>}
      {result && <DataTable data={result} />}
    </div>
  )
}
```

:::

::: tip

- `new URL('./worker.ts', import.meta.url)` 是 Vite/Webpack 5 支持的 Worker 导入方式
- Worker 线程不能访问 DOM，只能通过 `postMessage` 通信（结构化克隆，不能传函数）
- 适合场景：CSV/JSON 大文件解析、客户端加密、图像滤镜处理、复杂数学计算
- 不适合：简单的列表过滤、普通表单验证 — Worker 的通信开销比计算本身还大

:::

::: warning 何时用 Worker vs useTransition

| 场景 | 方案 |
|---|---|
| 过滤/排序几千条数据（<50ms） | `useMemo` 就够了 |
| 过滤/排序导致输入卡顿（50-200ms） | `useTransition` / `useDeferredValue` |
| 解析大文件、加密、图像处理（>200ms） | Web Worker |

:::
