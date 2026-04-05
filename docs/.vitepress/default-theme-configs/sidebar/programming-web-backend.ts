import type { DefaultTheme } from 'vitepress'

interface Labels {
  apiCommunication: string
  dataRequest: string
  realtime: string
  basics: string
  examples: string
  advanced: string
  errorHandling: string
}

const ZH_LABELS: Labels = {
  apiCommunication: 'API 通信方式',
  dataRequest: '数据请求方式',
  realtime: '实时通信',
  basics: '基础',
  examples: '开发示例',
  advanced: '进阶',
  errorHandling: '错误处理',
}

const JA_LABELS: Labels = {
  apiCommunication: 'API 通信方式',
  dataRequest: 'データリクエスト',
  realtime: 'リアルタイム通信',
  basics: '基礎',
  examples: '開発例',
  advanced: '応用',
  errorHandling: 'エラー処理',
}

/**
 * Sidebar 配置
 *
 * 設計原則：
 * - 只有具体技术主题（如 React、Vue）才配置 sidebar
 * - 分类首页（如 /programming/web-frontend/）不配置 → 不显示 sidebar
 * - sidebar 内容应该是该主题的子章节（如 Hooks、组件、状态管理）
 */
function createWebBackendSidebar(prefix: string, labels: Labels): DefaultTheme.Sidebar {
  const PATH_BACKEND = `${prefix}/programming/web-backend/`
  const PATH_TRPC = `${prefix}/programming/web-backend/trpc/`
  const PATH_GRAPHQL = `${prefix}/programming/web-backend/graphql/`
  const PATH_GRPC = `${prefix}/programming/web-backend/grpc/`
  const PATH_PROTOBUF = `${prefix}/programming/web-backend/protobuf/`
  const PATH_WEBSOCKET = `${prefix}/programming/web-backend/websocket/`
  const PATH_SSE = `${prefix}/programming/web-backend/sse/`

  const COMPARISON_LINK = {
    text: labels.apiCommunication,
    link: `${PATH_BACKEND}api-communication`,
  }

  return {
    // API 通信方式
    [`${PATH_BACKEND}api-communication`]: [
      {
        text: labels.dataRequest,
        collapsed: false,
        items: [
          { text: 'GraphQL', link: `${PATH_GRAPHQL}` },
          { text: 'tRPC', link: `${PATH_TRPC}` },
          { text: 'gRPC', link: `${PATH_GRPC}` },
        ],
      },
      {
        text: labels.realtime,
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
        text: labels.basics,
        collapsed: false,
        items: [{ text: labels.errorHandling, link: `${PATH_TRPC}error-handling` }],
      },
      {
        text: labels.examples,
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
        text: labels.basics,
        collapsed: false,
        items: [
          { text: 'Schema', link: `${PATH_GRAPHQL}schema` },
          { text: 'Resolver', link: `${PATH_GRAPHQL}resolver` },
          { text: 'Subscription', link: `${PATH_GRAPHQL}subscription` },
        ],
      },
      {
        text: labels.examples,
        collapsed: false,
        items: [
          { text: 'Apollo（TypeScript）', link: `${PATH_GRAPHQL}apollo` },
          { text: 'gqlgen（Go）', link: `${PATH_GRAPHQL}gqlgen` },
          {
            text: labels.apiCommunication === 'API 通信方式' ? '分页' : 'ページネーション',
            link: `${PATH_GRAPHQL}pagination`,
          },
          {
            text: labels.apiCommunication === 'API 通信方式' ? '文件上传' : 'ファイルアップロード',
            link: `${PATH_GRAPHQL}file-upload`,
          },
        ],
      },
      {
        text: labels.advanced,
        collapsed: false,
        items: [
          { text: 'N+1', link: `${PATH_GRAPHQL}n-plus-one` },
          {
            text: labels.apiCommunication === 'API 通信方式' ? '缓存' : 'キャッシュ',
            link: `${PATH_GRAPHQL}caching`,
          },
          {
            text:
              labels.apiCommunication === 'API 通信方式'
                ? '安全与错误处理'
                : 'セキュリティとエラー処理',
            link: `${PATH_GRAPHQL}security`,
          },
          { text: 'Federation', link: `${PATH_GRAPHQL}federation` },
        ],
      },
    ],

    // gRPC
    [PATH_GRPC]: [
      COMPARISON_LINK,
      { text: 'gRPC', link: `${PATH_GRPC}` },
      { text: 'Protocol Buffers', link: `${PATH_PROTOBUF}` },
    ],

    // Protocol Buffers
    [PATH_PROTOBUF]: [
      { text: 'Protocol Buffers', link: `${PATH_PROTOBUF}` },
      { text: 'gRPC', link: `${PATH_GRPC}` },
    ],

    // WebSocket
    [PATH_WEBSOCKET]: [
      COMPARISON_LINK,
      { text: 'WebSocket', link: `${PATH_WEBSOCKET}` },
      {
        text: labels.examples,
        collapsed: false,
        items: [
          { text: 'Node.js', link: `${PATH_WEBSOCKET}sample-node` },
          { text: 'React', link: `${PATH_WEBSOCKET}sample-react` },
          { text: 'TanStack Query', link: `${PATH_WEBSOCKET}sample-tanstack-query` },
        ],
      },
    ],

    // SSE
    [PATH_SSE]: [
      COMPARISON_LINK,
      { text: 'SSE', link: `${PATH_SSE}` },
      {
        text: labels.examples,
        collapsed: false,
        items: [
          { text: 'Node.js', link: `${PATH_SSE}sample-node` },
          { text: 'React', link: `${PATH_SSE}sample-react` },
          { text: 'TanStack Query', link: `${PATH_SSE}sample-tanstack-query` },
        ],
      },
    ],
  }
}

export const zhWebBackendSidebar = createWebBackendSidebar('', ZH_LABELS)
export const jaWebBackendSidebar = createWebBackendSidebar('/ja', JA_LABELS)
