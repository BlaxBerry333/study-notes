import type { DefaultTheme } from 'vitepress'

/**
 * Sidebar 配置
 *
 * 设计原则：
 * - 只有具体技术主题（如 React、Vue）才配置 sidebar
 * - 分类首页（如 /programming/web-frontend/）不配置 → 不显示 sidebar
 * - sidebar 内容应该是该主题的子章节（如 Hooks、组件、状态管理）
 */
const PATH_TRPC = '/programming/web-backend/trpc/'

export const PROGRAMMING_WEB_BACKEND_SIDEBAR: DefaultTheme.Sidebar = {
  // tRPC
  [PATH_TRPC]: [
    { text: 'tRPC', link: `${PATH_TRPC}` },
    {
      text: '実装例',
      collapsed: false,
      items: [
        { text: 'tRPC + Next.js', link: `${PATH_TRPC}sample-next` },
        { text: 'tRPC + TanstackQuery', link: `${PATH_TRPC}sample-tanstack-query` },
      ],
    },
  ],
}
