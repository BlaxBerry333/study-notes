# Subscription

Subscription 是 GraphQL 的第三种根操作类型（Query 读、Mutation 写、Subscription 订阅），用于服务端向客户端实时推送数据

## 和 Query/Mutation 的区别

Query 和 Mutation 是**一问一答**的模式：客户端发一个请求，服务端返回一个响应，连接就结束了。如果客户端想知道"有没有新文章"，只能不停地轮询（每隔几秒发一次 Query）

Subscription 不一样——客户端说"我要监听新文章"，然后**连接保持不断**，服务端有新文章时主动推过来，客户端不需要反复请求

```txt
Query/Mutation（HTTP 请求，一问一答）:

  Client ─── "给我用户列表" ──▶ Server
  Client ◀── [用户数据] ──────── Server
  （连接结束）


Subscription（WebSocket 长连接，持续推送）:

  Client ─── "我要监听新文章" ──▶ Server
  （连接保持...）
  Client ◀── 新文章 A ──────────── Server    ← 有人发了文章，服务端主动推
  （连接保持...）
  Client ◀── 新文章 B ──────────── Server    ← 又有人发了文章
  （连接保持...直到客户端取消订阅）
```

::: warning 传输协议不同

- Query / Mutation 走普通 **HTTP** 请求
- Subscription 走 **WebSocket** 长连接（[详见](/programming/web-backend/websocket/)）
- 两种传输在同一个 Apollo Server 中共存，客户端会自动根据操作类型选择协议
:::

---

## 工作原理

Subscription 基于**发布/订阅（Pub/Sub）模型**，核心是三个角色：

| 角色 | 做什么 | 类比 |
| --- | --- | --- |
| 订阅者（Subscriber） | 客户端声明"我要监听某个事件" | 关注了某个 UP 主 |
| 发布者（Publisher） | 服务端在数据变更时发布事件 | UP 主发了新视频 |
| 事件总线（PubSub） | 中间人，负责把事件分发给所有订阅者 | 平台的推送系统 |

完整流程：

```txt
① 客户端订阅
   Client A ─── subscription { postCreated { title } } ───▶ Server
                                                              │
                                                         PubSub 注册:
                                                         Client A 监听 "POST_CREATED"

② Mutation 触发事件（可以是任何客户端触发的）
   Client B ─── mutation { createPost(title: "Hello") } ──▶ Server
                                                              │
                                                         Resolver 执行:
                                                         1. 存入数据库
                                                         2. pubsub.publish("POST_CREATED", data)
                                                              │
                                                              ▼
③ PubSub 分发给所有订阅者
   Server ──▶ Client A: { data: { postCreated: { title: "Hello" } } }
```

---

## Schema 定义

和 Query、Mutation 一样在 Schema 中定义。参数用于过滤——比如只监听某篇文章的新评论：

```graphql
type Subscription {
  postCreated: Post!                     # 监听所有新文章
  commentAdded(postId: ID!): Comment!    # 只监听指定文章的新评论
}
```

---

## 服务端实现

需要两步：在 Mutation 的 Resolver 中**发布事件**，在 Subscription 的 Resolver 中**注册监听**

```ts
import { PubSub } from "graphql-subscriptions";

// PubSub 就是事件总线，负责发布和分发事件
const pubsub = new PubSub();

const resolvers = {
  // ① Mutation 中发布事件
  Mutation: {
    createPost: async (_, { input }, { db }) => {
      const post = await db.posts.create(input);
      // 数据写入成功后，发布事件通知所有订阅者
      pubsub.publish("POST_CREATED", { postCreated: post });
      return post;
    },

    addComment: async (_, { postId, input }, { db }) => {
      const comment = await db.comments.create({ ...input, postId });
      // 按 postId 发布到不同频道，只通知订阅了该文章的客户端
      pubsub.publish(`COMMENT_ADDED_${postId}`, { commentAdded: comment });
      return comment;
    },
  },

  // ② Subscription 中注册监听
  Subscription: {
    postCreated: {
      // subscribe 返回一个异步迭代器，PubSub 收到事件时自动推送给客户端
      subscribe: () => pubsub.asyncIterator(["POST_CREATED"]),
    },
    commentAdded: {
      // 带参数：根据客户端传入的 postId 监听对应的频道
      subscribe: (_, { postId }) =>
        pubsub.asyncIterator([`COMMENT_ADDED_${postId}`]),
    },
  },
};
```

::: warning `publish` 的数据格式

`pubsub.publish` 的第二个参数必须是 `{ 字段名: 数据 }` 的格式，字段名要和 Schema 中定义的 Subscription 字段名一致：

```ts
// Schema: postCreated: Post!
// ↓ 字段名必须是 "postCreated"
pubsub.publish("POST_CREATED", { postCreated: post });
```

写错字段名不会报错，但客户端收到的数据会是 `null`
:::

---

## 生产环境

::: danger PubSub 只适合开发环境

上面用的 `PubSub` 是**内存级**的事件总线——事件只在当前进程内传播。生产环境通常部署多个服务实例，实例 A 发布的事件，连接在实例 B 上的客户端收不到：

```txt
Client A 连接在 Server 1 ──── 订阅 POST_CREATED
Client B 在 Server 2 上执行 createPost ──── publish("POST_CREATED")
                                              │
                                         事件只在 Server 2 内存中
                                         Server 1 不知道 → Client A 收不到
```

生产环境用 Redis 等分布式方案替换，所有实例共享同一个事件总线：

| 方案 | 包 | 说明 |
| --- | --- | --- |
| Redis Pub/Sub | `graphql-redis-subscriptions` | 最常用，轻量 |
| Kafka | `graphql-kafka-subscriptions` | 需要消息持久化、回溯消费时使用 |

替换方式——只改一行，Resolver 代码不需要动：

```ts
// 开发环境
const pubsub = new PubSub();

// 生产环境：替换为 Redis
import { RedisPubSub } from "graphql-redis-subscriptions";
const pubsub = new RedisPubSub();  // 其他代码完全不变
```

:::

> 客户端订阅用法见 [Apollo — 订阅](/programming/web-backend/graphql/apollo#订阅-usesubscription)
