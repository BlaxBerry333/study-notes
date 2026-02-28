import type { DefaultTheme } from 'vitepress'
import { PROGRAMMING_DATA_SCIENCE_SIDEBAR } from './programming-data-science'
import { PROGRAMMING_WEB_BACKEND_SIDEBAR } from './programming-web-backend'
import { PROGRAMMING_WEB_FRONTEND_SIDEBAR } from './programming-web-frontend'

export const DEFAULT_THEME_SIDEBAR: DefaultTheme.Sidebar = {
  ...PROGRAMMING_WEB_FRONTEND_SIDEBAR,
  ...PROGRAMMING_WEB_BACKEND_SIDEBAR,
  ...PROGRAMMING_DATA_SCIENCE_SIDEBAR,
}
