<script setup lang="ts">
const currentYear = new Date().getFullYear()

const TEXT = {
  RIGHTS: 'All rights reserved.',
  COPYRIGHT: `Copyright © ${currentYear} Chen's Study Notes.`,
}
</script>

<template>
  <footer class="STUDY-NOTES--footer">
    <p class="STUDY-NOTES--footer-text">{{ TEXT.RIGHTS }}</p>
    <p class="STUDY-NOTES--footer-text">{{ TEXT.COPYRIGHT }}</p>
  </footer>
</template>

<style scoped>
.STUDY-NOTES--footer {
  position: relative;
  z-index: 1;
  padding: var(--STUDY-NOTES--spacing-4);
  padding-bottom: calc(var(--STUDY-NOTES--spacing-4) + env(safe-area-inset-bottom));
  text-align: center;
}

.STUDY-NOTES--footer-text {
  font-family: var(--STUDY-NOTES--font-mono);
  font-size: var(--STUDY-NOTES--text-sm);
  color: var(--STUDY-NOTES--neon-green-glow);
}
</style>
