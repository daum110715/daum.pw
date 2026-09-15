/* ============================================================
 * loading 背景归宿 · 分裂段
 * ============================================================ */
import { nextFrame, VEIL_SPLIT_MS, VEIL_SPLIT_STAGGER_MS, SMOOTH } from './timing'
import { boxKeyframes, cssColor } from './domFx'

/**
 * veil 已收回成社交行整宽的圆角长方形(与展开后同位同宽高)→
 * 从中间向外级联分裂成各图标底块(假块 = --bg-2,与 ::before 同色)→
 * 到位同窗点亮 .hero-social(真 ::before 底与假块同位同色,零跳变)并撤假块;
 * 图标「淡入+微弹」由 HeroSection 的 is-visible 观察接管。
 */
export async function splitVeilIntoSocial(
  veil: HTMLElement,
  socialRowEl: Element,
  heroSocialEl: HTMLElement | null,
  barRect: BoxRect,
) {
  const items = Array.from(socialRowEl.children)
  if (!items.length) {
    veil.remove()
    return
  }
  const rects = items.map((el) => el.getBoundingClientRect())
  const bg2 = cssColor('--bg-2', '#ffffff')
  const radius = getComputedStyle(items[0]).borderRadius
  const pieces = rects.map(() => {
    const p = document.createElement('div')
    p.className = 'boot-veil-piece'
    p.style.cssText = `position:fixed;left:${barRect.left}px;top:${barRect.top}px;width:${barRect.width}px;height:${barRect.height}px;z-index:9998;pointer-events:none;background:${bg2};border-radius:${radius};`
    document.body.appendChild(p)
    return p
  })
  veil.remove()
  await nextFrame()
  const mid = (pieces.length - 1) / 2
  const anims = pieces.map((p, i) =>
    p.animate(boxKeyframes(barRect, rects[i]), {
      duration: VEIL_SPLIT_MS,
      delay: Math.abs(i - mid) * VEIL_SPLIT_STAGGER_MS,
      easing: SMOOTH,
      fill: 'forwards',
    }),
  )
  /* 接管同窗:点亮容器 + 撤假块同一 JS 任务,无已绘制帧可闪。
     假块是 fixed 独立层——残留后不随图标移动也不消散;
     接管与动画 settle 解耦:Promise 挂起/异常时超时强制接管,任何路径不留假块 */
  let took = false
  const takeover = () => {
    if (took) return
    took = true
    if (heroSocialEl) {
      heroSocialEl.style.transition = 'none'
      heroSocialEl.classList.add('is-visible')
    }
    pieces.forEach((p) => p.remove())
  }
  const restoreTransition = () => {
    /* 双帧后再还 transition:rAF 回调跑在同帧绘制前,单帧就还会让首帧
       绘制时 inline none 已失效 → 容器吃 0.55s CSS 淡入,假块瞬没真底慢回 */
    nextFrame().then(() =>
      nextFrame().then(() => {
        if (heroSocialEl) heroSocialEl.style.transition = ''
      }),
    )
  }
  const failsafe = window.setTimeout(
    () => {
      takeover()
      restoreTransition()
    },
    VEIL_SPLIT_MS + (pieces.length - 1) * VEIL_SPLIT_STAGGER_MS + 600,
  )
  try {
    await Promise.all(anims.map((a) => a.finished.catch(() => {})))
  } finally {
    window.clearTimeout(failsafe)
    takeover()
  }
  restoreTransition()
}
