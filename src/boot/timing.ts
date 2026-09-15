/* ============================================================
 * 开屏时序基元 —— 常量 + wait/nextFrame/onTransformEnd
 * 时序兜底三件套:transitionend + setTimeout 双通道;
 * rAF + setTimeout(50) 双通道(nextFrame);
 * WAAPI finished 一律 .catch(() => {})。
 * ============================================================ */

export const reduced =
  window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches

export const MOVE_MS = 520
/** 品牌字飞行:略带回弹感的 ease-out */
export const EASE = 'cubic-bezier(0.22, 1, 0.36, 1)'
/** loading 背景 → 社交胶囊:收回成社交行整宽圆角长方形(同窗时长 = MOVE_MS);
 *  再分裂成各图标底块:分裂时长与「从中间向外」级联 */
export const VEIL_SPLIT_MS = 253
export const VEIL_SPLIT_STAGGER_MS = 27
/**
 * 进度条走满 + 变形统一 smooth 缓动(无折点)。
 * 走满由 runProgressFill 精确驱动,禁止中途 freeze 硬拉满。
 */
export const SMOOTH = 'cubic-bezier(0.45, 0.05, 0.25, 1)'
/** 变形与字飞行同长,两者并行 */
export const MORPH_MS = MOVE_MS
/** 真正走满 100% 后再停顿,然后飞/变形 */
export const HOLD_MS = 500
/**
 * 与品牌描边同窗:
 * 首字 delay 0.15s, 末字结束 1.45s → 进度 0.15s 起步、1.3s 走满
 */
export const BRAND_DRAW_DELAY_MS = 150
export const BRAND_DRAW_SPAN_MS = 1300
export const DRAW_MS = BRAND_DRAW_DELAY_MS + BRAND_DRAW_SPAN_MS

export const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms))

/** 下一帧:rAF 为主,setTimeout 兜底(后台标签页 rAF 暂停时仍能推进) */
export const nextFrame = () =>
  new Promise<void>((r) => {
    let done = false
    const fin = () => {
      if (done) return
      done = true
      r()
    }
    requestAnimationFrame(fin)
    window.setTimeout(fin, 50)
  })

/** transitionend(transform)+ setTimeout 双保险,替代固定 wait */
export function onTransformEnd(el: HTMLElement, timeout: number) {
  return new Promise<void>((resolve) => {
    let done = false
    const finish = () => {
      if (done) return
      done = true
      el.removeEventListener('transitionend', onEnd)
      resolve()
    }
    const onEnd = (e: TransitionEvent) => {
      if (e.target === el && e.propertyName === 'transform') finish()
    }
    el.addEventListener('transitionend', onEnd)
    window.setTimeout(finish, timeout)
  })
}
