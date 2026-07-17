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

  // 在内容背后做一个斜向平移的遮罩，内容始终在最上层
  const overlay = document.createElement('div')
  overlay.style.cssText = `
    position: fixed;
    inset: 0;
    pointer-events: none;
    z-index: 0;
    overflow: hidden;
  `

  const panel = document.createElement('div')
  panel.style.cssText = `
    position: absolute;
    top: 0;
    left: 0;
    width: 250vmax;
    height: 250vmax;
    background: ${nextTheme === 'dark'
      ? 'radial-gradient(circle at 8% 12%, rgba(159, 180, 204, 0.18) 0%, transparent 32%), radial-gradient(circle at 92% 8%, rgba(216, 164, 127, 0.16) 0%, transparent 28%), radial-gradient(circle at 50% 95%, rgba(200, 190, 175, 0.14) 0%, transparent 30%), radial-gradient(circle at 50% -10%, #31343c, #2b2e35 55%)'
      : 'radial-gradient(circle at 8% 12%, rgba(216, 164, 127, 0.18) 0%, transparent 32%), radial-gradient(circle at 92% 8%, rgba(159, 180, 204, 0.16) 0%, transparent 28%), radial-gradient(circle at 50% 95%, rgba(232, 220, 200, 0.18) 0%, transparent 30%), radial-gradient(circle at 50% -10%, #fffcfa, #f5f2ec 55%)'};
    transform: translate(-100%, -100%);
    transition: transform 0.7s cubic-bezier(0.4, 0, 0.2, 1);
    will-change: transform;
  `
  overlay.appendChild(panel)
  document.body.appendChild(overlay)

  requestAnimationFrame(() => {
    panel.style.transform = 'translate(0, 0)'
  })

  // 遮罩平移到一半时切主题，配合全局 .theme-transition 让内容颜色平滑过渡
  setTimeout(() => {
    toggle()
  }, 350)

  panel.addEventListener('transitionend', () => overlay.remove(), { once: true })
  setTimeout(() => {
    if (overlay.parentNode) overlay.remove()
  }, 800)
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
