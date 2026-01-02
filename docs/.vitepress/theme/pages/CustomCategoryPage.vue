<script setup lang="ts">
import { computed, onMounted, onUnmounted, watch } from 'vue'
import { useData, useRoute, useRouter, withBase } from 'vitepress'
import ActionButton from '../components/ActionButton.vue'
import ModuleCard from '../components/ModuleCard.vue'
import NeonDivider from '../components/NeonDivider.vue'
import SpeechBubble from '../components/SpeechBubble.vue'
import { data as categoryModulesData } from '../composables/useCategoryModules.data'

const { frontmatter, site } = useData()
const route = useRoute()
const router = useRouter()

// Get base path for URL matching
const base = computed(() => site.value.base || '/')

// Force dark theme on category page + lock scroll on state page
onMounted(() => {
  document.documentElement.classList.add('category-page-active')

  // Lock scroll when showing state page
  if (isStatePage.value) {
    document.documentElement.classList.add('category-state-active')
  }
  watch(isStatePage, (value) => {
    if (value) {
      document.documentElement.classList.add('category-state-active')
    } else {
      document.documentElement.classList.remove('category-state-active')
    }
  })
})

onUnmounted(() => {
  document.documentElement.classList.remove('category-page-active')
  document.documentElement.classList.remove('category-state-active')
})

// Navigate back to home
function goHome() {
  router.go(withBase('/'))
}

// Text constants
const TEXT = {
  RESTRICTED: {
    TITLE: 'CLASSIFIED',
    SPEECH: ['ACCESS DENIED.', 'CLEARANCE LEVEL INSUFFICIENT.'],
  },
  EMPTY: {
    SPEECH: ['NO DATA NODES DETECTED.', 'AWAITING DATA UPLOAD...'],
  },
}

// Get data from frontmatter
const title = computed(() => frontmatter.value.title || 'UNTITLED')
const description = computed(() => frontmatter.value.description || '')
const restricted = computed(() => frontmatter.value.restricted === true)

// Auto-detect modules from data loader based on current path
const modules = computed(() => {
  // Get current path and remove base prefix for matching
  let currentPath = route.path
  const basePrefix = base.value.endsWith('/') ? base.value.slice(0, -1) : base.value
  if (basePrefix !== '' && currentPath.startsWith(basePrefix)) {
    currentPath = currentPath.slice(basePrefix.length)
  }
  // Ensure path ends with /
  if (!currentPath.endsWith('/')) {
    currentPath += '/'
  }
  // Return modules for this category, or empty array
  return categoryModulesData[currentPath] || []
})

// Check if showing state page (empty or restricted)
const isStatePage = computed(() => restricted.value || modules.value.length === 0)

</script>

<template>
  <!-- Restricted State -->
  <div v-if="restricted" class="STUDY-NOTES--category-page STUDY-NOTES--category-state">
    <div class="STUDY-NOTES--state-container">
      <h1 class="STUDY-NOTES--state-code STUDY-NOTES--state-code-restricted">
        <span>{{ TEXT.RESTRICTED.TITLE }}</span>
      </h1>
      <br />
      <SpeechBubble :messages="TEXT.RESTRICTED.SPEECH" :char-delay="30" :line-delay="600" />
      <br />
      <ActionButton variant="danger" @click="goHome">[RETURN TO ARCHIVES]</ActionButton>
    </div>
  </div>

  <!-- Empty State -->
  <div v-else-if="modules.length === 0" class="STUDY-NOTES--category-page STUDY-NOTES--category-state">
    <div class="STUDY-NOTES--state-container">
      <h1 class="STUDY-NOTES--state-code">
        <span>{{ title.toUpperCase() }}</span>
        <NeonDivider />
      </h1>
      <br />
      <SpeechBubble :messages="TEXT.EMPTY.SPEECH" :char-delay="30" :line-delay="600" />
      <br />
      <ActionButton @click="goHome">[RETURN TO ARCHIVES]</ActionButton>
    </div>
  </div>

  <!-- Normal State with Modules -->
  <div v-else class="STUDY-NOTES--category-page">
    <!-- Compact Header -->
    <header class="STUDY-NOTES--category-header">
      <h1 class="STUDY-NOTES--category-title">
        {{ title.toUpperCase() }}
        <NeonDivider />
      </h1>
      <p class="STUDY-NOTES--category-desc">{{ description }}</p>
    </header>
    <br />
    <!-- Modules Grid - Main Content -->
    <main class="STUDY-NOTES--category-main">
      <div class="STUDY-NOTES--module-grid">
        <ModuleCard v-for="mod in modules" :key="mod.link" :text="mod.text" :link="mod.link" />
      </div>
    </main>
  </div>
</template>

<style scoped>
.STUDY-NOTES--category-page {
  min-height: 100dvh;
  color: var(--STUDY-NOTES--cyber-text-primary);
  font-family: var(--STUDY-NOTES--font-mono);
  position: relative;
  overscroll-behavior: none;
  padding: var(--STUDY-NOTES--spacing-8) var(--STUDY-NOTES--spacing-4);
  padding-top: calc(var(--STUDY-NOTES--spacing-8) + 60px);
  /* Account for hidden nav space */
}

