import type { DefaultTheme } from 'vitepress'

export const jaNav: DefaultTheme.NavItem[] = [
  { text: 'Home', link: '/ja/' },
  {
    text: 'Programming',
    items: [
      { text: 'Web Frontend', link: '/ja/programming/web-frontend/' },
      { text: 'Web Backend', link: '/ja/programming/web-backend/' },
      { text: 'Data Science', link: '/ja/programming/data-science/' },
    ],
  },
]
