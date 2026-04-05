# BigQuery

Google Cloud のサーバーレスデータウェアハウス

::: warning 特徴:

- サーバーレス、オンデマンドでスケーリング
- カラムナストレージ、PB 級のデータ分析
- 標準 SQL 対応
- GCP エコシステムとの深い統合
:::

---

## 基本操作

::: code-group

```sql [クエリ]
-- 基本クエリ
SELECT *
FROM `project.dataset.table`
WHERE date >= '2024-01-01'
LIMIT 1000;

-- 集約
SELECT
  country,
  COUNT(*) as user_count,
  SUM(revenue) as total_revenue
FROM `project.dataset.orders`
GROUP BY country
ORDER BY total_revenue DESC;
```

```sql [テーブル操作]
-- データセットの作成
CREATE SCHEMA `project.my_dataset`;

-- テーブルの作成
CREATE TABLE `project.dataset.users` (
  id INT64,
  name STRING,
  email STRING,
  created_at TIMESTAMP
);

-- クエリからテーブルを作成
CREATE TABLE `project.dataset.daily_summary` AS
SELECT date, COUNT(*) as count
FROM `project.dataset.events`
GROUP BY date;
```

```sql [パーティションテーブル]
-- パーティションテーブルの作成（日付別）
CREATE TABLE `project.dataset.events`
(
  event_id STRING,
  event_type STRING,
  event_time TIMESTAMP,
  user_id STRING
)
PARTITION BY DATE(event_time);

-- パーティションテーブルのクエリ（自動プルーニング）
SELECT *
FROM `project.dataset.events`
WHERE DATE(event_time) = '2024-01-15';
```

:::

---

## よく使う関数

### 日付・時刻

```sql
-- 現在時刻
CURRENT_TIMESTAMP()
CURRENT_DATE()

-- 日付の抽出
EXTRACT(YEAR FROM timestamp_col)
DATE_TRUNC(date_col, MONTH)

-- 日付の計算
DATE_ADD(date_col, INTERVAL 7 DAY)
DATE_DIFF(date1, date2, DAY)
```

---

### 文字列

```sql
-- 連結
CONCAT(first_name, ' ', last_name)

-- 正規表現
REGEXP_EXTRACT(url, r'/product/(\d+)')
REGEXP_CONTAINS(email, r'@gmail\.com$')
```

---

### 配列

```sql
-- 配列操作
ARRAY_AGG(item)
ARRAY_LENGTH(arr)
UNNEST(array_col)

-- 例：配列の展開
SELECT user_id, tag
FROM `dataset.users`, UNNEST(tags) as tag;
```

---

## ウィンドウ関数

```sql
SELECT
  user_id,
  order_date,
  amount,
  -- ランキング
  ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY order_date) as order_num,
  -- 累積
  SUM(amount) OVER (PARTITION BY user_id ORDER BY order_date) as cumulative_amount,
  -- 前の行
  LAG(amount) OVER (PARTITION BY user_id ORDER BY order_date) as prev_amount
FROM `dataset.orders`;
```

---

## コスト最適化

::: tip ベストプラクティス

- **必要なカラムだけ取得する**：`SELECT *` を避ける
- **パーティションテーブルを使う**：日付/時刻でパーティショニング
- **クラスタリングテーブルを使う**：よく使うフィルタカラムでクラスタリング
- **データをプレビューする**：LIMIT やプレビュー機能を活用
- **結果をキャッシュする**：同一クエリは 24 時間以内なら無料
:::

```sql
-- クエリのスキャン量を確認（dry run）
-- Console で "Estimate" にチェックを入れるか --dry_run を使用

-- テーブルサイズの確認
SELECT
  table_name,
  ROUND(size_bytes / POW(10,9), 2) as size_gb
FROM `project.dataset.INFORMATION_SCHEMA.TABLE_STORAGE`;
```
