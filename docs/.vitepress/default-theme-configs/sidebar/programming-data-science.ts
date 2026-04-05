import type { DefaultTheme } from 'vitepress'

interface Labels {
  tools: string
  relational: string
  nonRelational: string
  dataWarehouse: string
}

const ZH_LABELS: Labels = {
  tools: '工具',
  relational: '关系型',
  nonRelational: '非关系型',
  dataWarehouse: '数据仓库',
}

const JA_LABELS: Labels = {
  tools: 'ツール',
  relational: 'リレーショナル',
  nonRelational: 'NoSQL',
  dataWarehouse: 'データウェアハウス',
}

function createDataScienceSidebar(prefix: string, labels: Labels): DefaultTheme.Sidebar {
  const PATH_BI = `${prefix}/programming/data-science/bi/`
  const PATH_DATABASE = `${prefix}/programming/data-science/database/`

  return {
    // BI
    [PATH_BI]: [
      { text: 'BI', link: PATH_BI },
      {
        text: labels.tools,
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
        text: labels.relational,
        collapsed: false,
        items: [
          { text: 'PostgreSQL', link: `${PATH_DATABASE}postgresql` },
          { text: 'MySQL', link: `${PATH_DATABASE}mysql` },
        ],
      },
      {
        text: labels.nonRelational,
        collapsed: false,
        items: [
          { text: 'MongoDB', link: `${PATH_DATABASE}mongodb` },
          { text: 'Redis', link: `${PATH_DATABASE}redis` },
        ],
      },
      {
        text: labels.dataWarehouse,
        collapsed: false,
        items: [
          { text: 'BigQuery', link: `${PATH_DATABASE}bigquery` },
          { text: 'ClickHouse', link: `${PATH_DATABASE}clickhouse` },
        ],
      },
    ],
  }
}

export const zhDataScienceSidebar = createDataScienceSidebar('', ZH_LABELS)
export const jaDataScienceSidebar = createDataScienceSidebar('/ja', JA_LABELS)
