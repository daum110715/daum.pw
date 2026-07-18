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

const { theme, toggle, set } = useTheme()
const reducedMotion = ref(false)

onMounted(() => {
  reducedMotion.value = window.matchMedia('(prefers-reduced-motion: reduce)').matches
})

function toggleWithTransition() {
  const next = theme.value === 'dark' ? 'light' : 'dark'
  if (reducedMotion.value) {
    set(next)
    return
  }
  // 幕布方向跟按钮 thumb 一致:切到 dark(thumb 右移)幕布从左向右揭,
  // 切到 light(thumb 左移)幕布从右向左揭(neu.css 读 --theme-curtain-from)
  const fromInset = next === 'dark' ? 'inset(0 100% 0 0)' : 'inset(0 0 0 100%)'
  document.documentElement.style.setProperty('--theme-curtain-from', fromInset)
  if (document.startViewTransition) {
    document.startViewTransition(() => {
      // 同步切 data-theme,确保 VT 截到新主题快照(set 的 watch 异步,不保险)
      document.documentElement.setAttribute('data-theme', next)
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
