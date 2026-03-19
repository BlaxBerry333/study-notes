<script setup lang="ts">
import { withBase } from 'vitepress'

defineProps<{
  title: string
  link: string
  draft?: boolean
}>()
</script>

<template>
  <component :is="draft ? 'div' : 'a'" :href="draft ? undefined : withBase(link)" class="STUDY-NOTES--card"
    :class="{ 'STUDY-NOTES--card-draft': draft }">
    <div class="STUDY-NOTES--card-content">
      <h3 class="STUDY-NOTES--card-title">{{ draft ? '[CLASSIFIED]' : `[${title.toUpperCase()}]` }}</h3>
      <p class="STUDY-NOTES--card-subtitle">{{ draft ? 'ACCESS DENIED' : 'ACCESSIBLE' }}</p>
      <p v-if="draft" class="STUDY-NOTES--card-desc">CLEARANCE LEVEL INSUFFICIENT</p>
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
  background: var(--STUDY-NOTES--cyber-surface-dim);
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
  transition: all var(--STUDY-NOTES--duration-normal) var(--STUDY-NOTES--ease-default);
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
  color: var(--STUDY-NOTES--neon-green-dim);
  text-shadow: none;
  transition: all var(--STUDY-NOTES--duration-normal) var(--STUDY-NOTES--ease-default);
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
    color: var(--STUDY-NOTES--cyber-text-primary);
    text-shadow: var(--STUDY-NOTES--text-glow-green-sm);
  }
}

.STUDY-NOTES--card:active {
  opacity: 1;
  box-shadow: 0 0 25px var(--STUDY-NOTES--neon-green-glow);
  background: var(--STUDY-NOTES--cyber-surface-hover);
}

.STUDY-NOTES--card:active .STUDY-NOTES--card-title {
  color: var(--STUDY-NOTES--cyber-text-primary);
  text-shadow: var(--STUDY-NOTES--text-glow-green-sm);
}

/* ============================================
 * 草稿状态 - Draft (40K Style)
 * ============================================ */

.STUDY-NOTES--card-draft {
  outline-color: var(--STUDY-NOTES--neon-red);
  color: var(--STUDY-NOTES--neon-red);
  cursor: not-allowed;
}

.STUDY-NOTES--card-draft .STUDY-NOTES--card-title {
  color: var(--STUDY-NOTES--neon-red-dim);
}

@media (hover: hover) {
  .STUDY-NOTES--card-draft:hover {
    box-shadow: 0 0 25px var(--STUDY-NOTES--neon-red-glow);
  }

  .STUDY-NOTES--card-draft:hover .STUDY-NOTES--card-title {
    color: var(--STUDY-NOTES--cyber-text-primary);
    text-shadow: var(--STUDY-NOTES--text-glow-red-sm);
  }
}

.STUDY-NOTES--card-draft:active {
  box-shadow: 0 0 25px var(--STUDY-NOTES--neon-red-glow);
}

.STUDY-NOTES--card-draft:active .STUDY-NOTES--card-title {
  color: var(--STUDY-NOTES--cyber-text-primary);
  text-shadow: var(--STUDY-NOTES--text-glow-red-sm);
}
</style>
