import { ref, watch } from 'vue'

const STORAGE_KEY = 'daum-theme'

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
    theme.value = theme.value === 'light' ? 'dark' : 'light'
  }
  function set(t) {
    theme.value = t
  }
  return { theme, toggle, set }
}
