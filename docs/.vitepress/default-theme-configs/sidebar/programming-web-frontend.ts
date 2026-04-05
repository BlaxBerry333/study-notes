import type { DefaultTheme } from 'vitepress'

interface Labels {
  basics: string
  performance: string
  advanced: string
  examples: string
  renderOpt: string
  loadOpt: string
  componentPatterns: string
  customHooks: string
  semanticHtml: string
  keyboard: string
  form: string
  testing: string
  deepShallowCopy: string
  deepClone: string
  basicUsage: string
  generics: string
  utilityTypes: string
  tsReact: string
  routing: string
  rendering: string
  middleware: string
  eventLoop: string
  closure: string
  prototype: string
  async: string
  thisBinding: string
  stateManagement: string
  hooksDeep: string
  vitest: string
  security: string
}

const ZH_LABELS: Labels = {
  basics: '基础',
  performance: '性能优化',
  advanced: '进阶',
  examples: '开发示例',
  renderOpt: '渲染优化',
  loadOpt: '加载性能',
  componentPatterns: '组件设计模式',
  customHooks: '实用自定义 Hooks',
  semanticHtml: '语义化 HTML',
  keyboard: '键盘操作',
  form: '表单',
  testing: '测试',
  deepShallowCopy: '深浅拷贝',
  deepClone: '手写深拷贝',
  basicUsage: '基本使用',
  generics: '泛型',
  utilityTypes: '工具类型',
  tsReact: 'TypeScript × React',
  routing: '路由',
  rendering: '渲染策略',
  middleware: 'Middleware',
  eventLoop: '事件循环',
  closure: '闭包',
  prototype: '原型链',
  async: '异步编程',
  thisBinding: 'this',
  stateManagement: '状態管理',
  hooksDeep: 'Hooks 深入',
  vitest: 'Vitest',
  security: '前端安全',
}

const JA_LABELS: Labels = {
  basics: '基礎',
  performance: 'パフォーマンス',
  advanced: '応用',
  examples: '開発例',
  renderOpt: 'レンダリング最適化',
  loadOpt: 'ロード最適化',
  componentPatterns: 'コンポーネント設計パターン',
  customHooks: 'カスタム Hooks',
  semanticHtml: 'セマンティック HTML',
  keyboard: 'キーボード操作',
  form: 'フォーム',
  testing: 'テスト',
  deepShallowCopy: '深い・浅いコピー',
  deepClone: 'ディープクローン実装',
  basicUsage: '基本使用',
  generics: 'ジェネリクス',
  utilityTypes: 'ユーティリティ型',
  tsReact: 'TypeScript × React',
  routing: 'ルーティング',
  rendering: 'レンダリング',
  middleware: 'Middleware',
  eventLoop: 'イベントループ',
  closure: 'クロージャ',
  prototype: 'プロトタイプチェーン',
  async: '非同期処理',
  thisBinding: 'this',
  stateManagement: '状態管理',
  hooksDeep: 'Hooks 深入',
  vitest: 'Vitest',
  security: 'フロントエンドセキュリティ',
}

