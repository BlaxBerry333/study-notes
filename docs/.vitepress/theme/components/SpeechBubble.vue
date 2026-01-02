<script setup lang="ts">
import { computed } from 'vue'
import { useTypewriter } from '../composables/useTypewriter'

const props = withDefaults(
  defineProps<{
    messages: string[]
    charDelay?: number
    lineDelay?: number
    loop?: boolean
  }>(),
  {
    charDelay: 40,
    lineDelay: 800,
    loop: false,
  }
)

const { displayLines, currentLineText, isTyping } = useTypewriter({
  messages: props.messages,
  charDelay: props.charDelay,
  lineDelay: props.lineDelay,
  loop: props.loop,
})

// Calculate fixed height based on number of messages to prevent layout shift
// Each line is approximately 1.5em + spacing-1 (4px) ≈ 28px
const containerHeight = computed(() => {
  const lineHeight = 28 // approximate height per line in px
  return `${props.messages.length * lineHeight}px`
})
</script>

<template>
  <div class="STUDY-NOTES--speech-container" :style="{ height: containerHeight }">
    <div class="STUDY-NOTES--bubble">
    <div v-for="(line, index) in displayLines" :key="index" class="STUDY-NOTES--bubble-line">
      {{ line }}
    </div>
    <div v-if="isTyping || currentLineText" class="STUDY-NOTES--bubble-line">
      {{ currentLineText }}<span class="STUDY-NOTES--bubble-cursor" />
    </div>
    </div>
  </div>
</template>

<style scoped>
/* Fixed size container to prevent layout shift */
.STUDY-NOTES--speech-container {
  display: flex;
  align-items: flex-start;
  /* Fixed width to ensure left alignment */
  width: 320px;
}

@media (min-width: 1024px) {
  .STUDY-NOTES--speech-container {
    width: 420px;
  }
}

.STUDY-NOTES--bubble {
  font-family: var(--STUDY-NOTES--font-mono);
  font-size: var(--STUDY-NOTES--text-sm);
  color: var(--STUDY-NOTES--neon-green);
  text-align: left;
  width: 100%;
}

.STUDY-NOTES--bubble-line {
  margin-bottom: var(--STUDY-NOTES--spacing-1);
  min-height: 1.5em;
}

.STUDY-NOTES--bubble-line::before {
  content: ">> ";
  opacity: 0.6;
}

.STUDY-NOTES--bubble-cursor {
  display: inline-block;
  width: 8px;
  height: 1.2em;
  background: var(--STUDY-NOTES--neon-green);
  animation: STUDY-NOTES--cursor-blink 1s step-end infinite;
  vertical-align: middle;
  margin-left: 2px;
}

@keyframes STUDY-NOTES--cursor-blink {
  50% {
    opacity: 0;
  }
}

@media (prefers-reduced-motion: reduce) {
  .STUDY-NOTES--bubble-cursor {
    animation: none;
  }
}
</style>
