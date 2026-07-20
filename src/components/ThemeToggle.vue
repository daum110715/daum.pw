<template>
  <button
    class="theme-toggle"
    :aria-label="`切换到${theme === 'dark' ? '亮色' : '暗色'}主题`"
    :aria-pressed="theme === 'dark'"
    @click="toggleWithTransition"
  >
    <span class="track">
      <span class="thumb" :data-pos="theme">
        <svg class="icon icon-sun" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true">
          <circle cx="12" cy="12" r="4.4" />
          <line x1="12" y1="1.6" x2="12" y2="4" />
          <line x1="12" y1="20" x2="12" y2="22.4" />
          <line x1="4.6" y1="4.6" x2="6.3" y2="6.3" />
          <line x1="17.7" y1="17.7" x2="19.4" y2="19.4" />
          <line x1="1.6" y1="12" x2="4" y2="12" />
          <line x1="20" y1="12" x2="22.4" y2="12" />
          <line x1="4.6" y1="19.4" x2="6.3" y2="17.7" />
          <line x1="17.7" y1="6.3" x2="19.4" y2="4.6" />
        </svg>
        <svg class="icon icon-moon" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
        </svg>
      </span>
    </span>
  </button>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useTheme } from '@/composables/useTheme'

const { theme, toggle, set } = useTheme()
const reducedMotion = ref(false)

onMounted(() => {
  reducedMotion.value = window.matchMedia('(prefers-reduced-motion: reduce)').matches
})

function toggleWithTransition(e) {
  const next = theme.value === 'dark' ? 'light' : 'dark'
  if (reducedMotion.value) {
    set(next)
    return
  }
  const root = document.documentElement
  if (document.startViewTransition) {
    // 虹膜自按钮圆心揭示:新主题快照自按钮处圆形展开铺满全屏,
    // 半径取到最远角距离;与站内新旧版转场同一虹膜语言
    const rect = e.currentTarget.getBoundingClientRect()
    const x = rect.left + rect.width / 2
    const y = rect.top + rect.height / 2
    const r = Math.hypot(Math.max(x, window.innerWidth - x), Math.max(y, window.innerHeight - y))
    root.style.setProperty('--theme-iris-x', `${x}px`)
    root.style.setProperty('--theme-iris-y', `${y}px`)
    root.style.setProperty('--theme-iris-r', `${Math.ceil(r)}px`)
    document.startViewTransition(() => {
      // 同步切 data-theme,确保 VT 截到新主题快照(set 的 watch 异步,不保险)
      root.setAttribute('data-theme', next)
      set(next)
    })
  } else {
    // 回退:全站颜色平滑过渡(toggle 内加 theme-transition 类)
    toggle()
  }
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
  background: var(--accent);
  color: #2a2a2a;
  transform: translateX(0);
  transition:
    transform 0.45s cubic-bezier(0.34, 1.35, 0.4, 1),
    box-shadow 0.3s var(--ease);
}
.thumb[data-pos='dark'] {
  transform: translateX(30px);
}
.theme-toggle:hover .thumb {
  box-shadow: 0 0 14px color-mix(in srgb, var(--accent) 60%, transparent);
}
/* 日/月图标:同轴旋转 morph——离场的图标加速旋出缩没,
   到场的图标自反向旋入展开,与 thumb 位移同窗完成 */
.icon {
  position: absolute;
  inset: 0;
  margin: auto;
  width: 15px;
  height: 15px;
  transition:
    transform 0.5s cubic-bezier(0.34, 1.3, 0.4, 1),
    opacity 0.22s var(--ease);
}
.icon-sun {
  opacity: 1;
  transform: rotate(0deg) scale(1);
}
.thumb[data-pos='dark'] .icon-sun {
  opacity: 0;
  transform: rotate(120deg) scale(0.15);
}
.icon-moon {
  opacity: 0;
  transform: rotate(-120deg) scale(0.15);
}
.thumb[data-pos='dark'] .icon-moon {
  opacity: 1;
  transform: rotate(0deg) scale(1);
}

@media (prefers-reduced-motion: reduce) {
  .thumb,
  .icon {
    transition: none;
  }
}
</style>
