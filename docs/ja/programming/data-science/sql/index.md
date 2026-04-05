# SQL 基礎

## クエリ

> SELECT ... FROM ...

```sql
-- 1つのカラムを取得
SELECT column_name FROM table_name;

-- 複数のカラムを取得
SELECT column_name_1, column_name_2 FROM table_name;

-- すべてのカラムを取得
SELECT * FROM table_name;
```

---

### フィルタ条件

> WHERE ...

```sql
SELECT column_name
FROM table_name
WHERE condition;

-- すべての条件を同時に満たす
SELECT column_name
FROM table_name
WHERE condition_1
  AND condition_2;

-- いずれかの条件を満たせばよい
SELECT column_name
FROM table_name
WHERE condition_1
   OR condition_2;
```

::: details 例

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

### ソート

> ORDER BY ...

```sql
-- 1つのカラムでソート
SELECT * FROM table_name ORDER BY column_name;

-- 複数のカラムでソート（優先順位あり）
SELECT * FROM table_name ORDER BY column_name1, column_name2;

-- 昇順（デフォルト）
SELECT * FROM table_name ORDER BY column_name ASC;

-- 降順
SELECT * FROM table_name ORDER BY column_name DESC;
```

::: details 例

```sql
SELECT * FROM products ORDER BY price DESC;

SELECT name, price FROM products ORDER BY price DESC;
```
:::

---

### 行数の制限

> LIMIT ...

```sql
SELECT column_name FROM table_name LIMIT number;

SELECT * FROM table_name WHERE condition LIMIT number;
```

::: details 例

```sql
-- B クラスのスコア上位3名を取得
SELECT *
FROM students
WHERE class = 'B'
ORDER BY score DESC
LIMIT 3;
```
:::

---

### 集約関数

カラムのデータに対して計算処理を行う

```sql
SELECT aggregate_function(column_name)
FROM table_name
WHERE condition;
```

| 関数 | 説明 |
|------|------|
| `MIN(col)` | 最小値 |
| `MAX(col)` | 最大値 |
| `SUM(col)` | 合計 |
| `COUNT(col)` | 行数 |
| `AVG(col)` | 平均値 |

::: details 例

```sql
SELECT MIN(age) FROM students WHERE class = '6-A';

SELECT AVG(price) FROM products;
```
:::

---

### グルーピング

> GROUP BY ...

特定のカラムでデータをグループ化する（例：男女別にクラスの平均値を取得する）

```sql
SELECT column_name, aggregate_function(column_name)
FROM table_name
GROUP BY column_name;

-- 通常、クエリ結果はグループ化カラムに基づいて表示するため、SELECT で明示する
```

::: details 例

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

### グループ集約値のフィルタリング

> HAVING ...

グループの集約値をフィルタリングしてサブセットを取得するために使用する。必ず GROUP BY と組み合わせて使う

WHERE ではGROUP BY の集約関数の結果をフィルタリングできないため、HAVING を使う

```sql
SELECT column_name, aggregate_function(column_name)
FROM table_name
GROUP BY column_name
HAVING condition;
```

::: details 例

```sql
SELECT customer_id, SUM(total)
FROM orders
GROUP BY customer_id
HAVING SUM(total) > 5000;

-- 顧客数が 1000 を超える国をフィルタリング
SELECT country, COUNT(customer_id)
FROM customers
GROUP BY country
HAVING COUNT(customer_id) > 1000;
```
:::

---

### テーブル結合

> JOIN ...

すべてのデータを1つのテーブルに格納するとスペースを消費し、クエリ時のパフォーマンスも低下するため、テーブルを分割して結合するのが適切である

| 結合方式 | 説明 |
|----------|------|
| `INNER JOIN` | 積集合。左右テーブルの共通部分 |
| `LEFT JOIN` | 左テーブルを全保持。右テーブルにマッチしない行は NULL |
| `RIGHT JOIN` | 右テーブルを全保持。左テーブルにマッチしない行は NULL |
| `FULL OUTER JOIN` | 和集合。マッチしない行は NULL |

```sql
-- 結合後のすべてのカラムを取得
SELECT *
FROM table1
JOIN table2 ON table1.column = table2.column;

-- 結合後の指定カラムを取得
SELECT table1.column, table2.column
FROM table1
JOIN table2 ON table1.column = table2.column;
```

::: details 例

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

-- 多テーブル結合
SELECT orders.id, customers.name, products.name
FROM orders
JOIN customers ON orders.customer_id = customers.id
JOIN order_items ON orders.id = order_items.order_id
JOIN products ON order_items.product_id = products.id;
```
:::

---

## 挿入

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

## 削除

> DELETE FROM ...

```sql
-- 条件に合致するデータを削除
DELETE FROM table_name WHERE condition;

-- テーブル内の全データを削除
DELETE FROM table_name;
```

---

## 条件式

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
