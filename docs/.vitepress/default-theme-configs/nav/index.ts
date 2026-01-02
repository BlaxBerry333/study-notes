import type { DefaultTheme } from 'vitepress'

export const DEFAULT_THEME_NAV: DefaultTheme.NavItem[] = [
  { text: 'Home', link: '/' },
  {
    text: 'Programming',
    items: [
      { text: 'Web Frontend', link: '/programming/web-frontend/' },
      { text: 'Web Backend', link: '/programming/web-backend/' },
      { text: 'Data Science', link: '/programming/data-science/' },
    ],
  },
]
