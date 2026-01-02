import { onMounted, onUnmounted, ref } from 'vue'

export interface UseTypewriterOptions {
  messages: string[]
  charDelay?: number
  lineDelay?: number
  loop?: boolean
  startDelay?: number
}

export function useTypewriter(options: UseTypewriterOptions) {
  const { messages, charDelay = 40, lineDelay = 800, loop = false, startDelay = 500 } = options

  const displayLines = ref<string[]>([])
  const currentLineText = ref('')
  const isTyping = ref(false)
  const currentLineIndex = ref(0)
  const isComplete = ref(false)

  let timeoutId: ReturnType<typeof setTimeout> | null = null
  let charIndex = 0

  const typeNextChar = () => {
    const currentMessage = messages[currentLineIndex.value]

    if (charIndex < currentMessage.length) {
      currentLineText.value += currentMessage[charIndex]
      charIndex++
      timeoutId = setTimeout(typeNextChar, charDelay)
    } else {
      // Line complete
      displayLines.value = [...displayLines.value, currentLineText.value]
      currentLineText.value = ''
      charIndex = 0

      if (currentLineIndex.value < messages.length - 1) {
        // Move to next line
        currentLineIndex.value++
        timeoutId = setTimeout(typeNextChar, lineDelay)
      } else {
        // All lines complete
        isTyping.value = false
        isComplete.value = true

        if (loop) {
          timeoutId = setTimeout(() => {
            reset()
            start()
          }, lineDelay * 2)
        }
      }
    }
  }

  const start = () => {
    if (isTyping.value) return

    isTyping.value = true
    isComplete.value = false
    timeoutId = setTimeout(typeNextChar, startDelay)
  }

  const stop = () => {
    if (timeoutId) {
      clearTimeout(timeoutId)
      timeoutId = null
    }
    isTyping.value = false
  }

  const reset = () => {
    stop()
    displayLines.value = []
    currentLineText.value = ''
    currentLineIndex.value = 0
    charIndex = 0
    isComplete.value = false
  }

  onMounted(() => {
    start()
  })

  onUnmounted(() => {
    stop()
  })

  return {
    displayLines,
    currentLineText,
    isTyping,
    currentLineIndex,
    isComplete,
    start,
    stop,
    reset,
  }
}
