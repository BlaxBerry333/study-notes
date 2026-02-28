import type { DefaultTheme } from 'vitepress'

const PATH_BI = '/programming/data-science/bi/'
const PATH_DATABASE = '/programming/data-science/database/'

/**
 * Sidebar 配置
 *
 * 设计原则：
 * - 只有具体技术主题（如 React、Vue）才配置 sidebar
 * - 分类首页（如 /programming/web-frontend/）不配置 → 不显示 sidebar
 * - sidebar 内容应该是该主题的子章节（如 Hooks、组件、状态管理）
 */
export const PROGRAMMING_DATA_SCIENCE_SIDEBAR: DefaultTheme.Sidebar = {
  // BI
  [PATH_BI]: [
    { text: 'BI', link: PATH_BI },
    {
      text: '工具',
      collapsed: false,
      items: [
        { text: 'Looker', link: `${PATH_BI}tools/looker` },
        { text: 'Metabase', link: `${PATH_BI}tools/metabase` },
      ],
    },
  ],

  // Database
  [PATH_DATABASE]: [
    { text: 'Database', link: PATH_DATABASE },
    {
      text: '关系型',
      collapsed: false,
      items: [
        { text: 'PostgreSQL', link: `${PATH_DATABASE}postgresql` },
        { text: 'MySQL', link: `${PATH_DATABASE}mysql` },
      ],
    },
    {
      text: '非关系型',
      collapsed: false,
      items: [
        { text: 'MongoDB', link: `${PATH_DATABASE}mongodb` },
        { text: 'Redis', link: `${PATH_DATABASE}redis` },
      ],
    },
    {
      text: '数据仓库',
      collapsed: false,
      items: [
        { text: 'BigQuery', link: `${PATH_DATABASE}bigquery` },
        { text: 'ClickHouse', link: `${PATH_DATABASE}clickhouse` },
      ],
    },
  ],
}
