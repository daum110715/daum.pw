/* ============================================================
 * 旧版转场:圆形幕布自点击处展开,盖满后整页跳转(单次加载);
 * 旧版端 ?from=new 到岸幕布自同轴位置虹膜收拢揭示,与回新版方向对称。
 * ============================================================ */
import { ref, onBeforeUnmount } from 'vue'
import { reduced as REDUCED } from '@/boot/timing'

const LEGACY_HREF = './legacy/?from=new'
const NAV_DELAY_MS = 880

export function useLegacyVeil() {
  const legacyState = ref<'idle' | 'covering' | 'covered' | 'leaving'>('idle')
  const veilOrigin = ref({ '--tx': '50%', '--ty': '50%' })

  let navTimer: number | undefined

  function goLegacy(e: MouseEvent) {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return
    e.preventDefault()
    if (legacyState.value !== 'idle') return
    if (REDUCED) {
      window.location.assign('./legacy/')
      return
    }
    veilOrigin.value = { '--tx': `${e.clientX}px`, '--ty': `${e.clientY}px` }
    try {
      sessionStorage.setItem('daum-legacy-visit', '1')
      // 到岸虹膜同轴:旧版首帧前读取点击坐标,虹膜从此处收拢揭示。一次性,读后即清
      sessionStorage.setItem('daum-from-new', `${e.clientX},${e.clientY}`)
    } catch (err) {}
    document.documentElement.style.overflow = 'hidden'
    legacyState.value = 'covering'
    requestAnimationFrame(() => requestAnimationFrame(() => {
      if (legacyState.value === 'covering') legacyState.value = 'covered'
    }))
    navTimer = window.setTimeout(navigate, NAV_DELAY_MS)
  }

  function navigate() {
    if (legacyState.value === 'idle' || legacyState.value === 'leaving') return
    legacyState.value = 'leaving'
    clearTimeout(navTimer)
    window.location.assign(LEGACY_HREF)
  }

  onBeforeUnmount(() => {
    clearTimeout(navTimer)
    document.documentElement.style.overflow = ''
  })

  return { legacyState, veilOrigin, goLegacy }
}
