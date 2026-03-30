# MongoDB

最流行的文档型 NoSQL 数据库

::: warning 特点:

- 文档模型（BSON/JSON）
- 灵活 Schema、无需预定义
- 水平扩展（分片）
- 丰富的查询语法
:::

---

## 核心概念

| SQL 术语 | MongoDB 术语 |
| -------- | ------------ |
| Database | Database     |
| Table    | Collection   |
| Row      | Document     |
| Column   | Field        |
| Index    | Index        |

---

## 常用操作

::: code-group

```javascript [连接]
// mongosh 连接
mongosh "mongodb://localhost:27017"

// 使用数据库
use mydb

// 查看集合
show collections
```

```javascript [CRUD]
// 插入
db.users.insertOne({
  name: "Alice",
  email: "alice@example.com",
  tags: ["admin", "active"],
});

// 查询
db.users.find({ name: "Alice" });
db.users.findOne({ email: "alice@example.com" });

// 更新
db.users.updateOne({ name: "Alice" }, { $set: { age: 25 } });

// 删除
db.users.deleteOne({ name: "Alice" });
```

```javascript [查询操作符]
// 比较
db.users.find({ age: { $gt: 18 } });
db.users.find({ age: { $in: [18, 25, 30] } });

// 逻辑
db.users.find({
  $and: [{ age: { $gte: 18 } }, { status: "active" }],
});

// 数组
db.users.find({ tags: "admin" });
db.users.find({ tags: { $all: ["admin", "active"] } });
```

:::

---

## 聚合管道

```javascript
db.orders.aggregate([
  // 筛选
  { $match: { status: "completed" } },

  // 分组
  {
    $group: {
      _id: "$customer_id",
      total: { $sum: "$amount" },
      count: { $sum: 1 },
    },
  },

  // 排序
  { $sort: { total: -1 } },

  // 限制
  { $limit: 10 },
]);
```

---

## 索引

```javascript
// 单字段索引
db.users.createIndex({ email: 1 });

// 复合索引
db.users.createIndex({ name: 1, age: -1 });

// 唯一索引
db.users.createIndex({ email: 1 }, { unique: true });

// 查看索引
db.users.getIndexes();
```
