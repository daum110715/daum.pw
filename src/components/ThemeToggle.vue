<template>
  <button
    class="theme-toggle"
    :aria-label="`切换到${theme === 'dark' ? '亮色' : '暗色'}主题`"
    :aria-pressed="theme === 'dark'"
    @click="toggleWithTransition"
  >
    <span class="track">
      <span class="thumb" :data-pos="theme">
        <Icon
          class="icon"
          :icon="theme === 'light' ? 'ph:sun-thin' : 'ph:moon-thin'"
          width="14"
          height="14"
        />
      </span>
    </span>
  </button>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { Icon } from '@iconify/vue'
import { useTheme } from '@/composables/useTheme'

const { theme, toggle } = useTheme()
const reducedMotion = ref(false)

onMounted(() => {
  reducedMotion.value = window.matchMedia('(prefers-reduced-motion: reduce)').matches
})

function toggleWithTransition() {
  if (reducedMotion.value) {
    toggle()
    return
  }

  const nextTheme = theme.value === 'dark' ? 'light' : 'dark'

  // 做一条明显的斜向光带从页面上方扫过（临时、窄、半透明，不阻塞交互）
  const overlay = document.createElement('div')
  overlay.style.cssText = `
    position: fixed;
    inset: 0;
    pointer-events: none;
    z-index: 100;
    background: linear-gradient(90deg, transparent, rgba(159, 180, 204, 0.35), transparent);
    clip-path: polygon(-20% 0, 0 0, -20% 100%, -40% 100%);
    transition: clip-path 0.45s cubic-bezier(0.4, 0, 0.2, 1);
    will-change: clip-path;
  `
  document.body.appendChild(overlay)

  // 按钮滑动与页面颜色同时开始
  toggle()

  requestAnimationFrame(() => {
    overlay.style.clipPath = 'polygon(100% 0, 120% 0, 120% 100%, 100% 100%)'
  })

  overlay.addEventListener('transitionend', () => overlay.remove(), { once: true })
  setTimeout(() => {
    if (overlay.parentNode) overlay.remove()
  }, 550)
}
</script>

<style scoped>
.theme-toggle {
  display: inline-flex;
  align-items: center;
  padding: 0;
  background: transparent;
}
.track {
  position: relative;
  width: 64px;
  height: 32px;
  border-radius: var(--radius-full);
  background: var(--bg-2);
  overflow: hidden;
}
.thumb {
  position: absolute;
  top: 3px;
  left: 3px;
  width: 26px;
  height: 26px;
  border-radius: var(--radius-full);
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--accent);
  color: #2a2a2a;
  transform: translateX(0);
  transition: transform 0.4s var(--ease);
}
.thumb[data-pos='dark'] {
  transform: translateX(30px);
}
.icon {
  width: 14px;
  height: 14px;
}

@media (prefers-reduced-motion: reduce) {
  .thumb {
    transition: none;
  }
}
</style>
