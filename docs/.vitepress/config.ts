import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vitepress'

import pkg from '../../package.json'
import { DEFAULT_THEME_NAV } from './default-theme-configs/nav'
import { DEFAULT_THEME_SIDEBAR } from './default-theme-configs/sidebar'

export default defineConfig({
  // Site metadata
  title: "Chen's Study Notes",
  titleTemplate: ":title - Chen's Study Notes",
  description: pkg.description,
  lang: 'zh-CN',

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

  // Theme configuration
  themeConfig: {
    // Logo
    logo: '/logo.svg',
    siteTitle: "Chen's Study Notes",

    // Navigation
    nav: DEFAULT_THEME_NAV,

    // Sidebar
    sidebar: DEFAULT_THEME_SIDEBAR,

    // Social links
    socialLinks: [{ icon: 'github', link: 'https://github.com/BlaxBerry333/' }],

    // Footer
    // footer: {
    //   message: 'All rights reserved.',
    //   copyright: "Copyright © 2024 Chen's Study Notes",
    // },

    // Edit link (optional, update with your repo)
    // editLink: {
    //   pattern: 'https://github.com/chen/study-notes/edit/main/docs/:path',
    //   text: 'Edit this page on GitHub'
    // },

    // Last updated
    lastUpdated: {
      text: '最后更新于',
      formatOptions: {
        dateStyle: 'medium',
        timeStyle: 'short',
      },
    },

    // Outline
    outline: {
      level: [2, 3],
      label: '本页目录',
    },

    // Doc footer
    docFooter: {
      prev: '上一篇',
      next: '下一篇',
    },

    // Return to top
    returnToTopLabel: '返回顶部',

    // Dark mode switch
    darkModeSwitchLabel: '主题',
    lightModeSwitchTitle: '切换到浅色模式',
    darkModeSwitchTitle: '切换到深色模式',

    // Sidebar menu
    sidebarMenuLabel: '菜单',

    // Language menu
    langMenuLabel: '语言',

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
  },

  // Last updated timestamp
  lastUpdated: true,
})