function createWebFrontendSidebar(prefix: string, labels: Labels): DefaultTheme.Sidebar {
  const PATH_REACT = `${prefix}/programming/web-frontend/react/`
  const PATH_ACCESSIBILITY = `${prefix}/programming/web-frontend/accessibility/`
  const PATH_JAVASCRIPT = `${prefix}/programming/web-frontend/javascript/`
  const PATH_TYPESCRIPT = `${prefix}/programming/web-frontend/typescript/`
  const PATH_NEXT = `${prefix}/programming/web-frontend/next/`
  const PATH_TESTING = `${prefix}/programming/web-frontend/testing/`
  const PATH_STORYBOOK = `${prefix}/programming/web-frontend/storybook/`
  const PATH_SECURITY = `${prefix}/programming/web-frontend/security`
  const PATH_MSW = `${prefix}/programming/web-frontend/msw/`
  const PATH_STYLES = `${prefix}/programming/web-frontend/styles/`

  return {
    // TypeScript
    [PATH_TYPESCRIPT]: [
      { text: 'TypeScript', link: `${PATH_TYPESCRIPT}` },
      {
        text: labels.basics,
        collapsed: false,
        items: [
          { text: labels.generics, link: `${PATH_TYPESCRIPT}generics` },
          { text: labels.utilityTypes, link: `${PATH_TYPESCRIPT}utility-types` },
          { text: labels.tsReact, link: `${PATH_TYPESCRIPT}react` },
        ],
      },
    ],

    // Next.js
    [PATH_NEXT]: [
      { text: 'Next.js', link: `${PATH_NEXT}` },
      {
        text: labels.basics,
        collapsed: false,
        items: [
          { text: labels.routing, link: `${PATH_NEXT}routing` },
          { text: labels.rendering, link: `${PATH_NEXT}rendering` },
          { text: labels.middleware, link: `${PATH_NEXT}middleware` },
        ],
      },
    ],

    // React
    [PATH_REACT]: [
      { text: 'React', link: `${PATH_REACT}` },
      {
        text: labels.basics,
        collapsed: false,
        items: [
          { text: labels.componentPatterns, link: `${PATH_REACT}design-patterns` },
          { text: labels.customHooks, link: `${PATH_REACT}custom-hooks` },
        ],
      },
      {
        text: labels.performance,
        collapsed: false,
        items: [
          { text: labels.renderOpt, link: `${PATH_REACT}performance` },
          { text: labels.loadOpt, link: `${PATH_REACT}performance-loading` },
        ],
      },
      {
        text: labels.advanced,
        collapsed: false,
        items: [
          { text: labels.stateManagement, link: `${PATH_REACT}state-management` },
          { text: labels.hooksDeep, link: `${PATH_REACT}hooks-deep` },
        ],
      },
    ],

    // Accessibility
    [PATH_ACCESSIBILITY]: [
      { text: 'Accessibility', link: `${PATH_ACCESSIBILITY}` },
      {
        text: labels.basics,
        collapsed: false,
        items: [
          { text: labels.semanticHtml, link: `${PATH_ACCESSIBILITY}semantic-html` },
          { text: 'WAI-ARIA', link: `${PATH_ACCESSIBILITY}aria` },
          { text: labels.keyboard, link: `${PATH_ACCESSIBILITY}keyboard` },
          { text: labels.form, link: `${PATH_ACCESSIBILITY}form` },
        ],
      },
      {
        text: labels.advanced,
        collapsed: false,
        items: [{ text: labels.testing, link: `${PATH_ACCESSIBILITY}testing` }],
      },
    ],

    // JavaScript
    [PATH_JAVASCRIPT]: [
      { text: 'JavaScript', link: `${PATH_JAVASCRIPT}` },
      {
        text: labels.basics,
        collapsed: false,
        items: [
          { text: labels.eventLoop, link: `${PATH_JAVASCRIPT}event-loop` },
          { text: labels.closure, link: `${PATH_JAVASCRIPT}closure` },
          { text: labels.thisBinding, link: `${PATH_JAVASCRIPT}this` },
          { text: labels.prototype, link: `${PATH_JAVASCRIPT}prototype` },
          { text: labels.async, link: `${PATH_JAVASCRIPT}async` },
          { text: labels.deepShallowCopy, link: `${PATH_JAVASCRIPT}copy` },
          { text: labels.deepClone, link: `${PATH_JAVASCRIPT}deep-clone` },
        ],
      },
    ],

    // Testing
    [PATH_TESTING]: [
      { text: labels.testing, link: `${PATH_TESTING}` },
      {
        text: labels.basics,
        collapsed: false,
        items: [{ text: labels.vitest, link: `${PATH_TESTING}vitest` }],
      },
    ],

    // Storybook
    [PATH_STORYBOOK]: [{ text: 'Storybook', link: `${PATH_STORYBOOK}` }],

    // Security
    [PATH_SECURITY]: [{ text: labels.security, link: PATH_SECURITY }],

    // MSW
    [PATH_MSW]: [
      { text: 'MSW', link: `${PATH_MSW}` },
      {
        text: labels.examples,
        collapsed: false,
        items: [{ text: labels.basicUsage, link: `${PATH_MSW}usage` }],
      },
    ],

    // Styles
    [PATH_STYLES]: [{ text: 'Styles', link: `${PATH_STYLES}` }],
  }
}

export const zhWebFrontendSidebar = createWebFrontendSidebar('', ZH_LABELS)
export const jaWebFrontendSidebar = createWebFrontendSidebar('/ja', JA_LABELS)
