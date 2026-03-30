import type { DefaultTheme } from 'vitepress'

/**
 * Sidebar 配置
 *
 * 设计原则：
 * - 只有具体技术主题（如 React、Vue）才配置 sidebar
 * - 分类首页（如 /programming/web-frontend/）不配置 → 不显示 sidebar
 * - sidebar 内容应该是该主题的子章节（如 Hooks、组件、状态管理）
 */
const PATH_BACKEND = '/programming/web-backend/'
const PATH_TRPC = '/programming/web-backend/trpc/'
const PATH_GRAPHQL = '/programming/web-backend/graphql/'
const PATH_WEBSOCKET = '/programming/web-backend/websocket/'
const PATH_SSE = '/programming/web-backend/sse/'

const COMPARISON_LINK = { text: 'API 通信方式', link: `${PATH_BACKEND}api-communication` }

export const PROGRAMMING_WEB_BACKEND_SIDEBAR: DefaultTheme.Sidebar = {
  // API 通信方式
  [`${PATH_BACKEND}api-communication`]: [
    {
      text: '数据请求方式',
      collapsed: false,
      items: [
        { text: 'GraphQL', link: `${PATH_GRAPHQL}` },
        { text: 'tRPC', link: `${PATH_TRPC}` },
      ],
    },
    {
      text: '实时通信',
      collapsed: false,
      items: [
        { text: 'SSE', link: `${PATH_SSE}` },
        { text: 'WebSocket', link: `${PATH_WEBSOCKET}` },
      ],
    },
  ],

  // tRPC
  [PATH_TRPC]: [
    COMPARISON_LINK,
    { text: 'tRPC', link: `${PATH_TRPC}` },
    {
      text: '开发示例',
      collapsed: false,
      items: [
        { text: 'tRPC + Next.js', link: `${PATH_TRPC}sample-next` },
        { text: 'tRPC + TanstackQuery', link: `${PATH_TRPC}sample-tanstack-query` },
      ],
    },
  ],

  // GraphQL
  [PATH_GRAPHQL]: [
    COMPARISON_LINK,
    { text: 'GraphQL', link: `${PATH_GRAPHQL}` },
    {
      text: '基础',
      collapsed: false,
      items: [
        { text: '操作语法', link: `${PATH_GRAPHQL}syntax` },
        { text: 'Schema', link: `${PATH_GRAPHQL}schema` },
        { text: 'Resolver', link: `${PATH_GRAPHQL}resolver` },
      ],
    },
    {
      text: '开发示例',
      collapsed: false,
      items: [
        { text: 'Apollo（TypeScript）', link: `${PATH_GRAPHQL}apollo` },
        { text: 'gqlgen（Go）', link: `${PATH_GRAPHQL}gqlgen` },
      ],
    },
    {
      text: '进阶',
      collapsed: false,
      items: [
        { text: 'N+1 问题', link: `${PATH_GRAPHQL}n-plus-one` },
        { text: '分页', link: `${PATH_GRAPHQL}pagination` },
        { text: 'Subscription', link: `${PATH_GRAPHQL}subscription` },
        { text: '安全与错误处理', link: `${PATH_GRAPHQL}performance` },
        { text: '文件上传', link: `${PATH_GRAPHQL}file-upload` },
      ],
    },
  ],

  // WebSocket
  [PATH_WEBSOCKET]: [
    COMPARISON_LINK,
    { text: 'WebSocket', link: `${PATH_WEBSOCKET}` },
    {
      text: '开发示例',
      collapsed: false,
      items: [
        { text: 'Node.js 実装', link: `${PATH_WEBSOCKET}sample-node` },
        { text: 'React 実装', link: `${PATH_WEBSOCKET}sample-react` },
        { text: 'TanStack Query 実装', link: `${PATH_WEBSOCKET}sample-tanstack-query` },
      ],
    },
  ],

  // SSE
  [PATH_SSE]: [
    COMPARISON_LINK,
    { text: 'SSE', link: `${PATH_SSE}` },
    {
      text: '开发示例',
      collapsed: false,
      items: [
        { text: 'Node.js 実装', link: `${PATH_SSE}sample-node` },
        { text: 'React 実装', link: `${PATH_SSE}sample-react` },
        { text: 'TanStack Query 実装', link: `${PATH_SSE}sample-tanstack-query` },
      ],
    },
  ],
}
