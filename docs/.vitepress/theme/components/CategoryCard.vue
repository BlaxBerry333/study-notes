<script setup lang="ts">
import { withBase } from 'vitepress'

defineProps<{
  title: string
  link: string
  restricted?: boolean
}>()
</script>

<template>
  <component :is="restricted ? 'div' : 'a'" :href="restricted ? undefined : withBase(link)" class="STUDY-NOTES--card"
    :class="{ 'STUDY-NOTES--card-restricted': restricted }">
    <div class="STUDY-NOTES--card-content">
      <h3 class="STUDY-NOTES--card-title">{{ restricted ? '[CLASSIFIED]' : `[${title.toUpperCase()}]` }}</h3>
      <p class="STUDY-NOTES--card-subtitle">{{ restricted ? 'ACCESS DENIED' : 'ACCESSIBLE' }}</p>
      <p v-if="restricted" class="STUDY-NOTES--card-desc">CLEARANCE LEVEL INSUFFICIENT</p>
    </div>
    <div class="STUDY-NOTES--card-footer">
      <span class="STUDY-NOTES--card-arrow">[ENGAGE >>]</span>
    </div>
  </component>
</template>

<style scoped>
/* ============================================
 * Cogitator 风格卡片 - 40K Imperial Tech
 * ============================================ */

.STUDY-NOTES--card {
  position: relative;
  background: rgba(10, 10, 15, 0.6);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  border-radius: 0;
  outline: 1.5px solid var(--STUDY-NOTES--cyber-border);
  overflow: hidden;
  font-family: var(--STUDY-NOTES--font-mono);
  color: var(--STUDY-NOTES--neon-green);
  text-decoration: none;
  display: flex;
  flex-direction: column;
  cursor: pointer;
  width: 280px;
  opacity: 0.6;
  transition: all var(--STUDY-NOTES--duration-normal, 300ms) var(--STUDY-NOTES--ease-default, ease);
}

/* ============================================
 * 内容区 - Content Area
 * ============================================ */

.STUDY-NOTES--card-content {
  position: relative;
  z-index: 5;
  padding: 16px;
  flex: 1;
  text-align: left;
}

.STUDY-NOTES--card-title {
  font-size: 16px;
  font-weight: bold;
  margin: 0 0 4px 0;
  color: var(--STUDY-NOTES--neon-green-dim, #00CC7F);
  text-shadow: none;
  transition: all var(--STUDY-NOTES--duration-normal, 300ms) var(--STUDY-NOTES--ease-default, ease);
}

.STUDY-NOTES--card-subtitle {
  font-size: 12px;
  font-weight: bold;
  letter-spacing: 0.1em;
  opacity: 0.85;
  margin: 0 0 8px 0;
}

.STUDY-NOTES--card-desc {
  font-size: 10px;
  line-height: 1.5;
  opacity: 0.7;
  margin: 0;
}

/* ============================================
 * 底部状态栏 - Footer
 * ============================================ */

.STUDY-NOTES--card-footer {
  position: relative;
  z-index: 5;
  display: flex;
  justify-content: flex-end;
  align-items: center;
  padding: 10px 16px;
  margin-top: auto;
}

.STUDY-NOTES--card-arrow {
  font-size: 12px;
}

/* ============================================
 * 唤醒状态 - Awakened (Hover/Active)
 * ============================================ */

@media (hover: hover) {
  .STUDY-NOTES--card:hover {
    opacity: 1;
    box-shadow: 0 0 25px var(--STUDY-NOTES--neon-green-glow);
    background: var(--STUDY-NOTES--cyber-surface-hover);
  }

  .STUDY-NOTES--card:hover .STUDY-NOTES--card-title {
    color: #ffffff;
    text-shadow: var(--STUDY-NOTES--text-glow-green-sm);
  }
}

.STUDY-NOTES--card:active {
  opacity: 1;
  box-shadow: 0 0 25px var(--STUDY-NOTES--neon-green-glow);
  background: var(--STUDY-NOTES--cyber-surface-hover);
}

.STUDY-NOTES--card:active .STUDY-NOTES--card-title {
  color: #ffffff;
  text-shadow: var(--STUDY-NOTES--text-glow-green-sm);
}

/* ============================================
 * 受限状态 - Restricted Access (40K Style)
 * ============================================ */

.STUDY-NOTES--card-restricted {
  outline-color: var(--STUDY-NOTES--neon-red, #ff3333);
  color: var(--STUDY-NOTES--neon-red, #ff3333);
  cursor: not-allowed;
}

.STUDY-NOTES--card-restricted .STUDY-NOTES--card-title {
  color: var(--STUDY-NOTES--neon-red-dim, #cc3333);
}

@media (hover: hover) {
  .STUDY-NOTES--card-restricted:hover {
    box-shadow: 0 0 25px rgba(255, 51, 51, 0.4);
  }

  .STUDY-NOTES--card-restricted:hover .STUDY-NOTES--card-title {
    color: #ffffff;
    text-shadow: 0 0 10px rgba(255, 51, 51, 0.8), 0 0 20px rgba(255, 51, 51, 0.5);
  }
}

.STUDY-NOTES--card-restricted:active {
  box-shadow: 0 0 25px rgba(255, 51, 51, 0.4);
}

.STUDY-NOTES--card-restricted:active .STUDY-NOTES--card-title {
  color: #ffffff;
  text-shadow: 0 0 10px rgba(255, 51, 51, 0.8), 0 0 20px rgba(255, 51, 51, 0.5);
}
</style>
