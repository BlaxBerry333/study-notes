# Metabase

> オープンソースの軽量 BI ツール

## クイックスタート

::: code-group

```bash [Docker]
docker run -d -p 3000:3000 --name metabase metabase/metabase
```

:::

`http://localhost:3000` にアクセスすれば利用できる。

---

## コア機能

### Questions（質問）

2つの作成方法がある：

| 方法 | 説明 | 対象ユーザー |
| ------ | ---------------- | ----------- |
| Simple | クリック操作、SQL 不要 | ビジネスユーザー |
| Native | ネイティブ SQL クエリ | 開発者/アナリスト |

---

### Dashboard（ダッシュボード）

複数の Question を組み合わせてダッシュボードを構成する：

- ドラッグ&ドロップでレイアウト
- フィルタの連動
- 自動リフレッシュ
- フルスクリーン表示

---

### Models（モデル）

再利用可能なデータモデルを定義する：

```sql
-- 注文サマリーモデルの定義
SELECT
  customer_id,
  COUNT(*) as order_count,
  SUM(amount) as total_amount,
  MAX(created_at) as last_order_date
FROM orders
GROUP BY customer_id
```

---

## デプロイ構成

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│  Metabase   │────▶│  App DB     │     │  Data DB    │
│  (Java)     │     │  (H2/PG)    │     │  (業務データ) │
└─────────────┘     └─────────────┘     └─────────────┘
                          │                    │
                    設定/Question を保存     データをクエリ
```

::: warning 本番環境
デフォルトでは設定の保存に H2 データベースを使用するが、本番環境では PostgreSQL に切り替えるべきである。
:::

---

## メリット・デメリット

::: tip メリット

- オープンソースで無料（Community 版）
- 5分で使い始められる
- 20以上のデータソースに対応
- 組み込み分析に対応
:::

::: warning デメリット

- 複雑なモデリング機能は限定的
- 大量データでのパフォーマンスが普通
- 高度な機能は有料版が必要
:::
