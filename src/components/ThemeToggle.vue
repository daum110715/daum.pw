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

function toggleWithTransition(e) {
  if (reducedMotion.value) {
    toggle()
    return
  }

  const rect = e.currentTarget.getBoundingClientRect()
  const x = rect.left + rect.width / 2
  const y = rect.top + rect.height / 2
  const nextTheme = theme.value === 'dark' ? 'light' : 'dark'

  // 在内容背后做一个从新主题底色扩散的圆形遮罩，内容始终在最上层
  const overlay = document.createElement('div')
  overlay.style.cssText = `
    position: fixed;
    inset: 0;
    pointer-events: none;
    z-index: 0;
    background: ${nextTheme === 'dark'
      ? 'radial-gradient(circle at 50% -10%, #31343c, #2b2e35 55%)'
      : 'radial-gradient(circle at 50% -10%, #efece5, #e9e6df 55%)'};
    clip-path: circle(0px at ${x}px ${y}px);
    transition: clip-path 0.6s cubic-bezier(0.4, 0, 0.2, 1);
  `
  document.body.appendChild(overlay)

  requestAnimationFrame(() => {
    const r = Math.hypot(
      Math.max(x, window.innerWidth - x),
      Math.max(y, window.innerHeight - y)
    )
    overlay.style.clipPath = `circle(${r}px at ${x}px ${y}px)`
  })

  // 遮罩扩展到一半时切主题，配合全局 .theme-transition 让内容颜色平滑过渡
  setTimeout(() => {
    toggle()
  }, 300)

  overlay.addEventListener('transitionend', () => overlay.remove(), { once: true })
  setTimeout(() => {
    if (overlay.parentNode) overlay.remove()
  }, 700)
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
  transition: transform 0.35s var(--ease);
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
