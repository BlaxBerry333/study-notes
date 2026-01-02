<script setup lang="ts">
import { onMounted, onUnmounted } from 'vue'
import { useRouter, withBase } from 'vitepress'
import ActionButton from '../components/ActionButton.vue'
import SpeechBubble from '../components/SpeechBubble.vue'
import SiteFooter from '../layouts/SiteFooter.vue'

const router = useRouter()

// Force dark theme on 404 page
onMounted(() => {
  document.documentElement.classList.add('not-found-active')
})

onUnmounted(() => {
  document.documentElement.classList.remove('not-found-active')
})

// Navigate back to home
function goHome() {
  router.go(withBase('/'))
}

// Error messages in 40K Cogitator style
const ERROR_MESSAGES = [
  'MEMORY SEGMENT NOT FOUND',
  'DATA RETRIEVAL FAILURE',
  'MACHINE SPIRIT DISPLEASED.',

]
</script>

<template>
  <div class="STUDY-NOTES--not-found">
    <div class="STUDY-NOTES--not-found-container">
      <!-- 404 Code -->
      <h1 class="STUDY-NOTES--not-found-code">404</h1>

      <!-- Terminal output using SpeechBubble -->
      <br />
      <SpeechBubble :messages="ERROR_MESSAGES" :char-delay="30" :line-delay="600" />

      <!-- Action button -->
      <ActionButton @click="goHome">[RETURN TO ARCHIVES]</ActionButton>
    </div>

    <SiteFooter />
  </div>
</template>

<style scoped>
.STUDY-NOTES--not-found {
  height: 100dvh;
  height: 100vh;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: var(--STUDY-NOTES--spacing-4);
  background: var(--STUDY-NOTES--cyber-bg-start);
  color: var(--STUDY-NOTES--cyber-text-primary);
  overflow: hidden;
}

.STUDY-NOTES--not-found-container {
  text-align: center;
  max-width: 600px;
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}

/* 404 Code - 与 HomePage Hero Title 一致 */
.STUDY-NOTES--not-found-code {
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
  .STUDY-NOTES--not-found-code {
    font-size: var(--STUDY-NOTES--text-5xl);
  }
}
</style>

<!-- Non-scoped styles for html targeting -->
<style>
html.not-found-active {
  overflow: hidden;
  overscroll-behavior: none;
  color-scheme: dark;
  background: var(--STUDY-NOTES--cyber-bg-start);
}

html.not-found-active body {
  overflow: hidden;
  overscroll-behavior: none;
  background: transparent;
}

/* Hide VitePress elements on 404 page */
html.not-found-active .VPNav,
html.not-found-active .VPSidebar,
html.not-found-active .VPLocalNav {
  display: none;
}
</style>
