import type { DefaultTheme } from 'vitepress'

import { jaDataScienceSidebar } from './programming-data-science'
import { jaWebBackendSidebar } from './programming-web-backend'
import { jaWebFrontendSidebar } from './programming-web-frontend'

export const jaSidebar: DefaultTheme.Sidebar = {
  ...jaWebFrontendSidebar,
  ...jaWebBackendSidebar,
  ...jaDataScienceSidebar,
}
