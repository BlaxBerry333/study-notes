# PostgreSQL

最も高機能なオープンソースのリレーショナルデータベース

::: warning 特徴:

- ACID 完全対応
- 豊富なデータ型（JSON、配列、範囲型など）
- 高い拡張性（プラグインシステム）
- 高度なインデックス（B-tree、GIN、GiST）
:::

---

## よく使うコマンド

::: code-group

```bash [接続]
# ローカル接続
psql -U postgres -d mydb

# リモート接続
psql -h host -p 5432 -U user -d mydb
```

```sql [データベース操作]
-- データベースの作成
CREATE DATABASE mydb;

-- データベース一覧の表示
\l

-- データベースの切り替え
\c mydb

-- データベースの削除
DROP DATABASE mydb;
```

```sql [テーブル操作]
-- テーブル一覧の表示
\dt

-- テーブル構造の表示
\d table_name

-- テーブルの作成
CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  email VARCHAR(255) UNIQUE,
  created_at TIMESTAMP DEFAULT NOW()
);
```

:::

---

## JSON サポート

PostgreSQL は JSON をネイティブにサポートしている：

```sql
-- JSON カラムの作成
CREATE TABLE events (
  id SERIAL PRIMARY KEY,
  data JSONB NOT NULL
);

-- JSON データの挿入
INSERT INTO events (data)
VALUES ('{"type": "click", "page": "/home"}');

-- JSON カラムのクエリ
SELECT data->>'type' FROM events;

-- JSON 条件クエリ
SELECT * FROM events
WHERE data @> '{"type": "click"}';
```

---

## インデックス

```sql
-- B-tree インデックス（デフォルト）
CREATE INDEX idx_users_email ON users(email);

-- GIN インデックス（全文検索、JSON 向け）
CREATE INDEX idx_events_data ON events USING GIN(data);

-- 部分インデックス
CREATE INDEX idx_active_users ON users(email)
WHERE active = true;
```
