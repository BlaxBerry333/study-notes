import type { DefaultTheme } from 'vitepress'

const PATH_REACT = '/programming/web-frontend/react/'

/**
 * Sidebar 配置
 *
 * 设计原则：
 * - 只有具体技术主题（如 React、Vue）才配置 sidebar
 * - 分类首页（如 /programming/web-frontend/）不配置 → 不显示 sidebar
 * - sidebar 内容应该是该主题的子章节（如 Hooks、组件、状态管理）
 */
export const PROGRAMMING_WEB_FRONTEND_SIDEBAR: DefaultTheme.Sidebar = {
  // React
  [PATH_REACT]: [
    { text: 'React', link: `${PATH_REACT}` },
    {
      text: '组件',
      collapsed: false,
      items: [
        {
          text: '设计模式',
          link: `${PATH_REACT}components/design-patterns`,
        },
      ],
    },
  ],
}
