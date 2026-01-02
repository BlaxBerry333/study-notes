<script lang="ts">
// Detect mobile device (hoisted for defineProps defaults)
const isMobile = typeof window !== 'undefined' && window.innerWidth < 768

// Default config based on device
export const defaultConfig = {
  columnWidth: isMobile ? 35 : 40,
  fontSize: isMobile ? 20 : 24,
  speedRange: (isMobile ? [50, 120] : [60, 150]) as [number, number],
  lengthRange: (isMobile ? [10, 25] : [15, 30]) as [number, number],
  opacity: isMobile ? 0.15 : 0.2,
}
</script>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed } from 'vue'

// Matrix characters
const MATRIX_CHARS = [
  'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M',
  'N', 'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z',
  'a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l', 'm',
  'n', 'o', 'p', 'q', 'r', 's', 't', 'u', 'v', 'w', 'x', 'y', 'z',
  '0', '1', '2', '3', '4', '5', '6', '7', '8', '9',
  ':', '.', '=', '*', '+', '-', '<', '>', '|', '@', '#', '$', '%', '&',
]

interface Column {
  x: number
  y: number
  speed: number
  chars: string[]
  length: number
}

// Props with defaults based on device
const props = withDefaults(
  defineProps<{
    columnWidth?: number
    fontSize?: number
    speedRange?: [number, number]
    lengthRange?: [number, number]
    opacity?: number
  }>(),
  {
    columnWidth: defaultConfig.columnWidth,
    fontSize: defaultConfig.fontSize,
    // Speed in pixels per second (higher = faster, Matrix-style rapid flow)
    speedRange: () => defaultConfig.speedRange,
    lengthRange: () => defaultConfig.lengthRange,
    opacity: defaultConfig.opacity,
  }
)

const canvasRef = ref<HTMLCanvasElement>()
const containerRef = ref<HTMLDivElement>()

let columns: Column[] = []
let animationId: number
let ctx: CanvasRenderingContext2D | null = null

// Computed opacity for CSS binding
const cssOpacity = computed(() => props.opacity)

function getRandomChar(): string {
  return MATRIX_CHARS[Math.floor(Math.random() * MATRIX_CHARS.length)]
}

function random(min: number, max: number): number {
  return Math.random() * (max - min) + min
}

function createColumn(x: number, canvasHeight: number): Column {
  const length = Math.floor(random(props.lengthRange[0], props.lengthRange[1]))
  const chars: string[] = []
  for (let i = 0; i < length; i++) {
    chars.push(getRandomChar())
  }
  return {
    x,
    y: random(-canvasHeight, 0),
    speed: random(props.speedRange[0], props.speedRange[1]),
    chars,
    length,
  }
}

function initColumns(canvasWidth: number, canvasHeight: number) {
  const numColumns = Math.ceil(canvasWidth / props.columnWidth)
  columns = []
  for (let i = 0; i < numColumns; i++) {
    columns.push(createColumn(i * props.columnWidth, canvasHeight))
  }
}

function getColor(index: number, length: number): string {
  const ratio = index / length
  if (index === 0) return '#66FFAA' // Head - bright green
  if (ratio < 0.1) return '#00FF9F' // Bright green
  if (ratio < 0.3) return '#00CC7F' // Mid green
  if (ratio < 0.6) return '#009966' // Darker green
  return '#005F3F' // Tail - dark green
}

let lastTime = 0
const targetFPS = 30
const frameInterval = 1000 / targetFPS

function animate(currentTime: number) {
  if (!ctx || !canvasRef.value) return

  // Frame rate limiting
  const delta = currentTime - lastTime
  if (delta < frameInterval) {
    animationId = requestAnimationFrame(animate)
    return
  }
  lastTime = currentTime - (delta % frameInterval)

  const canvas = canvasRef.value
  const width = canvas.width
  const height = canvas.height

  // Fade effect for trails
  ctx.fillStyle = 'rgba(10, 10, 15, 0.1)'
  ctx.fillRect(0, 0, width, height)

  ctx.font = `${props.fontSize}px monospace`

  // Draw each column
  for (const col of columns) {
    for (let i = 0; i < col.chars.length; i++) {
      const y = col.y - i * props.fontSize
      if (y < -props.fontSize || y > height + props.fontSize) continue

      ctx.fillStyle = getColor(i, col.length)
      ctx.fillText(col.chars[i], col.x, y)
    }

    // Update position (speed is pixels per second)
    col.y += col.speed * (delta / 1000)

    // Reset when off screen
    if (col.y - col.length * props.fontSize > height) {
      col.y = random(-height * 0.5, 0)
      col.speed = random(props.speedRange[0], props.speedRange[1])
      col.length = Math.floor(random(props.lengthRange[0], props.lengthRange[1]))
      col.chars = []
      for (let i = 0; i < col.length; i++) {
        col.chars.push(getRandomChar())
      }
    }

    // Randomly change characters (2% chance per character per frame)
    for (let i = 0; i < col.chars.length; i++) {
      if (Math.random() < 0.02) {
        col.chars[i] = getRandomChar()
      }
    }
  }

  animationId = requestAnimationFrame(animate)
}

function setupCanvas() {
  if (!canvasRef.value || !containerRef.value) return

  const canvas = canvasRef.value
  const container = containerRef.value

  canvas.width = container.clientWidth
  canvas.height = container.clientHeight

  ctx = canvas.getContext('2d')
  if (!ctx) return

  initColumns(canvas.width, canvas.height)
  animationId = requestAnimationFrame(animate)
}

let resizeObserver: ResizeObserver | null = null

onMounted(() => {
  // Check for reduced motion preference
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  if (prefersReducedMotion) return

  setupCanvas()

  // Resize handling
  resizeObserver = new ResizeObserver(() => {
    if (!canvasRef.value || !containerRef.value) return
    canvasRef.value.width = containerRef.value.clientWidth
    canvasRef.value.height = containerRef.value.clientHeight
    initColumns(canvasRef.value.width, canvasRef.value.height)
  })

  if (containerRef.value) {
    resizeObserver.observe(containerRef.value)
  }

  // Reduce frame rate when tab is hidden
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      cancelAnimationFrame(animationId)
    } else {
      lastTime = 0
      animationId = requestAnimationFrame(animate)
    }
  })
})

onUnmounted(() => {
  cancelAnimationFrame(animationId)
  resizeObserver?.disconnect()
})
</script>

<template>
  <div ref="containerRef" class="STUDY-NOTES--matrix-rain">
    <canvas ref="canvasRef" class="STUDY-NOTES--matrix-canvas" />
  </div>
</template>

<style scoped>
.STUDY-NOTES--matrix-rain {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  pointer-events: none;
  z-index: 0;
  opacity: v-bind('cssOpacity');
}

.STUDY-NOTES--matrix-canvas {
  display: block;
  width: 100%;
  height: 100%;
  background: transparent;
}

@media (prefers-reduced-motion: reduce) {
  .STUDY-NOTES--matrix-rain {
    display: none;
  }
}
</style>
