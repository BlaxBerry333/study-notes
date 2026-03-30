# Subscription

Subscription 用于实时数据推送，基于 WebSocket

## 服务端实现

```ts
import { PubSub } from "graphql-subscriptions";

const pubsub = new PubSub();

const resolvers = {
  Mutation: {
    createPost: async (_, { input }, { db }) => {
      const post = await db.posts.create(input);
      pubsub.publish("POST_CREATED", { postCreated: post }); // 发布事件
      return post;
    },
  },
  Subscription: {
    postCreated: {
      subscribe: () => pubsub.asyncIterableIterator(["POST_CREATED"]),
    },
    commentAdded: {
      subscribe: (_, { postId }) =>
        pubsub.asyncIterableIterator([`COMMENT_ADDED_${postId}`]),
    },
  },
};
```

::: warning 注意

`PubSub` 只适合单进程开发环境。生产环境需要使用 Redis PubSub 等分布式方案（如 `graphql-redis-subscriptions`）
:::

> 客户端订阅用法见 [Apollo — 订阅](/programming/web-backend/graphql/apollo#订阅-usesubscription)
