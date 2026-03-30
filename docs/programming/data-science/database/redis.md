# Redis

高性能内存键值数据库

::: warning 特点:

- 内存存储、极速读写
- 丰富的数据结构
- 持久化支持（RDB、AOF）
- 发布订阅、Lua 脚本
:::

---

## 数据类型

| 类型       | 说明        | 常用场景           |
| ---------- | ----------- | ------------------ |
| String     | 字符串/数字 | 缓存、计数器       |
| Hash       | 哈希表      | 对象存储           |
| List       | 双向链表    | 消息队列、最新列表 |
| Set        | 无序集合    | 标签、去重         |
| Sorted Set | 有序集合    | 排行榜、延时队列   |

---

## 常用命令

::: code-group

```bash [String]
# 设置/获取
SET key "value"
GET key

# 设置过期时间
SET key "value" EX 3600  # 1小时

# 计数器
INCR counter
INCRBY counter 10
```

```bash [Hash]
# 设置字段
HSET user:1 name "Alice" age 25

# 获取字段
HGET user:1 name
HGETALL user:1

# 批量设置
HMSET user:1 name "Alice" email "alice@example.com"
```

```bash [List]
# 左/右推入
LPUSH queue "task1"
RPUSH queue "task2"

# 左/右弹出
LPOP queue
RPOP queue

# 获取范围
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

## 常见应用场景

### 缓存

```bash
# 缓存数据，设置过期
SET cache:user:1 "{...}" EX 600

# 获取，不存在返回 nil
GET cache:user:1
```

---

### 分布式锁

```bash
# 获取锁（NX: 不存在才设置，EX: 过期时间）
SET lock:order:123 "holder" NX EX 30

# 释放锁（Lua 脚本保证原子性）
# if redis.call("get", KEYS[1]) == ARGV[1] then
#   return redis.call("del", KEYS[1])
# end
```

---

### 限流

```bash
# 滑动窗口限流
INCR rate:api:user1
EXPIRE rate:api:user1 60
```

---

## 持久化

| 方式 | 特点                   | 适用场景     |
| ---- | ---------------------- | ------------ |
| RDB  | 快照、文件小、恢复快   | 备份、容灾   |
| AOF  | 日志、数据安全、文件大 | 数据不能丢失 |
| 混合 | RDB + AOF              | 推荐生产环境 |
