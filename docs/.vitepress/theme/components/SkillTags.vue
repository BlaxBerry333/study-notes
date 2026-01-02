<script setup lang="ts">
defineProps<{
  skills: string[]
}>()
</script>

<template>
  <div class="STUDY-NOTES--skill-tags">
    <span v-for="skill in skills" :key="skill" class="STUDY-NOTES--skill-tag">
      {{ skill }}
    </span>
  </div>
</template>

<style scoped>
.STUDY-NOTES--skill-tags {
  display: flex;
  flex-wrap: nowrap;
  gap: var(--STUDY-NOTES--spacing-2);
  overflow-x: auto;
  padding: var(--STUDY-NOTES--spacing-2) 0;
  -webkit-overflow-scrolling: touch;
  scrollbar-width: none;
  max-width: 100%;
}

.STUDY-NOTES--skill-tags::-webkit-scrollbar {
  display: none;
}

@media (min-width: 1024px) {
  .STUDY-NOTES--skill-tags {
    flex-wrap: wrap;
    justify-content: flex-start;
    overflow-x: visible;
    max-width: 500px;
  }
}

.STUDY-NOTES--skill-tag {
  display: inline-flex;
  align-items: center;
  padding: var(--STUDY-NOTES--spacing-2) var(--STUDY-NOTES--spacing-3);
  background: var(--STUDY-NOTES--cyber-surface);
  border: 1px solid var(--STUDY-NOTES--cyber-border);
  border-radius: var(--STUDY-NOTES--radius-full);
  font-family: var(--STUDY-NOTES--font-mono);
  font-size: var(--STUDY-NOTES--text-sm);
  color: var(--STUDY-NOTES--neon-green);
  white-space: nowrap;
  transition: all 0.2s ease;
}

/* Hover - Desktop only */
@media (hover: hover) {
  .STUDY-NOTES--skill-tag:hover {
    border-color: var(--STUDY-NOTES--neon-green);
    box-shadow: var(--STUDY-NOTES--glow-green);
    transform: translateY(-2px);
  }
}

/* Touch state */
.STUDY-NOTES--skill-tag:active {
  transform: scale(0.95);
  background: var(--STUDY-NOTES--cyber-surface-hover);
}
</style>
