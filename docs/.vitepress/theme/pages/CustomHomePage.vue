<script setup lang="ts">
import { onMounted, onUnmounted } from 'vue'
import CategoryCard from '../components/CategoryCard.vue'
import NeonDivider from '../components/NeonDivider.vue'
import SpeechBubble from '../components/SpeechBubble.vue'

// Disable overscroll bounce and force dark theme on homepage
onMounted(() => {
  document.documentElement.classList.add('homepage-active')
})

onUnmounted(() => {
  document.documentElement.classList.remove('homepage-active')
})

// Text constants
const TEXT = {
  HERO: {
    TITLE: ["Chen's", 'STUDY NOTES'],
    SUBTITLE: 'KNOWLEDGE ARCHIVE NODES',
    SPEECH: [
      'MACHINE SPIRIT AWAKENED.',
      'MEMORY FRAGMENTS RESTORED.',
      'KNOWLEDGE ARCHIVES LOADING...',
      'GOOD HUNTING IN THE ARCHIVES.',
    ],
  },
  CATEGORY: {
    TITLE: 'KNOWLEDGE MODULES',
    SPEECH: [
      'KNOWLEDGE ARCHIVES UNSEALED.',
      'RITES COMPLETE. DATA FLOWS.',
    ],
  },
}

// Categories for homepage cards
const CATEGORIES = [
  { title: 'Web Frontend', link: '/programming/web-frontend/' },
  { title: 'Web Backend', link: '/programming/web-backend/' },
  { title: 'Data Science', link: '/programming/data-science/' },
  { title: 'Japanese', link: '/foreign-languages/japanese/', restricted: true },
  { title: 'English', link: '/foreign-languages/english/', restricted: true },
]
</script>

<template>
  <div class="STUDY-NOTES--homepage">
    <!-- Hero Section -->
    <section class="STUDY-NOTES--homepage-section STUDY-NOTES--hero-section">
      <h1 class="STUDY-NOTES--text-title">
        <span>{{ TEXT.HERO.TITLE[0] }}</span>
        <span>{{ TEXT.HERO.TITLE[1] }}</span>
        <NeonDivider />
      </h1>
      <p class="STUDY-NOTES--text-body">{{ TEXT.HERO.SUBTITLE }}</p>
      <br />
      <SpeechBubble :messages="TEXT.HERO.SPEECH" :char-delay="40" :line-delay="800" />
    </section>

    <!-- Category Section -->
    <section class="STUDY-NOTES--homepage-section STUDY-NOTES--category-section">
      <h1 class="STUDY-NOTES--text-subtitle">
        {{ TEXT.CATEGORY.TITLE }}
      </h1>
      <br />
      <SpeechBubble :messages="TEXT.CATEGORY.SPEECH" :char-delay="40" :line-delay="800" />
      <br />
      <div class="STUDY-NOTES--category-grid">
        <CategoryCard v-for="cat in CATEGORIES" :key="cat.link" v-bind="cat" />
      </div>
    </section>

    <!-- Placeholder -->
    <div style="height: 20dvh" />
  </div>
</template>

<style scoped>
/* Homepage Container - Force Dark Theme */
.STUDY-NOTES--homepage {
  --vp-c-bg: var(--STUDY-NOTES--cyber-bg-start);
  --vp-c-bg-soft: var(--STUDY-NOTES--cyber-bg-end);
  --vp-c-text-1: var(--STUDY-NOTES--cyber-text-primary);
  --vp-c-text-2: var(--STUDY-NOTES--cyber-text-secondary);
  --vp-c-text-3: var(--STUDY-NOTES--cyber-text-muted);

  min-height: 100dvh;
  min-height: 100vh;
  color: var(--STUDY-NOTES--cyber-text-primary);
  color-scheme: dark;

  /* Disable overscroll bounce effect */
  overscroll-behavior: none;
}

/* Homepage Section - 公共样式 */
.STUDY-NOTES--homepage-section {
  position: relative;
  z-index: 1;
  min-height: 100dvh;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  gap: var(--STUDY-NOTES--spacing-4);
  padding: var(--STUDY-NOTES--spacing-4);
  overflow: hidden;
}

