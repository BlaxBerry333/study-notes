import type { DefaultTheme } from 'vitepress'

const PATH_REACT = '/programming/web-frontend/react/'
const PATH_ACCESSIBILITY = '/programming/web-frontend/accessibility/'
const PATH_JAVASCRIPT = '/programming/web-frontend/javascript/'
const PATH_MSW = '/programming/web-frontend/msw/'
const PATH_STYLES = '/programming/web-frontend/styles/'

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
      text: '基础',
      collapsed: false,
      items: [
        { text: '组件设计模式', link: `${PATH_REACT}design-patterns` },
        { text: '实用自定义 Hooks', link: `${PATH_REACT}custom-hooks` },
      ],
    },
    {
      text: '性能优化',
      collapsed: false,
      items: [
        { text: '渲染优化', link: `${PATH_REACT}performance` },
        { text: '加载性能', link: `${PATH_REACT}performance-loading` },
      ],
    },
  ],

  // Accessibility
  [PATH_ACCESSIBILITY]: [
    { text: 'Accessibility', link: `${PATH_ACCESSIBILITY}` },
    {
      text: '基础',
      collapsed: false,
      items: [
        { text: '语义化 HTML', link: `${PATH_ACCESSIBILITY}semantic-html` },
        { text: 'WAI-ARIA', link: `${PATH_ACCESSIBILITY}aria` },
        { text: '键盘操作', link: `${PATH_ACCESSIBILITY}keyboard` },
        { text: '表单', link: `${PATH_ACCESSIBILITY}form` },
      ],
    },
    {
      text: '进阶',
      collapsed: false,
      items: [{ text: '测试', link: `${PATH_ACCESSIBILITY}testing` }],
    },
  ],

  // JavaScript
  [PATH_JAVASCRIPT]: [
    { text: 'JavaScript', link: `${PATH_JAVASCRIPT}` },
    {
      text: '基础',
      collapsed: false,
      items: [
        { text: '深浅拷贝', link: `${PATH_JAVASCRIPT}copy` },
        { text: '手写深拷贝', link: `${PATH_JAVASCRIPT}deep-clone` },
      ],
    },
  ],

  // MSW
  [PATH_MSW]: [
    { text: 'MSW', link: `${PATH_MSW}` },
    {
      text: '开发示例',
      collapsed: false,
      items: [{ text: '基本使用', link: `${PATH_MSW}usage` }],
    },
  ],

  // Styles
  [PATH_STYLES]: [{ text: 'Styles', link: `${PATH_STYLES}` }],
}
