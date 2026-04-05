# 缓存

## 为什么 GraphQL 必须自己做缓存

REST 的每个端点是独立的 URL（`GET /api/users/1`），浏览器和 CDN 天然按 URL 缓存响应——不需要任何额外工作。

GraphQL 所有请求都是 `POST /graphql`，URL 永远一样，HTTP 缓存机制完全失效：

```txt
REST:
  GET /api/users/1    → 浏览器/CDN 按 URL 缓存 ✓
  GET /api/users/2    → 不同 URL，独立缓存 ✓

GraphQL:
  POST /graphql       → 查用户 1
  POST /graphql       → 查用户 2
  POST /graphql       → 查文章列表
  URL 全一样，HTTP 缓存无法区分 ✗
```

因此 GraphQL 的缓存必须在**客户端**实现——由 Apollo Client、urql 等客户端库来管理。

---

## 缓存怎么工作

客户端库拿到 GraphQL 响应后，不是直接丢掉，而是存起来。下次再发同样的查询时，先看缓存里有没有，有就直接用，不发请求。

但"怎么存"有两种思路：

---

### 思路一：整份存（文档缓存）

urql 的做法。把「查询语句 + 变量」作为 key，把整个响应作为 value 直接存起来，和浏览器缓存的思路类似：

```txt
缓存 key                              缓存 value
────────────────────────────────────   ──────────────────────────
query { user(id:"1") { name posts } } → { user: { name:"Alice", posts:[...] } }
query { user(id:"2") { name } }       → { user: { name:"Bob" } }
query { posts { title } }             → { posts: [{ title:"Hello" }, ...] }
```

简单直观，但有个问题：Mutation 修改了数据后，哪些缓存该过期？urql 的做法是看 Mutation 响应中的 `__typename`——如果响应包含 `User` 类型，就把所有查询过 `User` 的缓存标记为过期，下次访问时重新请求。不需要手动配置，但粒度较粗（可能让不相关的查询也被重新请求）。

---

### 思路二：拆开存（规范化缓存）

Apollo 的做法。不存整个响应，而是把响应里的每个对象**拆出来单独存**，用 `类型名:id` 作为 key：

```txt
查询结果:                           Apollo 缓存中的存储:
{ user(id:"1") {                    ┌──────────────────────────────────┐
    id: "1"                         │ "User:1"  → { name:"Alice" }    │
    name: "Alice"          →        │ "Post:10" → { title:"Hello" }   │
    posts: [                        │ "Post:20" → { title:"World" }   │
      { id:"10", title:"Hello" }    └──────────────────────────────────┘
      { id:"20", title:"World" }    同一对象全站只存一份
    ]
  }
}
```

好处：如果任何地方更新了 `User:1` 的 name，所有引用 `User:1` 的组件自动拿到新数据，不需要重新请求。

代价：服务端返回的数据**必须包含 `id` 字段**，否则 Apollo 无法识别对象。

---

### 怎么选

| | 整份存（urql） | 拆开存（Apollo） |
| --- | --- | --- |
| 实现 | 简单，开箱即用 | 复杂，需要数据带 `id` |
| 更新精度 | 按查询粒度失效 | 按对象精确更新 |
| 适合 | 数据关系简单、快速集成 | 数据关系复杂、多处引用同一对象 |

::: tip 大多数项目选 Apollo，除非你特别追求轻量
:::

---

## 读取策略（fetchPolicy）

控制 `useQuery` 先看缓存还是先发请求。**大多数情况用默认就行**，遇到特定需求再调整：

| 策略 | 行为 | 什么时候用 |
| --- | --- | --- |
| `cache-first` | **默认**。缓存有就用缓存，没有才发请求 | 大多数查询 |
| `cache-and-network` | 先返回缓存（页面立即有内容），同时后台发请求更新 | 打开页面要立即看到数据，但也要最新的 |
| `network-only` | 总是发请求，结果写入缓存 | 表单提交后刷新列表、数据时效性高 |
| `cache-only` | 只读缓存，不发请求 | 确定数据已在缓存中（如详情页返回列表页） |
| `no-cache` | 总是发请求，结果不写入缓存 | 一次性数据、敏感数据 |

```ts
const { data } = useQuery(GET_USER, {
  fetchPolicy: "cache-and-network",
});
```

---

## Mutation 后缓存怎么更新

这是 GraphQL 缓存最容易踩坑的地方。问题很简单：

```txt
1. 页面加载时查询用户列表 → 缓存了 [Alice, Bob]
2. 用户提交表单创建了 Charlie → 服务端多了一条数据
3. 但客户端缓存还是 [Alice, Bob] → 页面没变化
```

三种解决方式，从简单到复杂：

---

### refetchQueries（重新请求）

最简单——Mutation 完成后让指定的查询重新请求一次：

```ts
const [createUser] = useMutation(CREATE_USER, {
  refetchQueries: [{ query: GET_USERS }],
});
```

多一次网络请求，但不用操心缓存。**大多数场景用这个就够了**。

---

### update（手动改缓存）

不发额外请求，直接把新数据写入缓存：

```ts
const [createUser] = useMutation(CREATE_USER, {
  update(cache, { data: { createUser: newUser } }) {
    const existing = cache.readQuery({ query: GET_USERS });
    cache.writeQuery({
      query: GET_USERS,
      data: { users: [...existing.users, newUser] },
    });
  },
});
```

适合需要减少请求次数、对性能敏感的场景。

---

### optimisticResponse（乐观更新）

不等服务端响应，先假设成功，**立即**用预期数据更新 UI。请求成功后替换为真实数据，失败则自动回滚：

```ts
const [toggleLike] = useMutation(TOGGLE_LIKE, {
  optimisticResponse: {
    toggleLike: {
      __typename: "Post",
      id: postId,
      liked: !currentLiked,
      likeCount: currentLiked ? count - 1 : count + 1,
    },
  },
});
```

适合用户期望即时反馈的操作（点赞、收藏、拖拽排序）。

---

### 对比

| 方式 | 额外请求 | 复杂度 | 适用场景 |
| --- | --- | --- | --- |
| `refetchQueries` | 有 | 低 | **大多数场景**，先用这个 |
| `update` | 无 | 中 | 列表增删、减少请求 |
| `optimisticResponse` | 无 | 高 | 点赞、收藏等即时反馈 |

---

## 手动操作缓存

::: tip 一般不需要用到这些 API

上面的 fetchPolicy + refetchQueries 覆盖了 90% 的场景。只有以下情况才需要手动操作：

- 用户注销后清除缓存中的个人数据
- 删除操作后从缓存移除对象
- Mutation 的 `update` 回调中读写缓存（上面已经展示过）
:::

```ts
import { useApolloClient } from "@apollo/client";

function SomeComponent() {
  const client = useApolloClient();

  // 读取缓存
  const data = client.readQuery({ query: GET_USERS });

  // 写入缓存
  client.writeQuery({
    query: GET_USERS,
    data: { users: [...data.users, newUser] },
  });

  // 驱逐特定对象（如用户注销后清除个人数据）
  client.cache.evict({ id: "User:1" });
  client.cache.gc(); // 垃圾回收无引用对象
}
```
