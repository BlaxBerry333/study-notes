<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'

const isVisible = ref(false)
const threshold = 300

function handleScroll() {
  isVisible.value = window.scrollY > threshold
}

function scrollToTop() {
  window.scrollTo({
    top: 0,
    behavior: 'smooth',
  })
}

onMounted(() => {
  window.addEventListener('scroll', handleScroll, { passive: true })
  handleScroll()
})

onUnmounted(() => {
  window.removeEventListener('scroll', handleScroll)
})
</script>

<template>
  <Transition name="STUDY-NOTES--fade">
    <button v-show="isVisible" class="STUDY-NOTES--back-to-top" type="button" aria-label="Back to top"
      @click="scrollToTop">
      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none"
        stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M18 15l-6-6-6 6" />
      </svg>
    </button>
  </Transition>
</template>

<style scoped>
.STUDY-NOTES--back-to-top {
  position: fixed;
  bottom: calc(var(--STUDY-NOTES--spacing-6) + env(safe-area-inset-bottom));
  right: var(--STUDY-NOTES--spacing-6);
  z-index: 100;

  display: flex;
  align-items: center;
  justify-content: center;
  width: 44px;
  height: 44px;

  background: var(--STUDY-NOTES--cyber-surface);
  border: 2px solid var(--STUDY-NOTES--neon-green-dim);
  border-radius: var(--STUDY-NOTES--radius-md);
  color: var(--STUDY-NOTES--neon-green-dim);

  cursor: pointer;
  transition: all var(--STUDY-NOTES--duration-normal) var(--STUDY-NOTES--ease-default);

  -webkit-backdrop-filter: blur(8px);
  backdrop-filter: blur(8px);
}

.STUDY-NOTES--back-to-top:hover {
  background: var(--STUDY-NOTES--cyber-surface-hover);
  border-color: var(--STUDY-NOTES--neon-green);
  color: var(--STUDY-NOTES--neon-green);
  box-shadow: var(--STUDY-NOTES--glow-green);
}

.STUDY-NOTES--back-to-top:active {
  transform: scale(0.95);
}

/* Fade transition */
.STUDY-NOTES--fade-enter-active,
.STUDY-NOTES--fade-leave-active {
  transition: opacity var(--STUDY-NOTES--duration-normal) var(--STUDY-NOTES--ease-default),
    transform var(--STUDY-NOTES--duration-normal) var(--STUDY-NOTES--ease-default);
}

.STUDY-NOTES--fade-enter-from,
.STUDY-NOTES--fade-leave-to {
  opacity: 0;
  transform: translateY(10px);
}

/* Reduced motion */
@media (prefers-reduced-motion: reduce) {
  .STUDY-NOTES--back-to-top {
    transition: none;
  }

  .STUDY-NOTES--fade-enter-active,
  .STUDY-NOTES--fade-leave-active {
    transition: none;
  }
}
</style>
