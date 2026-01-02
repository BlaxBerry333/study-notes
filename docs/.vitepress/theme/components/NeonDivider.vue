<script setup lang="ts">
withDefaults(
  defineProps<{
    width?: string
    height?: string
  }>(),
  {
    width: '60%',
    height: '2px',
  }
)
</script>

<template>
  <div
    class="STUDY-NOTES--neon-divider"
    :style="{ width, height }"
  />
</template>

<style scoped>
.STUDY-NOTES--neon-divider {
  background: linear-gradient(90deg, transparent, var(--STUDY-NOTES--neon-green), transparent);
  margin-top: var(--STUDY-NOTES--spacing-2);
  margin-bottom: 0;
  margin-left: auto;
  margin-right: auto;
}

@media (min-width: 1024px) {
  .STUDY-NOTES--neon-divider {
    margin-left: 0;
  }
}
</style>
