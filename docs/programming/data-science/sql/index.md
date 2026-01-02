# SQL

## 基础语法

### 查询

> SELECT ... FROM ...

```sql
-- 查询一个字段
SELECT <column_name> FROM <table_name>;

-- 查询所有的选择的字段
SELECT <column_name_1>, <column_name_2> FROM <table_name>;

-- 查询所有字段
SELECT * FROM <table_name>;
```

---

### 筛选条件

> WHERE ...

```sql
SELECT <column_name>
FROM <table_name>
WHERE <condition>

-- 必须同时满条件
SELECT <column_name>
FROM <table_name>
WHERE <condition_1>
AND <condition_1>;

-- 只需满足任意一个条件
SELECT <column_name>
FROM <table_name>
WHERE <condition_1>
OR <condition_1>;
```

> 例子
>
> ```sql
> SELECT * FROM students
> WHERE height > 180;
>
> SELECT * FROM students
> WHERE height > 180
> AND gender = 'male';
>
> SELECT * FROM students
> WHERE height > 180
> OR gender = 'male';
> ```

---

### 排序

> ORDER BY ...

```sql
-- 基于一个字段
SELECT * FROM <table_name>
ORDER BY <column_name>;

-- 基于多个个字段（前后顺序）
SELECT * FROM <table_name>
ORDER BY <column_name1>, <column_name2>;

-- 升序（默认）
SELECT * FROM <table_name>
ORDER BY <column_name>
ASC;

-- 降序
SELECT * FROM <table_name>
ORDER BY <column_name>
DESC;

```

> 例子
>
> ```sql
> SELECT * FROM products
> ORDER BY price
> DESC;
>
> SELECT name, price
> FROM products
> ORDER BY price
> DESC;
> ```

---

### 限制行数

> LIMIT ...

```sql
SELECT <column_name>
FROM <table_name>
LIMIT <number>;

SELECT * FROM <table_name>
WHERE <condition>
LIMIT <number>;
```

> 例子：
>
> ```sql
> -- 查询 B 班分数排名前三的学生
> SELECT * FROM students WHERE class = "B" ORDER BY score DESC LIMIT 3;
> ```

---

### 聚合函数

用于对字段的那一列数据进行处理

```sql
SELECT <聚合函数(<column_name>)>
FROM <table_name>
WHERE <condition>;

-- 获取该列的最小值：MIN(<column_name>)
-- 获取该列的最大值：MAX(<column_name>)
-- 获取该列的和：SUM(<column_name>)
-- 获取该列的行数：COUNT(<column_name>)
-- 获取该列的平均值：AVG(<column_name>)
```

> 例子
>
> ```sql
> SELECT MIN(age) FROM students WHERE class = '6-A';
>
> SELECT AVA(price) FROM products;
> ```

---

### 分组

> GROUP BY ...

用于基于某个字段把数据分组（比如：按男女分组查询班级学生的平均值）

```sql
SELECT <column_name>, <聚合函数(<column_name>)>
FROM <table_name>
GROUP BY <column_name>;

--一般来说查询的结果是要根据分组的字段展示，所以应该在 SELECT 中指明
```

> 例子：
>
> ```sql
> SELECT gender, MIN(score)
> FROM students
> GROUP BY gender;
>
> SELECT owner_id, AVG(price)
> FROM products
> GROUP BY owner_id;
> ```

---

### 筛选分组聚合值

> HAVING ...

用于对分组的聚合值进行筛选实现求子集，因此必须同 GROUP BY 一起用

WHERE 不能对 GROUP BY 的聚合函数结果进行筛选，只能用 HAVING

```sql
SELECT <column_name>, <聚合函数>
FROM <table_name>
GROUP BY <column_name>;
HAVING <condition>
```

> 例子：
>
> ```sql
> SELECT customer_id, SUM(total)
> FROM orders
> GROUP BY customer_id
> HAVING SUM(total) > 5000;
>
>
> -- 筛选出顾客数 > 1000 的国家
> SELECT country, COUNT(custom_id)
> FROM customers
> GROUP BY country
> HAVING COUNT(custom_id) > 1000;
>
> ```

---

### 表关联

> JOIN ...

所有数据都放在一个表会占空间且每次查询表时也很消耗性能，所以科学的做法应该是拆分表并进行关联

| 4 种关联方式          | 说明                                                              |
| --------------------- | ----------------------------------------------------------------- |
| `INNER JOIN` ( 默认 ) | （取中间交集）左侧表与右侧表的公共部分保留                        |
| `LEFT JOIN`           | 左侧表全部保留，右侧表数据要是对不上则赋值为空值 NULL             |
| `RIGHT JOIN`          | 右侧表全部保留，左侧表数据要是对不上则赋值为空值 NULL             |
| `FULL OUTER JOIN`     | （取全部并集）左侧表与在侧表的全部都保留，对不上则赋值为空值 NULL |

```sql
-- 查询关联后的所有字段
SELECT * FROM <table_name_1>
<JOIN 方式> <table_name_2>
ON <table_name_1.column_name> = <table_name_2.column_name>;

-- 查询关联后的多个字段
SELECT <table_name_1>.<column_name>, <table_name_2>.<column_name>
FROM <table_name_1>
<JOIN 方式> <table_name_2>
ON <table_name_1>.<column_name> = <table_name_2>.<column_name>;
```

> 例子：
>
> ```sql
> SELECT * FROM custom_orders
> LEFT JOIN products ON custom_orders.product_id = products.id;
>
> SELECT * FROM custom_orders
> RIGHT JOIN products ON custom_orders.product_id = products.id;
>
> SELECT table1.column, table2.column
> FROM table1
> FULL OUTER JOIN table2 ON table1.id = table2.id;
>
> SELECT custom_orders.id, customers.name, products.name      -- 显示关联后的表的指定字段
> FROM custom_orders
> JOIN customers ON custom_orders.customer_id = customers.id  -- 连接到用户信息的表
> JOIN order_items ON custom_orders.id = order_items.order_id -- 连接所有明细的表
> JOIN products ON order_items.product_id = products.id;      -- 通过明细表连接产品的表
> ```

---

## 窗口函数

> window function

聚合函数( 聚合函数都窗口函数)

特殊函数：

- ROW_NUMBER：行数
- RANK：排序
- DENSE_RANK：乱序排序
- LAG：前面一行的数据
- LEAD：后面一行的数据