@media (min-width: 768px) {
  .STUDY-NOTES--category-page {
    padding: var(--STUDY-NOTES--spacing-12) var(--STUDY-NOTES--spacing-8);
    padding-top: calc(var(--STUDY-NOTES--spacing-12) + 60px);
  }
}

@media (min-width: 1024px) {
  .STUDY-NOTES--category-page {
    max-width: 1200px;
    margin: 0 auto;
  }
}

/* ============================================
 * Compact Header - Just a hint, not a full screen
 * ============================================ */

.STUDY-NOTES--category-header {
  position: relative;
  z-index: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  gap: var(--STUDY-NOTES--spacing-3);
  margin-bottom: var(--STUDY-NOTES--spacing-8);
}

@media (min-width: 1024px) {
  .STUDY-NOTES--category-header {
    text-align: left;
    align-items: flex-start;
    margin-bottom: var(--STUDY-NOTES--spacing-10);
  }
}

/* Title */
.STUDY-NOTES--category-title {
  font-family: var(--STUDY-NOTES--font-display);
  font-size: var(--STUDY-NOTES--text-2xl);
  font-weight: var(--STUDY-NOTES--font-bold);
  color: var(--STUDY-NOTES--cyber-text-primary);
  text-shadow: var(--STUDY-NOTES--text-glow-green);
  letter-spacing: 0.05em;
  line-height: var(--STUDY-NOTES--leading-tight);
  margin: 0;
  display: flex;
  flex-direction: column;
}

@media (min-width: 1024px) {
  .STUDY-NOTES--category-title {
    font-size: var(--STUDY-NOTES--text-3xl);
  }
}

/* Description */
.STUDY-NOTES--category-desc {
  font-family: var(--STUDY-NOTES--font-mono);
  font-size: var(--STUDY-NOTES--text-sm);
  color: var(--STUDY-NOTES--neon-green-dim);
  letter-spacing: 0.05em;
  margin: 0;
}

/* ============================================
 * Main Content - Modules as the primary focus
 * ============================================ */

.STUDY-NOTES--category-main {
  position: relative;
  z-index: 1;
}

/* ============================================
 * Module Grid
 * ============================================ */

.STUDY-NOTES--module-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: var(--STUDY-NOTES--spacing-3);
}

@media (min-width: 640px) {
  .STUDY-NOTES--module-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}

@media (min-width: 960px) {
  .STUDY-NOTES--module-grid {
    grid-template-columns: repeat(3, 1fr);
  }
}

/* ============================================
 * Empty/Restricted State - 404-like layout
 * ============================================ */

.STUDY-NOTES--category-state {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: var(--STUDY-NOTES--spacing-4);
  /* Leave space for footer */
  min-height: calc(100dvh - 80px);
}

.STUDY-NOTES--state-container {
  text-align: center;
  max-width: 600px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--STUDY-NOTES--spacing-4);
}

.STUDY-NOTES--state-code {
  font-family: var(--STUDY-NOTES--font-display);
  font-size: var(--STUDY-NOTES--text-3xl);
  font-weight: var(--STUDY-NOTES--font-bold);
  color: var(--STUDY-NOTES--cyber-text-primary);
  text-shadow: var(--STUDY-NOTES--text-glow-green);
  letter-spacing: 0.05em;
  line-height: var(--STUDY-NOTES--leading-tight);
  margin: 0;
}

@media (min-width: 1024px) {
  .STUDY-NOTES--state-code {
    font-size: var(--STUDY-NOTES--text-5xl);
  }
}

/* Restricted State - Red Theme */
.STUDY-NOTES--state-code-restricted {
  color: var(--STUDY-NOTES--color-error);
  text-shadow: var(--STUDY-NOTES--text-glow-red);
}


/* Restricted SpeechBubble - Red Theme */
.STUDY-NOTES--category-state:has(.STUDY-NOTES--state-code-restricted) :deep(.STUDY-NOTES--bubble) {
  color: var(--STUDY-NOTES--color-error);
}

.STUDY-NOTES--category-state:has(.STUDY-NOTES--state-code-restricted) :deep(.STUDY-NOTES--bubble-cursor) {
  background: var(--STUDY-NOTES--color-error);
}
</style>

<!-- Global styles for category page -->
<style>
html.category-page-active {
  color-scheme: dark;
  overscroll-behavior: none;
  scroll-behavior: smooth;
  background: var(--STUDY-NOTES--cyber-bg-start);
}

html.category-page-active body {
  overscroll-behavior: none;
}

html.category-page-active,
html.category-page-active .VPContent {
  --vp-c-bg: var(--STUDY-NOTES--cyber-bg-start);
  --vp-c-bg-soft: var(--STUDY-NOTES--cyber-bg-end);
  --vp-c-text-1: var(--STUDY-NOTES--cyber-text-primary);
  --vp-c-text-2: var(--STUDY-NOTES--cyber-text-secondary);
  --vp-c-text-3: var(--STUDY-NOTES--cyber-text-muted);
}

/* Hide VitePress nav on category page */
html.category-page-active .VPNav {
  display: none;
}

/* Lock scroll on state page (empty/restricted) */
html.category-state-active,
html.category-state-active body {
  overflow: hidden;
}
</style>