@media (min-width: 1024px) {
  .STUDY-NOTES--homepage-section {
    text-align: left;

    >* {
      max-width: 480px;
    }
  }
}

/* ============================================
 * Typography - 统一文字样式
 * ============================================ */

/* Title - 主标题（最大） */
.STUDY-NOTES--text-title {
  font-family: var(--STUDY-NOTES--font-display);
  font-size: var(--STUDY-NOTES--text-3xl);
  font-weight: var(--STUDY-NOTES--font-bold);
  color: var(--STUDY-NOTES--cyber-text-primary);
  text-shadow: var(--STUDY-NOTES--text-glow-green);
  letter-spacing: 0.05em;
  line-height: var(--STUDY-NOTES--leading-tight);
  /* 使内部 span 垂直堆叠 */
  display: flex;
  flex-direction: column;
}

.STUDY-NOTES--text-title span {
  display: block;
}

@media (min-width: 1024px) {
  .STUDY-NOTES--text-title {
    font-size: var(--STUDY-NOTES--text-5xl);
  }
}

/* Subtitle - 副标题（中等） */
.STUDY-NOTES--text-subtitle {
  font-family: var(--STUDY-NOTES--font-display);
  font-size: var(--STUDY-NOTES--text-xl);
  color: var(--STUDY-NOTES--cyber-text-primary);
  text-shadow: var(--STUDY-NOTES--text-glow-green);
  letter-spacing: 0.1em;
}

@media (min-width: 1024px) {
  .STUDY-NOTES--text-subtitle {
    font-size: var(--STUDY-NOTES--text-2xl);
  }
}

/* Body - 正文描述 */
.STUDY-NOTES--text-body {
  font-family: var(--STUDY-NOTES--font-display);
  font-size: var(--STUDY-NOTES--text-base);
  color: var(--STUDY-NOTES--cyber-text-secondary);
}

@media (min-width: 1024px) {
  .STUDY-NOTES--text-body {
    font-size: var(--STUDY-NOTES--text-lg);
  }
}

/* Caption - 说明文字（最小） */
.STUDY-NOTES--text-caption {
  font-family: var(--STUDY-NOTES--font-mono);
  font-size: var(--STUDY-NOTES--text-sm);
  color: var(--STUDY-NOTES--neon-green);
  letter-spacing: 0.15em;
}


.STUDY-NOTES--category-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: var(--STUDY-NOTES--spacing-5);
  max-width: var(--STUDY-NOTES--max-width-content);
  margin: 0 auto;
}

/* Tablet: 2 columns */
@media (min-width: 768px) {
  .STUDY-NOTES--category-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}

/* Desktop: 3 columns */
@media (min-width: 1024px) {
  .STUDY-NOTES--category-grid {
    grid-template-columns: repeat(3, 1fr);
  }
}

/* Large Desktop: 4 columns */
@media (min-width: 1440px) {
  .STUDY-NOTES--category-grid {
    grid-template-columns: repeat(4, 1fr);
  }
}
</style>

<!-- Non-scoped styles for html/body targeting -->
<style>
/* ============================================
 * Homepage Specific Styles
 * When homepage is active: disable overscroll bounce and force dark theme
 * ============================================ */

html.homepage-active {
  overscroll-behavior: none;
  color-scheme: dark;
  scroll-behavior: smooth;
  background: var(--STUDY-NOTES--cyber-bg-start);
}

html.homepage-active body {
  overscroll-behavior: none;
  background: transparent;
}

/* Force dark theme on homepage regardless of VitePress theme setting */
html.homepage-active,
html.homepage-active .VPContent {
  --vp-c-bg: var(--STUDY-NOTES--cyber-bg-start);
  --vp-c-bg-soft: var(--STUDY-NOTES--cyber-bg-end);
  --vp-c-text-1: var(--STUDY-NOTES--cyber-text-primary);
  --vp-c-text-2: var(--STUDY-NOTES--cyber-text-secondary);
  --vp-c-text-3: var(--STUDY-NOTES--cyber-text-muted);
}
</style>
