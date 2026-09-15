/* ============================================================
 * 开屏滚动锁 + 非首页刷新还原
 * 浏览器自动滚位会让 Hero 离屏 → ST 直接 progress=1 钉停靠 → handoff 飞向顶栏,
 * 开屏「描边 → 大标题」被短路。head 已 scrollRestoration=manual;
 * 此处再读 sessionStorage(pagehide 写入)+ 当前 scroll 作兜底,
 * boot 全程锁在顶部完成 preloader;bootResumeY>1 时走 handoffResume
 * (飞向停靠/中段恢复,不经大标题),finishBoot 后再还原并 sync 停靠。
 * ============================================================ */
import { bootDone } from '@/composables/brandDock'

const SCROLL_KEY = 'daum-scroll-y'
export let bootResumeY = 0

export function lockBootScroll() {
  document.documentElement.style.overflow = 'hidden'
  document.body.style.overflow = 'hidden'
  window.scrollTo(0, 0)
}
export function unlockBootScroll() {
  document.documentElement.style.overflow = ''
  document.body.style.overflow = ''
}

/** 防个别引擎在内容增高后仍偷滚: boot 未完成前强制顶 */
const clampBootScroll = () => {
  if (bootDone.value) return
  if ((window.scrollY || document.documentElement.scrollTop || 0) > 0) {
    window.scrollTo(0, 0)
  }
}

/**
 * 模块求值早期执行(必须早于 app mount):读 sessionStorage + 当前 scroll,
 * 锁顶,并挂「偷滚钳回」与「离开前记位」监听。
 */
export function initBootScroll() {
  try {
    if ('scrollRestoration' in history) history.scrollRestoration = 'manual'
  } catch (e) {
    /* ignore */
  }
  try {
    const raw = sessionStorage.getItem(SCROLL_KEY)
    if (raw != null && raw !== '') {
      bootResumeY = Math.max(0, parseInt(raw, 10) || 0)
      sessionStorage.removeItem(SCROLL_KEY)
    }
  } catch (e) {
    /* ignore */
  }
  bootResumeY = Math.max(
    bootResumeY,
    window.scrollY || 0,
    document.documentElement.scrollTop || 0,
    document.body.scrollTop || 0,
  )

  lockBootScroll()

  window.addEventListener('scroll', clampBootScroll, { passive: true })

  /** 刷新/离开前记下位置,供下次 boot 结束后还原(SPA 空壳时 scrollY 恒 0,不能只靠加载瞬间读取) */
  window.addEventListener('pagehide', () => {
    try {
      const y = bootDone.value
        ? window.scrollY || document.documentElement.scrollTop || 0
        : Math.max(bootResumeY, window.scrollY || 0)
      sessionStorage.setItem(SCROLL_KEY, String(Math.round(y)))
    } catch (e) {
      /* ignore */
    }
  })
}

/**
 * 开屏结束后还原刷新前滚动,并钉品牌/社交停靠(非首页收尾)。
 * landTitle: 非首页路径在 sync 停靠姿态后再亮标题,避免大标题闪现后瞬移顶栏。
 * 返回 Promise:handoffResume 可在 commit 后再卸飞行克隆。
 */
export function restoreScrollAfterBoot(opts: { hold?: Promise<unknown>; landTitle?: boolean } = {}) {
  const release = () => {
    window.removeEventListener('scroll', clampBootScroll)
    unlockBootScroll()
  }
  /* veil 分裂/显现期间保持 boot 锁(hold),防 pin 移动社交行、假块落点漂移 */
  const gate = opts.hold ? Promise.resolve(opts.hold) : Promise.resolve()
  return gate.then(() => {
    release()
    if (bootResumeY <= 1) {
      if (opts.landTitle) {
        const t = document.querySelector('.hero-title')
        if (t) {
          t.classList.remove('handoff-pending')
          t.classList.add('is-landed')
        }
      }
      return
    }
    // 'auto' 兼容性优于 'instant'(部分引擎不认 instant 会整段忽略)
    window.scrollTo(0, bootResumeY)
    // 双 rAF:等 pin-spacer / 布局随 scroll 稳定后再 refresh ST
    return new Promise<void>((resolve) => {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          if (typeof window.__syncBrandDockForBoot === 'function') {
            window.__syncBrandDockForBoot({ landTitle: !!opts.landTitle })
          } else if (opts.landTitle) {
            const t = document.querySelector('.hero-title')
            if (t) {
              t.classList.remove('handoff-pending')
              t.classList.add('is-landed')
            }
          }
          resolve()
        })
      })
    })
  })
}
