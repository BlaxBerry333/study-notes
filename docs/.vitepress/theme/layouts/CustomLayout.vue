<script setup lang="ts">
import { useData } from 'vitepress'
import DefaultTheme from 'vitepress/theme'
import BackToTop from '../components/BackToTop.vue'
import GridBackground from '../components/GridBackground.vue'
import MatrixRain from '../components/MatrixRain.vue'
import ReadingProgress from '../components/ReadingProgress.vue'
import CustomCategoryPage from '../pages/CustomCategoryPage.vue'
import CustomHomePage from '../pages/CustomHomePage.vue'
import CustomNotFoundPage from '../pages/CustomNotFoundPage.vue'
import SiteFooter from './SiteFooter.vue'

const { frontmatter, page } = useData()
</script>

<template>
  <!-- Custom homepage for layout: custom-home -->
  <template v-if="frontmatter.layout === 'custom-home'">
    <CustomHomePage />
    <SiteFooter />
    <ReadingProgress />
    <BackToTop />
    <GridBackground />
    <MatrixRain />
  </template>

  <!-- Category page for layout: custom-category -->
  <template v-else-if="frontmatter.layout === 'custom-category'">
    <CustomCategoryPage />
    <SiteFooter />
    <ReadingProgress />
    <BackToTop />
    <GridBackground />
    <MatrixRain />
  </template>

  <!-- 404 Not Found page -->
  <template v-else-if="page.isNotFound">
    <CustomNotFoundPage />
    <GridBackground />
    <MatrixRain />
  </template>

  <!-- Default layout for all other pages -->
  <template v-else>
    <DefaultTheme.Layout />
    <ReadingProgress />
    <BackToTop />
    <GridBackground />
  </template>
</template>
