# BigQuery

Google Cloud 的无服务器数据仓库

::: warning 特点:

- 无服务器、按需扩展
- 列式存储、PB 级数据分析
- 标准 SQL 支持
- 与 GCP 生态深度集成
:::

---

## 基本操作

::: code-group

```sql [查询]
-- 基本查询
SELECT *
FROM `project.dataset.table`
WHERE date >= '2024-01-01'
LIMIT 1000;

-- 聚合
SELECT
  country,
  COUNT(*) as user_count,
  SUM(revenue) as total_revenue
FROM `project.dataset.orders`
GROUP BY country
ORDER BY total_revenue DESC;
```

```sql [表操作]
-- 创建数据集
CREATE SCHEMA `project.my_dataset`;

-- 创建表
CREATE TABLE `project.dataset.users` (
  id INT64,
  name STRING,
  email STRING,
  created_at TIMESTAMP
);

-- 从查询创建表
CREATE TABLE `project.dataset.daily_summary` AS
SELECT date, COUNT(*) as count
FROM `project.dataset.events`
GROUP BY date;
```

```sql [分区表]
-- 创建分区表（按日期）
CREATE TABLE `project.dataset.events`
(
  event_id STRING,
  event_type STRING,
  event_time TIMESTAMP,
  user_id STRING
)
PARTITION BY DATE(event_time);

-- 查询分区表（自动剪枝）
SELECT *
FROM `project.dataset.events`
WHERE DATE(event_time) = '2024-01-15';
```

:::

---

## 常用函数

### 日期时间

```sql
-- 当前时间
CURRENT_TIMESTAMP()
CURRENT_DATE()

-- 日期提取
EXTRACT(YEAR FROM timestamp_col)
DATE_TRUNC(date_col, MONTH)

-- 日期计算
DATE_ADD(date_col, INTERVAL 7 DAY)
DATE_DIFF(date1, date2, DAY)
```

---

### 字符串

```sql
-- 拼接
CONCAT(first_name, ' ', last_name)

-- 正则
REGEXP_EXTRACT(url, r'/product/(\d+)')
REGEXP_CONTAINS(email, r'@gmail\.com$')
```

---

### 数组

```sql
-- 数组操作
ARRAY_AGG(item)
ARRAY_LENGTH(arr)
UNNEST(array_col)

-- 示例：展开数组
SELECT user_id, tag
FROM `dataset.users`, UNNEST(tags) as tag;
```

---

## 窗口函数

```sql
SELECT
  user_id,
  order_date,
  amount,
  -- 排名
  ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY order_date) as order_num,
  -- 累计
  SUM(amount) OVER (PARTITION BY user_id ORDER BY order_date) as cumulative_amount,
  -- 前一条
  LAG(amount) OVER (PARTITION BY user_id ORDER BY order_date) as prev_amount
FROM `dataset.orders`;
```

---

## 成本优化

::: tip 最佳实践

- **只查需要的列**：避免 `SELECT *`
- **使用分区表**：按日期/时间分区
- **使用聚簇表**：常用筛选字段聚簇
- **预览数据**：用 LIMIT 或预览功能
- **缓存结果**：相同查询 24 小时内免费
:::

```sql
-- 查看查询扫描量（dry run）
-- 在 Console 中勾选 "Estimate" 或使用 --dry_run

-- 查看表大小
SELECT
  table_name,
  ROUND(size_bytes / POW(10,9), 2) as size_gb
FROM `project.dataset.INFORMATION_SCHEMA.TABLE_STORAGE`;
```
