# Redis

高性能なインメモリ Key-Value データベース

::: warning 特徴:

- メモリ上に格納、超高速な読み書き
- 豊富なデータ構造
- 永続化対応（RDB、AOF）
- Pub/Sub、Lua スクリプト
:::

---

## データ型

| 型 | 説明 | よくある用途 |
| ---------- | ----------- | ------------------ |
| String | 文字列/数値 | キャッシュ、カウンター |
| Hash | ハッシュテーブル | オブジェクトの格納 |
| List | 双方向リンクリスト | メッセージキュー、最新一覧 |
| Set | 順序なし集合 | タグ、重複排除 |
| Sorted Set | 順序付き集合 | ランキング、遅延キュー |

---

## よく使うコマンド

::: code-group

```bash [String]
# 設定/取得
SET key "value"
GET key

# 有効期限の設定
SET key "value" EX 3600  # 1時間

# カウンター
INCR counter
INCRBY counter 10
```

```bash [Hash]
# フィールドの設定
HSET user:1 name "Alice" age 25

# フィールドの取得
HGET user:1 name
HGETALL user:1

# 一括設定
HMSET user:1 name "Alice" email "alice@example.com"
```

```bash [List]
# 左/右からプッシュ
LPUSH queue "task1"
RPUSH queue "task2"

# 左/右からポップ
LPOP queue
RPOP queue

# 範囲取得
LRANGE queue 0 -1
```

```bash [Set / Sorted Set]
# Set
SADD tags "redis" "database"
SMEMBERS tags
SISMEMBER tags "redis"

# Sorted Set
ZADD leaderboard 100 "player1" 200 "player2"
ZRANGE leaderboard 0 -1 WITHSCORES
ZREVRANGE leaderboard 0 9  # Top 10
```

:::

---

## よくある活用シーン

### キャッシュ

```bash
# データをキャッシュし、有効期限を設定
SET cache:user:1 "{...}" EX 600

# 取得。存在しない場合は nil を返す
GET cache:user:1
```

---

### 分散ロック

```bash
# ロックの取得（NX: 存在しない場合のみ設定、EX: 有効期限）
SET lock:order:123 "holder" NX EX 30

# ロックの解放（Lua スクリプトでアトミック性を保証）
# if redis.call("get", KEYS[1]) == ARGV[1] then
#   return redis.call("del", KEYS[1])
# end
```

---

### レートリミット

```bash
# スライディングウィンドウによるレートリミット
INCR rate:api:user1
EXPIRE rate:api:user1 60
```

---

## 永続化

| 方式 | 特徴 | 適用シーン |
| ---- | ---------------------- | ------------ |
| RDB | スナップショット、ファイルが小さい、復元が速い | バックアップ、災害復旧 |
| AOF | ログ方式、データ安全性が高い、ファイルが大きい | データ損失を許容できない場合 |
| 混合 | RDB + AOF | 本番環境での推奨 |
