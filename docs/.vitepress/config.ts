import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vitepress'

import pkg from '../../package.json'
import { jaNav } from './default-theme-configs/nav/ja'
import { zhNav } from './default-theme-configs/nav/zh'
import { jaSidebar } from './default-theme-configs/sidebar/ja'
import { zhSidebar } from './default-theme-configs/sidebar/zh'

export default defineConfig({
  // Site metadata
  title: "Chen's Study Notes",
  titleTemplate: ":title - Chen's Study Notes",
  description: pkg.description,

  // Base URL (for GitHub Pages subdirectory deployment)
  base: '/study-notes/',

  // Build configuration
  srcDir: '.',
  outDir: './.vitepress/dist',
  cacheDir: './.vitepress/cache',

  // Clean URLs (no .html extension)
  cleanUrls: true,

  // Head tags
  head: [
    ['link', { rel: 'icon', type: 'image/svg+xml', href: '/study-notes/favicon.svg' }],
    ['meta', { name: 'theme-color', content: '#00FF9F' }],
    ['meta', { name: 'mobile-web-app-capable', content: 'yes' }],
    ['meta', { name: 'apple-mobile-web-app-status-bar-style', content: 'black-translucent' }],
    // Preconnect to Google Fonts
    ['link', { rel: 'preconnect', href: 'https://fonts.googleapis.com' }],
    ['link', { rel: 'preconnect', href: 'https://fonts.gstatic.com', crossorigin: '' }],
  ],

  // Vite configuration
  vite: {
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./theme', import.meta.url)),
      },
    },
  },

  // Disable theme toggle, force dark mode via CSS
  appearance: false,

  // Locales
  locales: {
    root: {
      label: '中文',
      lang: 'zh-CN',
      themeConfig: {
        nav: zhNav,
        sidebar: zhSidebar,

        // Chinese UI labels
        lastUpdated: {
          text: '最后更新于',
          formatOptions: {
            dateStyle: 'medium',
            timeStyle: 'short',
          },
        },
        outline: {
          level: [2, 3],
          label: '本页目录',
        },
        docFooter: {
          prev: '上一篇',
          next: '下一篇',
        },
        returnToTopLabel: '返回顶部',
        darkModeSwitchLabel: '主题',
        lightModeSwitchTitle: '切换到浅色模式',
        darkModeSwitchTitle: '切换到深色模式',
        sidebarMenuLabel: '菜单',
        langMenuLabel: '语言',
      },
    },
    ja: {
      label: '日本語',
      lang: 'ja',
      themeConfig: {
        nav: jaNav,
        sidebar: jaSidebar,

        // Japanese UI labels
        lastUpdated: {
          text: '最終更新',
          formatOptions: {
            dateStyle: 'medium',
            timeStyle: 'short',
          },
        },
        outline: {
          level: [2, 3],
          label: '目次',
        },
        docFooter: {
          prev: '前へ',
          next: '次へ',
        },
        returnToTopLabel: 'トップに戻る',
        darkModeSwitchLabel: 'テーマ',
        lightModeSwitchTitle: 'ライトモードに切り替え',
        darkModeSwitchTitle: 'ダークモードに切り替え',
        sidebarMenuLabel: 'メニュー',
        langMenuLabel: '言語',
      },
    },
  },

  // Theme configuration (shared across locales)
  themeConfig: {
    // Logo
    logo: '/logo.svg',
    siteTitle: "Chen's Study Notes",

    // Social links
    socialLinks: [{ icon: 'github', link: 'https://github.com/BlaxBerry333/' }],

    // External link icon aria label
    externalLinkIcon: true,
  },

  // Markdown configuration
  markdown: {
    lineNumbers: false,
    theme: 'vitesse-dark',
    externalLinks: {
      target: '_blank',
      rel: 'noopener noreferrer',
    },
    container: {
      tipLabel: '【提示】',
      warningLabel: '【警告】',
      dangerLabel: '【危险】',
      infoLabel: '【信息】',
      detailsLabel: '【详细信息】',
    },
    config: (md) => {
      // Wrap tables in a scrollable container for full-width display
      const defaultRender: typeof md.renderer.renderToken = (tokens, idx, options) =>
        md.renderer.renderToken(tokens, idx, options)
      const originalTableOpen = md.renderer.rules.table_open
      const originalTableClose = md.renderer.rules.table_close
      md.renderer.rules.table_open = (tokens, idx, options, env, self) => {
        const rendered = originalTableOpen
          ? originalTableOpen(tokens, idx, options, env, self)
          : defaultRender(tokens, idx, options)
        return `<div class="table-wrapper">${rendered}`
      }
      md.renderer.rules.table_close = (tokens, idx, options, env, self) => {
        const rendered = originalTableClose
          ? originalTableClose(tokens, idx, options, env, self)
          : defaultRender(tokens, idx, options)
        return `${rendered}</div>`
      }
    },
  },

  // Last updated timestamp
  lastUpdated: true,
})
