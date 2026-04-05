import type { DefaultTheme } from 'vitepress'

import { zhDataScienceSidebar } from './programming-data-science'
import { zhWebBackendSidebar } from './programming-web-backend'
import { zhWebFrontendSidebar } from './programming-web-frontend'

export const zhSidebar: DefaultTheme.Sidebar = {
  ...zhWebFrontendSidebar,
  ...zhWebBackendSidebar,
  ...zhDataScienceSidebar,
}
