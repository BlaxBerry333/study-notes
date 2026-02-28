# MySQL

> 最流行的开源关系型数据库

## 特点

- 使用广泛、生态成熟
- 多种存储引擎（InnoDB、MyISAM）
- 读写分离、主从复制
- 云服务支持好（AWS RDS、Cloud SQL）

---

## 常用命令

::: code-group

```bash [连接]
# 本地连接
mysql -u root -p

# 远程连接
mysql -h host -P 3306 -u user -p
```

```sql [数据库操作]
-- 查看数据库列表
SHOW DATABASES;

-- 创建数据库
CREATE DATABASE mydb CHARACTER SET utf8mb4;

-- 使用数据库
USE mydb;

-- 删除数据库
DROP DATABASE mydb;
```

```sql [表操作]
-- 查看表列表
SHOW TABLES;

-- 查看表结构
DESCRIBE table_name;

-- 创建表
CREATE TABLE users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  email VARCHAR(255) UNIQUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;
```

:::

---

## 存储引擎

| 引擎 | 特点 | 适用场景 |
|------|------|----------|
| InnoDB | 事务支持、行锁、外键 | 大多数场景（默认） |
| MyISAM | 表锁、全文索引 | 只读/读多写少 |
| Memory | 内存存储、速度快 | 临时表、缓存 |

---

## 索引优化

```sql
-- 查看索引
SHOW INDEX FROM users;

-- 创建索引
CREATE INDEX idx_email ON users(email);

-- 联合索引（最左前缀原则）
CREATE INDEX idx_name_email ON users(name, email);

-- 查看执行计划
EXPLAIN SELECT * FROM users WHERE email = 'test@example.com';
```

::: tip 索引原则
- 选择性高的列优先
- 联合索引遵循最左前缀
- 避免在索引列上使用函数
:::
