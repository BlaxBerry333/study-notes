# PostgreSQL

> 功能最强大的开源关系型数据库

## 特点

- ACID 完全支持
- 丰富的数据类型（JSON、数组、范围等）
- 强大的扩展性（插件系统）
- 高级索引（B-tree、GIN、GiST）

---

## 常用命令

::: code-group

```bash [连接]
# 本地连接
psql -U postgres -d mydb

# 远程连接
psql -h host -p 5432 -U user -d mydb
```

```sql [数据库操作]
-- 创建数据库
CREATE DATABASE mydb;

-- 查看数据库列表
\l

-- 切换数据库
\c mydb

-- 删除数据库
DROP DATABASE mydb;
```

```sql [表操作]
-- 查看表列表
\dt

-- 查看表结构
\d table_name

-- 创建表
CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  email VARCHAR(255) UNIQUE,
  created_at TIMESTAMP DEFAULT NOW()
);
```

:::

---

## JSON 支持

PostgreSQL 对 JSON 有原生支持：

```sql
-- 创建 JSON 字段
CREATE TABLE events (
  id SERIAL PRIMARY KEY,
  data JSONB NOT NULL
);

-- 插入 JSON 数据
INSERT INTO events (data)
VALUES ('{"type": "click", "page": "/home"}');

-- 查询 JSON 字段
SELECT data->>'type' FROM events;

-- JSON 条件查询
SELECT * FROM events
WHERE data @> '{"type": "click"}';
```

---

## 索引

```sql
-- B-tree 索引（默认）
CREATE INDEX idx_users_email ON users(email);

-- GIN 索引（全文搜索、JSON）
CREATE INDEX idx_events_data ON events USING GIN(data);

-- 部分索引
CREATE INDEX idx_active_users ON users(email)
WHERE active = true;
```
