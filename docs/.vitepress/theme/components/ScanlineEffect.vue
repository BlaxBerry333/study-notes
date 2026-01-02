<script setup lang="ts">
// Scanline animation effect for cyberpunk aesthetic
</script>

<template>
  <div class="STUDY-NOTES--scanline" aria-hidden="true" />
</template>

<style scoped>
.STUDY-NOTES--scanline {
  position: absolute;
  width: 100%;
  height: 4px;
  background: linear-gradient(90deg, transparent, var(--STUDY-NOTES--neon-green-glow), transparent);
  animation: STUDY-NOTES--scanline 8s linear infinite;
  opacity: 0.6;
  pointer-events: none;
}

@keyframes STUDY-NOTES--scanline {
  0% {
    transform: translateY(-100vh);
  }
  100% {
    transform: translateY(100vh);
  }
}

@media (prefers-reduced-motion: reduce) {
  .STUDY-NOTES--scanline {
    animation: none;
    opacity: 0;
  }
}
</style>
