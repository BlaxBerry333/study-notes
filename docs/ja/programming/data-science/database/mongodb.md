# MongoDB

最も広く使われているドキュメント型 NoSQL データベース

::: warning 特徴:

- ドキュメントモデル（BSON/JSON）
- 柔軟な Schema、事前定義不要
- 水平スケーリング（シャーディング）
- 豊富なクエリ構文
:::

---

## コア概念

| SQL 用語 | MongoDB 用語 |
| -------- | ------------ |
| Database | Database     |
| Table    | Collection   |
| Row      | Document     |
| Column   | Field        |
| Index    | Index        |

---

## よく使う操作

::: code-group

```javascript [接続]
// mongosh で接続
mongosh "mongodb://localhost:27017"

// データベースの使用
use mydb

// コレクション一覧の表示
show collections
```

```javascript [CRUD]
// 挿入
db.users.insertOne({
  name: "Alice",
  email: "alice@example.com",
  tags: ["admin", "active"],
});

// 検索
db.users.find({ name: "Alice" });
db.users.findOne({ email: "alice@example.com" });

// 更新
db.users.updateOne({ name: "Alice" }, { $set: { age: 25 } });

// 削除
db.users.deleteOne({ name: "Alice" });
```

```javascript [クエリ演算子]
// 比較
db.users.find({ age: { $gt: 18 } });
db.users.find({ age: { $in: [18, 25, 30] } });

// 論理演算
db.users.find({
  $and: [{ age: { $gte: 18 } }, { status: "active" }],
});

// 配列
db.users.find({ tags: "admin" });
db.users.find({ tags: { $all: ["admin", "active"] } });
```

:::

---

## 集約パイプライン

```javascript
db.orders.aggregate([
  // フィルタリング
  { $match: { status: "completed" } },

  // グルーピング
  {
    $group: {
      _id: "$customer_id",
      total: { $sum: "$amount" },
      count: { $sum: 1 },
    },
  },

  // ソート
  { $sort: { total: -1 } },

  // 件数制限
  { $limit: 10 },
]);
```

---

## インデックス

```javascript
// 単一フィールドインデックス
db.users.createIndex({ email: 1 });

// 複合インデックス
db.users.createIndex({ name: 1, age: -1 });

// ユニークインデックス
db.users.createIndex({ email: 1 }, { unique: true });

// インデックス一覧の表示
db.users.getIndexes();
```
