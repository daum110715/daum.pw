import { ref, watch } from 'vue'
import { themeScrollLock } from '@/composables/brandDock'

const STORAGE_KEY = 'daum-theme'
const TRANSITION_DURATION = 450
/* 覆盖 snap delay(0.12)+duration max(0.45) 与换肤回流窗口 */
const SCROLL_LOCK_MS = 600

// 全局共享主题状态(模块单例)
const theme = ref('light')

function apply(t) {
  if (typeof document !== 'undefined') {
    document.documentElement.setAttribute('data-theme', t)
  }
}

let unlockTimer = 0
let activePin = null

/** 换肤前后钉住 scrollY、暂停 pin snap,避免 color-scheme/滚动条回流把飞行进度拽飞 */
function withScrollPinned(run) {
  if (typeof window === 'undefined') {
    run()
    return
  }
  /* 取消上一次未结束的钳位,避免旧 y 覆盖新一次 */
  if (activePin) {
    window.removeEventListener('scroll', activePin, { capture: true })
    activePin = null
  }
  if (unlockTimer) {
    window.clearTimeout(unlockTimer)
    unlockTimer = 0
  }

  const y = window.scrollY
  themeScrollLock.value = true
  const pin = () => {
    if (Math.abs(window.scrollY - y) > 0.5) {
      window.scrollTo({ top: y, behavior: 'instant' })
    }
  }
  activePin = pin
  /* 整段锁窗持续钳位:仅 rAF 两次挡不住 VT/回流触发的后续 scroll */
  window.addEventListener('scroll', pin, { passive: true, capture: true })
  try {
    run()
  } finally {
    pin()
    requestAnimationFrame(() => {
      pin()
      requestAnimationFrame(pin)
    })
    unlockTimer = window.setTimeout(() => {
      window.removeEventListener('scroll', pin, { capture: true })
      if (activePin === pin) activePin = null
      pin()
      themeScrollLock.value = false
      unlockTimer = 0
    }, SCROLL_LOCK_MS)
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
      withScrollPinned(() => {
        theme.value = theme.value === 'light' ? 'dark' : 'light'
      })
      return
    }

    // 先加上过渡类,下一帧切主题,让背景/文字/边框等颜色平滑过渡
    root.classList.add('theme-transition')
    requestAnimationFrame(() => {
      withScrollPinned(() => {
        theme.value = theme.value === 'light' ? 'dark' : 'light'
      })
      setTimeout(() => root.classList.remove('theme-transition'), TRANSITION_DURATION)
    })
  }

  function set(t) {
    withScrollPinned(() => {
      theme.value = t
    })
  }

  return { theme, toggle, set }
}
