---
prev: false
next: false
---

# tRPC

tRPC 是一个用于构建端到端的 API 数据传输框架，基于 TypeScript 保证类型安全

> [!IMPORTANT] 特点:
>
> - 客户端请求不需要 RESTful 请求方式与请求路径，会直接调用服务端的处理函数
> - 同一个页面中的多个 tRPC 请求会合并为一个请求

```txt
┏━━━━━━━━ REST API Client ━━━━━┓ ┏━━━━━━━━━━━━ REST API Server ━━━━━━━━━━━━━━┓
┃                              ┃ ┃                                           ┃
┃ axios.get("/api/user")      ━━━━  GET  ━━━▶ /api/user   ━━▶ getUserList    ┃
┃ axios.get("/api/user/1")    ━━━━  GET  ━━━▶ /api/user/1 ━━▶ getUserById    ┃
┃ axios.post("/api/user")     ━━━━  POST ━━━▶ /api/user   ━━▶ createUser     ┃
┃ axios.put("/api/user/1")    ━━━━  PUT  ━━━▶ /api/user/1 ━━▶ updateUserById ┃
┃ axios.delete("/api/user/1") ━━━━ DELETE ━━▶ /api/user/1 ━━▶ deleteUserById ┃
┃                              ┃ ┃                                           ┃
┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛ ┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛


┏━━━━━━━━━ tRPC Client ━━━━━━━━┓ ┏━━━━━━━━━━━━━ tRPC Server ━━━━━━━━━━━━━━━━━┓
┃                              ┃ ┃                                           ┃
┃ trpcClient.getUserList     ━━━━━━━━━━━━▶   getUserList                     ┃
┃ trpcClient.getUserById     ━━━━━━━━━━━━▶   getUserById                     ┃
┃ trpcClient.createUser      ━━━━━━━━━━━━▶   createUser                      ┃
┃ trpcClient.updateUserById  ━━━━━━━━━━━━▶   updateUserById                  ┃
┃ trpcClient.deleteUserById  ━━━━━━━━━━━━▶   deleteUserById                  ┃
┃                              ┃ ┃                                           ┃
┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛ ┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛
```

## 下载安装

```zsh
% npm install @trpc/server @trpc/client zod
```

## 基本使用

主要用于 Typescript 开发的全栈项目

首先在服务端定义 [路由器 ( Router )](/programming/web-backend/trpc/sample-next#路由器)、[过程 ( Procedure )](/programming/web-backend/trpc/sample-next#过程)、[上下文 ( Context )](/programming/web-backend/trpc/sample-next#上下文)

然后在客户端通过 [客户端对象 ( Client )](/programming/web-backend/trpc/sample-next#客户端对象) 调用对应的过程进行数据传输
