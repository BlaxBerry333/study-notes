// Custom theme extending VitePress default theme

import type { Theme } from 'vitepress'
import DefaultTheme from 'vitepress/theme'

// Styles
import './styles/vars.css'
import './styles/base.css'
import './styles/doc.css'

// Custom Layout
import CustomLayout from './layouts/CustomLayout.vue'

const theme: Theme = {
  extends: DefaultTheme,
  Layout: CustomLayout,
  enhanceApp({ router }) {
    // Force dark mode - add .dark class to html element
    if (typeof document !== 'undefined') {
      document.documentElement.classList.add('dark')
    }

    // Ensure dark class persists on route changes
    router.onAfterRouteChange = () => {
      if (typeof document !== 'undefined') {
        document.documentElement.classList.add('dark')
      }
    }
  },
}

export default theme
