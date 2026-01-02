<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'

const progress = ref(0)
let ticking = false

function updateProgress() {
  const scrollTop = window.scrollY
  const docHeight = document.documentElement.scrollHeight - window.innerHeight

  if (docHeight > 0) {
    progress.value = Math.min(100, Math.max(0, (scrollTop / docHeight) * 100))
  }
  ticking = false
}

function handleScroll() {
  if (!ticking) {
    requestAnimationFrame(updateProgress)
    ticking = true
  }
}

onMounted(() => {
  window.addEventListener('scroll', handleScroll, { passive: true })
  updateProgress()
})

onUnmounted(() => {
  window.removeEventListener('scroll', handleScroll)
})
</script>

<template>
  <div class="STUDY-NOTES--reading-progress">
    <div class="STUDY-NOTES--reading-progress-bar" :style="{ width: `${progress}%` }" />
  </div>
</template>

<style scoped>
.STUDY-NOTES--reading-progress {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  z-index: 100;
  height: 3px;
  background: transparent;
}

.STUDY-NOTES--reading-progress-bar {
  height: 100%;
  background: linear-gradient(90deg,
      var(--STUDY-NOTES--neon-green-dim),
      var(--STUDY-NOTES--neon-green-glow));
  box-shadow: 0 0 8px var(--STUDY-NOTES--neon-green-glow);
  transition: width 100ms linear;
}

/* Reduced motion */
@media (prefers-reduced-motion: reduce) {
  .STUDY-NOTES--reading-progress-bar {
    transition: none;
  }
}
</style>
