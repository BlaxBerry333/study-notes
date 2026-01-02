<script setup lang="ts">
import { withBase } from 'vitepress'

defineProps<{
  text: string
  link: string
}>()
</script>

<template>
  <a :href="withBase(link)" class="STUDY-NOTES--module-card">
    <span class="STUDY-NOTES--module-icon">&gt;</span>
    <span class="STUDY-NOTES--module-name">{{ text.toUpperCase() }}</span>
    <span class="STUDY-NOTES--module-arrow">&gt;&gt;</span>
  </a>
</template>

<style scoped>
.STUDY-NOTES--module-card {
  display: flex;
  align-items: center;
  gap: var(--STUDY-NOTES--spacing-3);
  padding: var(--STUDY-NOTES--spacing-4) var(--STUDY-NOTES--spacing-5);
  background: rgba(10, 10, 15, 0.6);
  backdrop-filter: blur(8px);
  border: 1px solid var(--STUDY-NOTES--cyber-border);
  text-decoration: none;
  transition: all var(--STUDY-NOTES--duration-normal) var(--STUDY-NOTES--ease-default);
}

.STUDY-NOTES--module-icon {
  font-size: 12px;
  color: var(--STUDY-NOTES--neon-green-dim);
  opacity: 0.5;
  transition: all var(--STUDY-NOTES--duration-normal) var(--STUDY-NOTES--ease-default);
}

.STUDY-NOTES--module-name {
  flex: 1;
  font-size: 13px;
  font-weight: bold;
  color: var(--STUDY-NOTES--neon-green-dim);
  letter-spacing: 0.05em;
  transition: all var(--STUDY-NOTES--duration-normal) var(--STUDY-NOTES--ease-default);
}

.STUDY-NOTES--module-arrow {
  font-size: 11px;
  color: var(--STUDY-NOTES--neon-green-dim);
  opacity: 0;
  transform: translateX(-8px);
  transition: all var(--STUDY-NOTES--duration-normal) var(--STUDY-NOTES--ease-default);
}

@media (hover: hover) {
  .STUDY-NOTES--module-card:hover {
    border-color: var(--STUDY-NOTES--neon-green-dim);
    background: var(--STUDY-NOTES--cyber-surface-hover);
    box-shadow: 0 0 20px var(--STUDY-NOTES--neon-green-glow);
  }

  .STUDY-NOTES--module-card:hover .STUDY-NOTES--module-icon {
    opacity: 1;
    color: var(--STUDY-NOTES--neon-green);
  }

  .STUDY-NOTES--module-card:hover .STUDY-NOTES--module-name {
    color: #ffffff;
    text-shadow: var(--STUDY-NOTES--text-glow-green-sm);
  }

  .STUDY-NOTES--module-card:hover .STUDY-NOTES--module-arrow {
    opacity: 1;
    transform: translateX(0);
    color: var(--STUDY-NOTES--neon-green);
  }
}

.STUDY-NOTES--module-card:active {
  background: var(--STUDY-NOTES--cyber-surface-hover);
  box-shadow: 0 0 20px var(--STUDY-NOTES--neon-green-glow);
}
</style>
