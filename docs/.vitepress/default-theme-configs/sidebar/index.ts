import type { DefaultTheme } from 'vitepress'

/**
 * Sidebar 配置
 *
 * 设计原则：
 * - 只有具体技术主题（如 React、Vue）才配置 sidebar
 * - 分类首页（如 /programming/web-frontend/）不配置 → 不显示 sidebar
 * - sidebar 内容应该是该主题的子章节（如 Hooks、组件、状态管理）
 *
 * 示例：
 * '/programming/web-frontend/react/': [
 *   { text: '介绍', link: '/programming/web-frontend/react/' },
 *   { text: 'Hooks', link: '/programming/web-frontend/react/hooks' },
 *   { text: '组件', link: '/programming/web-frontend/react/components' },
 * ],
 */
export const DEFAULT_THEME_SIDEBAR: DefaultTheme.Sidebar = {
  // React 笔记
  '/programming/web-frontend/react/': [
    { text: 'React 介绍', link: '/programming/web-frontend/react/' },
    { text: 'React 组件', link: '/programming/web-frontend/react/components/' },
    { text: 'React Hooks', link: '/programming/web-frontend/react/hooks/' },
  ],
}
