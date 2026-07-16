<template>
  <button
    class="theme-toggle neu-inset"
    :aria-label="`切换到${theme === 'dark' ? '亮色' : '暗色'}主题`"
    :aria-pressed="theme === 'dark'"
    @click="toggle"
  >
    <span class="thumb neu" :data-pos="theme">
      <svg v-if="theme === 'light'" class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="12" cy="12" r="5" />
        <line x1="12" y1="1" x2="12" y2="3" />
        <line x1="12" y1="21" x2="12" y2="23" />
        <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
        <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
        <line x1="1" y1="12" x2="3" y2="12" />
        <line x1="21" y1="12" x2="23" y2="12" />
        <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
        <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
      </svg>
      <svg v-else class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
      </svg>
    </span>
  </button>
</template>

<script setup>
import { useTheme } from '@/composables/useTheme'
const { theme, toggle } = useTheme()
</script>

<style scoped>
.theme-toggle {
  position: relative;
  width: 62px;
  height: 34px;
  border-radius: var(--radius-full);
  padding: 4px;
  display: flex;
  align-items: center;
  flex-shrink: 0;
}
.thumb {
  width: 26px;
  height: 26px;
  border-radius: var(--radius-full);
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--accent);
  transform: translateX(0);
  transition: transform var(--dur) var(--ease);
}
.thumb[data-pos='dark'] {
  transform: translateX(28px);
}
.thumb .icon {
  width: 14px;
  height: 14px;
}
</style>
