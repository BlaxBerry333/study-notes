import type { ContentData } from 'vitepress'
import { createContentLoader } from 'vitepress'

export interface ModuleData {
  text: string
  link: string
  description?: string
}

export interface CategoryModulesData {
  [categoryPath: string]: ModuleData[]
}

declare const data: CategoryModulesData
export { data }

// Load all markdown files and group them by category
export default createContentLoader('**/*.md', {
  transform(rawData: ContentData[]): CategoryModulesData {
    const result: CategoryModulesData = {}

    for (const page of rawData) {
      const { url, frontmatter } = page

      // Normalize URL - remove trailing slash if present
      const normalizedUrl = url.endsWith('/') ? url.slice(0, -1) : url

      // Split into parts
      const parts = normalizedUrl.split('/').filter(Boolean)

      // Need at least 3 levels: /category/subcategory/module
      // e.g., /programming/data-science/sql
      if (parts.length < 3) continue

      // Skip category index pages (layout: custom-category)
      if (frontmatter.layout === 'custom-category') continue

      // Get the parent path as category (e.g., /programming/data/)
      const categoryPath = `/${parts.slice(0, -1).join('/')}/`

      // Get module name from last part of URL
      const moduleName = parts[parts.length - 1]

      // Initialize category array if not exists
      if (!result[categoryPath]) {
        result[categoryPath] = []
      }

      // Use frontmatter title or fallback to module name
      const title = frontmatter.title || moduleName.toUpperCase()

      result[categoryPath].push({
        text: title,
        link: normalizedUrl.startsWith('/') ? normalizedUrl : `/${normalizedUrl}`,
        description: frontmatter.description,
      })
    }

    // Sort modules alphabetically within each category
    for (const category in result) {
      result[category].sort((a, b) => a.text.localeCompare(b.text))
    }

    return result
  },
})
