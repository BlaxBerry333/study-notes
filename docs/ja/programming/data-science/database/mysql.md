# MySQL

最も広く使われているオープンソースのリレーショナルデータベース

::: warning 特徴:

- 広く普及し、エコシステムが成熟
- 複数のストレージエンジン（InnoDB、MyISAM）
- リードレプリカ、マスタースレーブ構成
- クラウドサービスとの親和性が高い（AWS RDS、Cloud SQL）
:::

---

## よく使うコマンド

::: code-group

```bash [接続]
# ローカル接続
mysql -u root -p

# リモート接続
mysql -h host -P 3306 -u user -p
```

```sql [データベース操作]
-- データベース一覧の表示
SHOW DATABASES;

-- データベースの作成
CREATE DATABASE mydb CHARACTER SET utf8mb4;

-- データベースの使用
USE mydb;

-- データベースの削除
DROP DATABASE mydb;
```

```sql [テーブル操作]
-- テーブル一覧の表示
SHOW TABLES;

-- テーブル構造の表示
DESCRIBE table_name;

-- テーブルの作成
CREATE TABLE users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  email VARCHAR(255) UNIQUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;
```

:::

---

## ストレージエンジン

| エンジン | 特徴 | 適用シーン |
| ------ | -------------------- | ------------------ |
| InnoDB | トランザクション対応、行ロック、外部キー | 大半のケース（デフォルト） |
| MyISAM | テーブルロック、全文検索インデックス | 読み取り専用/読み多め・書き少なめ |
| Memory | メモリ上に格納、高速 | 一時テーブル、キャッシュ |

---

## インデックスの最適化

```sql
-- インデックスの確認
SHOW INDEX FROM users;

-- インデックスの作成
CREATE INDEX idx_email ON users(email);

-- 複合インデックス（最左プレフィックスルール）
CREATE INDEX idx_name_email ON users(name, email);

-- 実行計画の確認
EXPLAIN SELECT * FROM users WHERE email = 'test@example.com';
```

::: tip インデックスの原則

- 選択性の高いカラムを優先
- 複合インデックスは最左プレフィックスに従う
- インデックスカラムに関数を使わない
:::
