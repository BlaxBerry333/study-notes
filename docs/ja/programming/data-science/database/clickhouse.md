# ClickHouse

オープンソースのカラムナ OLAP データベース。極限のクエリ性能

::: warning 特徴:

- カラムナストレージ、高圧縮率
- ベクトル化実行エンジン
- リアルタイムデータ書き込み
- 分散アーキテクチャ
:::

---

## 基本操作

::: code-group

```sql [データベース/テーブル]
-- データベースの作成
CREATE DATABASE mydb;

-- テーブルの作成（MergeTree エンジン）
CREATE TABLE mydb.events (
  event_date Date,
  event_time DateTime,
  user_id UInt64,
  event_type String,
  properties String
)
ENGINE = MergeTree()
PARTITION BY toYYYYMM(event_date)
ORDER BY (event_date, user_id);

-- テーブル構造の表示
DESCRIBE TABLE mydb.events;
```

```sql [データの挿入]
-- 単一行の挿入
INSERT INTO mydb.events VALUES
  ('2024-01-15', '2024-01-15 10:30:00', 1001, 'click', '{}');

-- バッチ挿入
INSERT INTO mydb.events VALUES
  ('2024-01-15', '2024-01-15 10:30:00', 1001, 'click', '{}'),
  ('2024-01-15', '2024-01-15 10:31:00', 1002, 'view', '{}');
```

```sql [クエリ]
-- 基本クエリ
SELECT *
FROM mydb.events
WHERE event_date = '2024-01-15'
LIMIT 100;

-- 集約クエリ
SELECT
  event_type,
  count() AS cnt,
  uniq(user_id) AS uv
FROM mydb.events
WHERE event_date >= '2024-01-01'
GROUP BY event_type
ORDER BY cnt DESC;
```

:::

---

## テーブルエンジン

| エンジン | 特徴 | 適用シーン |
| -------------------- | ------------------ | -------------- |
| MergeTree | 主力エンジン、インデックス対応 | 大半の分析シーン |
| ReplacingMergeTree | マージ時に重複排除 | 更新が必要なデータ |
| SummingMergeTree | 事前集約 | 指標の集計 |
| AggregatingMergeTree | インクリメンタル集約 | 複雑な事前集約 |
| Distributed | 分散クエリ | クラスタ構成 |

---

## よく使う関数

```sql
-- 日付・時刻
toDate(timestamp)
toYYYYMM(date)
toStartOfHour(datetime)
dateDiff('day', date1, date2)

-- 集約
count()
sum(col)
avg(col)
uniq(col)        -- 近似ユニークカウント
uniqExact(col)   -- 厳密ユニークカウント

-- 配列
arrayJoin(arr)   -- 配列の展開
groupArray(col)  -- 集約して配列化
```

---

## パフォーマンス最適化

::: tip ベストプラクティス

- **ORDER BY を適切に設計する**：よく使うクエリ条件を前に配置
- **パーティションを使う**：日付でパーティショニングし、クエリ時に日付範囲を指定
- **バッチ書き込みを行う**：頻繁な小規模挿入を避ける
- **マテリアライズドビューを使う**：よく使う集約を事前計算
:::

```sql
-- マテリアライズドビュー（事前集約）
CREATE MATERIALIZED VIEW mydb.events_daily
ENGINE = SummingMergeTree()
ORDER BY (event_date, event_type)
AS SELECT
  event_date,
  event_type,
  count() AS cnt,
  uniq(user_id) AS uv
FROM mydb.events
GROUP BY event_date, event_type;
```

---

## vs BigQuery

| 比較項目 | ClickHouse | BigQuery |
| -------- | ---------- | -------------- |
| デプロイ | セルフホスト/クラウド | フルマネージド |
| コスト | 固定費 | クエリ量課金 |
| レイテンシ | ミリ秒レベル | 秒レベル |
| リアルタイム書き込み | 対応 | ストリーミング挿入に遅延あり |
| 運用 | 運用が必要 | 運用不要 |
