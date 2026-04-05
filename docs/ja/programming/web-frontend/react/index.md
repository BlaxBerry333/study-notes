---
prev: false
next: false
---

# React

宣言的UIライブラリ――コンポーネントでインターフェースを記述し、状態変化時に自動的にDOMを更新する

::: warning 特徴:

- **宣言的**：「UIがどうあるべきか」を記述し、「どうDOMを操作するか」ではない
- **コンポーネント化**：UI = コンポーネントツリー、各コンポーネントが自身の状態とレンダリングを管理
- **単方向データフロー**：データは親コンポーネントからpropsを通じて下に伝達し、イベントはコールバックで上に伝達
- **仮想DOM**：state変化 → 新しい仮想DOMを生成 → diff → 最小限の実DOM操作

:::

## 基礎概念

| 概念 | 一言説明 |
| --- | --- |
| JSX | JavaScriptの構文拡張――HTML風の書き方が `React.createElement` にコンパイルされる |
| コンポーネント | propsを受け取り、JSXを返す関数（関数コンポーネントが現代の標準） |
| Props | 親コンポーネントから子コンポーネントに渡すデータ――読み取り専用、変更不可 |
| State | コンポーネント内部の可変データ――`useState` で管理し、変化がre-renderをトリガー |
| Hooks | 関数コンポーネントで状態と副作用を使用する仕組み――`useState`、`useEffect`、`useRef` など |
| Re-render | state/propsが変化した時にコンポーネントが再実行――新しい仮想DOMを生成してdiffに使用 |

---

### Hooks 早見表

| Hook | 用途 | キーポイント |
| --- | --- | --- |
| `useState` | コンポーネント内の状態 | 更新がre-renderをトリガー |
| `useEffect` | 副作用（データ取得、購読、DOM操作） | 依存配列で実行タイミングを制御 |
| `useRef` | 永続的な参照（DOM要素 / 可変値） | 変更してもre-renderをトリガーしない |
| `useMemo` | 計算結果のキャッシュ | 依存が変わらなければ再計算をスキップ |
| `useCallback` | 関数参照のキャッシュ | `React.memo` と組み合わせて使用 |
| `useReducer` | 複雑な状態ロジック | state + action パターン |
| `useContext` | Context値の消費 | valueが変化すると消費者がre-render |
| `useTransition` | 低優先度の更新をマーク | UIのレスポンシブ性を維持 |
| `useDeferredValue` | 値の更新を遅延 | propsを受け取る時の代替手段 |

---

#### 基礎

- [コンポーネント設計パターン](/ja/programming/web-frontend/react/design-patterns)
- [実用カスタム Hooks](/ja/programming/web-frontend/react/custom-hooks)

#### パフォーマンス最適化

- [レンダリング最適化](/ja/programming/web-frontend/react/performance)
- [ロードパフォーマンス](/ja/programming/web-frontend/react/performance-loading)

#### 上級

- [状態管理](/ja/programming/web-frontend/react/state-management)
- [Hooks 深掘り](/ja/programming/web-frontend/react/hooks-deep)
