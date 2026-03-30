# SQL 基础

## 查询

> SELECT ... FROM ...

```sql
-- 查询一个字段
SELECT column_name FROM table_name;

-- 查询多个字段
SELECT column_name_1, column_name_2 FROM table_name;

-- 查询所有字段
SELECT * FROM table_name;
```

---

### 筛选条件

> WHERE ...

```sql
SELECT column_name
FROM table_name
WHERE condition;

-- 必须同时满足条件
SELECT column_name
FROM table_name
WHERE condition_1
  AND condition_2;

-- 只需满足任意一个条件
SELECT column_name
FROM table_name
WHERE condition_1
   OR condition_2;
```

::: details 例子

```sql
SELECT * FROM students WHERE height > 180;

SELECT *
FROM students
WHERE height > 180
  AND gender = 'male';

SELECT *
FROM students
WHERE height > 180
   OR gender = 'male';
```
:::

---

### 排序

> ORDER BY ...

```sql
-- 基于一个字段
SELECT * FROM table_name ORDER BY column_name;

-- 基于多个字段（前后顺序）
SELECT * FROM table_name ORDER BY column_name1, column_name2;

-- 升序（默认）
SELECT * FROM table_name ORDER BY column_name ASC;

-- 降序
SELECT * FROM table_name ORDER BY column_name DESC;
```

::: details 例子

```sql
SELECT * FROM products ORDER BY price DESC;

SELECT name, price FROM products ORDER BY price DESC;
```
:::

---

### 限制行数

> LIMIT ...

```sql
SELECT column_name FROM table_name LIMIT number;

SELECT * FROM table_name WHERE condition LIMIT number;
```

::: details 例子

```sql
-- 查询 B 班分数排名前三的学生
SELECT *
FROM students
WHERE class = 'B'
ORDER BY score DESC
LIMIT 3;
```
:::

---

### 聚合函数

用于对字段的那一列数据进行处理

```sql
SELECT aggregate_function(column_name)
FROM table_name
WHERE condition;
```

| 函数 | 说明 |
|------|------|
| `MIN(col)` | 最小值 |
| `MAX(col)` | 最大值 |
| `SUM(col)` | 求和 |
| `COUNT(col)` | 行数 |
| `AVG(col)` | 平均值 |

::: details 例子

```sql
SELECT MIN(age) FROM students WHERE class = '6-A';

SELECT AVG(price) FROM products;
```
:::

---

### 分组

> GROUP BY ...

用于基于某个字段把数据分组（比如：按男女分组查询班级学生的平均值）

```sql
SELECT column_name, aggregate_function(column_name)
FROM table_name
GROUP BY column_name;

-- 一般来说查询的结果是要根据分组的字段展示，所以应该在 SELECT 中指明
```

::: details 例子

```sql
SELECT gender, MIN(score)
FROM students
GROUP BY gender;

SELECT owner_id, AVG(price)
FROM products
GROUP BY owner_id;
```
:::

---

### 筛选分组聚合值

> HAVING ...

用于对分组的聚合值进行筛选实现求子集，因此必须同 GROUP BY 一起用

WHERE 不能对 GROUP BY 的聚合函数结果进行筛选，只能用 HAVING

```sql
SELECT column_name, aggregate_function(column_name)
FROM table_name
GROUP BY column_name
HAVING condition;
```

::: details 例子

```sql
SELECT customer_id, SUM(total)
FROM orders
GROUP BY customer_id
HAVING SUM(total) > 5000;

-- 筛选出顾客数 > 1000 的国家
SELECT country, COUNT(customer_id)
FROM customers
GROUP BY country
HAVING COUNT(customer_id) > 1000;
```
:::

---

### 表关联

> JOIN ...

所有数据都放在一个表会占空间且每次查询表时也很消耗性能，所以科学的做法应该是拆分表并进行关联

| 关联方式 | 说明 |
|----------|------|
| `INNER JOIN` | 取交集，左右表公共部分 |
| `LEFT JOIN` | 左表全保留，右表匹配不上为 NULL |
| `RIGHT JOIN` | 右表全保留，左表匹配不上为 NULL |
| `FULL OUTER JOIN` | 取并集，匹配不上为 NULL |

```sql
-- 查询关联后的所有字段
SELECT *
FROM table1
JOIN table2 ON table1.column = table2.column;

-- 查询关联后的指定字段
SELECT table1.column, table2.column
FROM table1
JOIN table2 ON table1.column = table2.column;
```

::: details 例子

```sql
SELECT *
FROM orders
LEFT JOIN products ON orders.product_id = products.id;

SELECT *
FROM orders
RIGHT JOIN products ON orders.product_id = products.id;

SELECT t1.column, t2.column
FROM table1 t1
FULL OUTER JOIN table2 t2 ON t1.id = t2.id;

-- 多表关联
SELECT orders.id, customers.name, products.name
FROM orders
JOIN customers ON orders.customer_id = customers.id
JOIN order_items ON orders.id = order_items.order_id
JOIN products ON order_items.product_id = products.id;
```
:::

---

## 插入

> INSERT INTO ...

```sql
INSERT INTO table_name (column1, column2)
VALUES (value1, value2);
```

---

## 更新

> UPDATE ... SET ...

```sql
UPDATE table_name
SET column_name = value;

UPDATE table_name
SET column1 = value1,
    column2 = value2
WHERE condition;
```

---

## 删除

> DELETE FROM ...

```sql
-- 删除满足条件的数据
DELETE FROM table_name WHERE condition;

-- 删除表中所有数据
DELETE FROM table_name;
```

---

## 条件表达式

### IF

```sql
IF(condition, value_if_true, value_if_false)
```

---

### CASE WHEN

```sql
CASE
  WHEN condition1 THEN value1
  WHEN condition2 THEN value2
  ELSE default_value
END
```
