import { ref, watch } from 'vue'

const STORAGE_KEY = 'daum-theme'
const TRANSITION_DURATION = 600

// 全局共享主题状态(模块单例)
const theme = ref('light')

function apply(t) {
  if (typeof document !== 'undefined') {
    document.documentElement.setAttribute('data-theme', t)
  }
}

// 初始化:localStorage > 系统偏好 > light(与 index.html 内联脚本逻辑一致,防闪烁)
{
  let t = 'light'
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved === 'light' || saved === 'dark') t = saved
    else if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) t = 'dark'
  } catch (e) {}
  theme.value = t
  apply(t)
}

// 持久化 + 同步 DOM(只注册一次)
watch(theme, (t) => {
  apply(t)
  try {
    localStorage.setItem(STORAGE_KEY, t)
  } catch (e) {}
})

export function useTheme() {
  function toggle() {
    const root = typeof document !== 'undefined' ? document.documentElement : null
    const prefersReduced =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches

    if (!root || prefersReduced) {
      theme.value = theme.value === 'light' ? 'dark' : 'light'
      return
    }

    // 先加上过渡类,下一帧切主题,让背景/文字/边框等颜色平滑过渡
    root.classList.add('theme-transition')
    requestAnimationFrame(() => {
      theme.value = theme.value === 'light' ? 'dark' : 'light'
      setTimeout(() => root.classList.remove('theme-transition'), TRANSITION_DURATION)
    })
  }

  function set(t) {
    theme.value = t
  }

  return { theme, toggle, set }
}
