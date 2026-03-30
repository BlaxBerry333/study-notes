---
prev: false
next: false
---

# MSW

> Mock Service Worker

在网络层拦截请求并返回模拟响应的 API Mock 工具

::: warning 特点:

- 在网络层拦截（Service Worker / Node.js 拦截器），**业务代码零改动**
- mock 代码与业务代码完全隔离，不会打包进生产环境
- 同一套 handler 同时用于开发和测试
- 支持 REST 和 GraphQL
- 请求在 DevTools Network 面板可见，便于调试
:::

## 传统方案的问题

传统 mock 方案的 **mock 逻辑侵入了业务代码**：

```txt
┏━━━━━━ 方案一：服务端条件返回 ━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓
┃                                                      ┃
┃  app.get("/api/users", (req, res) => {               ┃
┃    if (process.env.MOCK) return res.json(mockData);  ┃  ← mock 混在业务代码里
┃    return res.json(await db.query(...));             ┃    忘删就上线了
┃  });                                                 ┃
┃                                                      ┃
┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛

┏━━━━━━ 方案二：前端条件调用 ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓
┃                                                       ┃
┃  const users = isDev                                  ┃
┃    ? mockUsers                                        ┃  ← 组件里散落 mock 判断
┃    : await fetch("/api/users");                       ┃    每个请求都要改
┃                                                       ┃
┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛
```

MSW 在**网络层**拦截，业务代码只写 `fetch("/api/users")`，根本不知道自己被 mock 了：

- **开发时**：后端 API 没写好？前端照常开发，上线前删掉 mock 启动代码即可
- **测试时**：不需要 mock `fetch` / axios / 注入假数据，测试行为和生产环境**完全一致**

```txt
              fetch("/api/users")
  ┌─────────────────────┐    ┌─────────────────┐    ┌─────────────────┐
  │                     │    │                 │    │                 │
  │  前端应用/测试        │    │  MSW 拦截层      │─✕─▶│    服务端        │
  │                     │    │                 │    │                 │
  │  fetch() 正常发出    │◀── │  匹配 Handler    │    │  不会到达        │
  │  无需 mock 判断      │──▶ │  返回模拟响应     │     │                │
  │  代码零改动           │    │                 │    │                 │
  │                     │    │  浏览器:         │    │                 │
  │                     │    │ Service Worker  │    │                 │
  │                     │    │  测试:           │    │                 │
  │                     │    │   Node.js 拦截器 │    │                 │
  └─────────────────────┘    └─────────────────┘    └─────────────────┘
```

## 下载安装

```zsh
% npm install msw --save-dev
% npx msw init ./public --save    # 仅浏览器端需要（见下方说明）
```

::: tip `msw init` 生成了什么？
在 `public/` 下生成 `mockServiceWorker.js`——MSW 的 Service Worker 拦截脚本。这个文件**不需要编辑**，和你写的 mock handler 无关
:::

## 基本使用

三步接入：① 定义 Handler → ② 创建拦截实例 → ③ 接入应用，详见 [基本使用](./usage)
