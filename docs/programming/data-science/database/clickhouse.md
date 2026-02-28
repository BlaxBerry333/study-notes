# ClickHouse

> 开源列式 OLAP 数据库，极致查询性能

## 特点

- 列式存储、高压缩率
- 向量化执行引擎
- 实时数据写入
- 分布式架构

---

## 基本操作

::: code-group

```sql [数据库/表]
-- 创建数据库
CREATE DATABASE mydb;

-- 创建表（MergeTree 引擎）
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

-- 查看表结构
DESCRIBE TABLE mydb.events;
```

```sql [插入数据]
-- 单条插入
INSERT INTO mydb.events VALUES
  ('2024-01-15', '2024-01-15 10:30:00', 1001, 'click', '{}');

-- 批量插入
INSERT INTO mydb.events VALUES
  ('2024-01-15', '2024-01-15 10:30:00', 1001, 'click', '{}'),
  ('2024-01-15', '2024-01-15 10:31:00', 1002, 'view', '{}');
```

```sql [查询]
-- 基本查询
SELECT *
FROM mydb.events
WHERE event_date = '2024-01-15'
LIMIT 100;

-- 聚合查询
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

## 表引擎

| 引擎 | 特点 | 适用场景 |
|------|------|----------|
| MergeTree | 主力引擎、支持索引 | 大部分分析场景 |
| ReplacingMergeTree | 去重合并 | 需要更新的数据 |
| SummingMergeTree | 预聚合 | 指标汇总 |
| AggregatingMergeTree | 增量聚合 | 复杂预聚合 |
| Distributed | 分布式查询 | 集群部署 |

---

## 常用函数

```sql
-- 日期时间
toDate(timestamp)
toYYYYMM(date)
toStartOfHour(datetime)
dateDiff('day', date1, date2)

-- 聚合
count()
sum(col)
avg(col)
uniq(col)        -- 近似去重
uniqExact(col)   -- 精确去重

-- 数组
arrayJoin(arr)   -- 展开数组
groupArray(col)  -- 聚合为数组
```

---

## 性能优化

::: tip 最佳实践
- **合理设计 ORDER BY**：常用查询条件放前面
- **使用分区**：按日期分区，查询时指定日期范围
- **批量写入**：避免频繁小批量插入
- **使用物化视图**：预计算常用聚合
:::

```sql
-- 物化视图（预聚合）
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

| 对比 | ClickHouse | BigQuery |
|------|------------|----------|
| 部署 | 自托管/云 | 全托管 |
| 成本 | 固定成本 | 按查询量计费 |
| 延迟 | 毫秒级 | 秒级 |
| 实时写入 | 支持 | 流式插入有延迟 |
| 运维 | 需要运维 | 无需运维 |
