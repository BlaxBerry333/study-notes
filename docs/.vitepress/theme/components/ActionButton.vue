<script setup lang="ts">
defineProps<{
  variant?: 'default' | 'danger'
}>()

defineEmits<{
  click: []
}>()
</script>

<template>
  <button
    class="STUDY-NOTES--action-btn"
    :class="{ 'STUDY-NOTES--action-btn-danger': variant === 'danger' }"
    @click="$emit('click')"
  >
    <slot />
  </button>
</template>

<style scoped>
.STUDY-NOTES--action-btn {
  font-family: var(--STUDY-NOTES--font-mono);
  font-size: 14px;
  background: transparent;
  border: 1px solid var(--STUDY-NOTES--cyber-border);
  color: var(--STUDY-NOTES--neon-green-dim);
  padding: var(--STUDY-NOTES--spacing-3) var(--STUDY-NOTES--spacing-6);
  cursor: pointer;
  transition: all var(--STUDY-NOTES--duration-normal) var(--STUDY-NOTES--ease-default);
  letter-spacing: 0.1em;
}

.STUDY-NOTES--action-btn:hover {
  border-color: var(--STUDY-NOTES--neon-green);
  color: #ffffff;
  text-shadow: var(--STUDY-NOTES--text-glow-green-sm);
  box-shadow: var(--STUDY-NOTES--glow-green);
}

.STUDY-NOTES--action-btn:active {
  transform: scale(0.98);
}

/* Danger variant - Red theme */
.STUDY-NOTES--action-btn-danger {
  border-color: rgba(255, 51, 51, 0.3);
  color: rgba(255, 51, 51, 0.8);
}

.STUDY-NOTES--action-btn-danger:hover {
  border-color: var(--STUDY-NOTES--color-error);
  color: #ffffff;
  text-shadow: var(--STUDY-NOTES--text-glow-red);
  box-shadow: 0 0 20px rgba(255, 51, 51, 0.3);
}
</style>
