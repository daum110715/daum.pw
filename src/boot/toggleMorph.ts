/* ============================================================
 * 进度条 → 主题开关变形
 * 走满(runProgressFill)→ 钉像素(freezeProgress)→ WAAPI 几何变形
 * (morphBarToToggle)→ 真按钮接管(revealToggle 瞬亮)。
 * 轨道/填充均为 body 级 fixed,视口绝对几何,无父子裁切。
 * ============================================================ */
import {
  reduced,
  wait,
  nextFrame,
  BRAND_DRAW_DELAY_MS,
  BRAND_DRAW_SPAN_MS,
  SMOOTH,
  MORPH_MS,
} from './timing'
import { boxKeyframes, pinFixedBox } from './domFx'

/**
 * 进度条 0→100%:与描边同窗,单一 transition 走满。
 * 等 transitionend 才算完成——绝不在中途把宽度硬拉满。
 */
export async function runProgressFill(fill: HTMLElement | null) {
  if (!fill) return
  fill.style.animation = 'none'
  fill.style.transition = 'none'
  fill.style.width = '0%'
  void fill.offsetWidth

  if (reduced) {
    fill.style.width = '100%'
    return
  }

  await wait(BRAND_DRAW_DELAY_MS)
  fill.style.transition = `width ${BRAND_DRAW_SPAN_MS}ms ${SMOOTH}`
  fill.style.width = '100%'

  await new Promise<void>((resolve) => {
    let done = false
    const fin = () => {
      if (done) return
      done = true
      fill.removeEventListener('transitionend', onEnd)
      resolve()
    }
    const onEnd = (e: TransitionEvent) => {
      if (e.target === fill && e.propertyName === 'width') fin()
    }
    fill.addEventListener('transitionend', onEnd)
    window.setTimeout(fin, BRAND_DRAW_SPAN_MS + 80)
  })

  // 已在 100%,只去 transition 锁定,不改视觉宽度
  fill.style.transition = 'none'
  fill.style.width = '100%'
}

/** handoff 时钉成像素宽(此时必已 100%,仅供变形测 rect) */
export function freezeProgress(fill: HTMLElement | null) {
  if (!fill) return
  const parent = fill.parentElement
  const fullPx = parent
    ? parent.getBoundingClientRect().width
    : fill.getBoundingClientRect().width
  fill.style.transition = 'none'
  fill.style.animation = 'none'
  fill.style.width = fullPx.toFixed(2) + 'px'
  fill.style.height = '100%'
}

/**
 * 进度条 → 主题按钮:WAAPI 单段插值,与字飞行并行。
 * endBgs:真按钮轨道/圆点的计算背景(渐变),收尾瞬间同步到假层,
 * 保证假层盖住真按钮的那一帧外观零差异。
 */
export interface MorphEndBgs {
  track?: { color: string; image: string } | null
  thumb?: { color: string; image: string } | null
}
export async function morphBarToToggle(
  prog: HTMLElement,
  fill: HTMLElement,
  trackEnd: BoxRect,
  thumbEnd: BoxRect,
  endBgs: MorphEndBgs | null,
) {
  const trackStart = prog.getBoundingClientRect()
  // 满格时填充应铺满轨道
  const fillStart = {
    left: trackStart.left,
    top: trackStart.top,
    width: trackStart.width,
    height: trackStart.height,
  }

  freezeProgress(fill)
  if (fill.parentElement !== document.body) document.body.appendChild(fill)
  if (prog.parentElement !== document.body) document.body.appendChild(prog)

  pinFixedBox(prog, trackStart, 10002)
  prog.style.overflow = 'visible'
  prog.style.background = getComputedStyle(prog).backgroundColor || 'var(--bg-2)'
  pinFixedBox(fill, fillStart, 10003)
  fill.style.background = getComputedStyle(fill).backgroundColor || 'var(--accent)'

  await nextFrame()

  const opts: KeyframeAnimationOptions = {
    duration: MORPH_MS,
    easing: SMOOTH,
    fill: 'forwards',
  }
  const aTrack = prog.animate(boxKeyframes(trackStart, trackEnd), opts)
  const aFill = fill.animate(boxKeyframes(fillStart, thumbEnd), opts)
  await Promise.all([aTrack.finished.catch(() => {}), aFill.finished.catch(() => {})])

  // 提交终态,取消 WAAPI 残留;假层背景同步真按钮(渐变/配色以按钮为准)
  if (endBgs) {
    if (endBgs.track) {
      prog.style.backgroundColor = endBgs.track.color
      prog.style.backgroundImage = endBgs.track.image
    }
    if (endBgs.thumb) {
      fill.style.backgroundColor = endBgs.thumb.color
      fill.style.backgroundImage = endBgs.thumb.image
    }
  }
  pinFixedBox(prog, trackEnd, 10002)
  pinFixedBox(fill, thumbEnd, 10003)
  aTrack.cancel()
  aFill.cancel()
}

/**
 * 量测 ThemeToggle 变形终点(与首页 handoff 共用)。
 * 返回 { toggleEl, trackEnd, thumbEnd, endBgs } 或 null。
 */
export function measureToggleMorphEnds() {
  const toggleEl = document.querySelector<HTMLElement>('.theme-floating')
  const track = toggleEl && toggleEl.querySelector('.track')
  const thumb = toggleEl && toggleEl.querySelector('.thumb')
  if (!toggleEl || !track || !thumb) return null
  toggleEl.style.transition = 'none'
  toggleEl.style.transform = 'none'
  void toggleEl.offsetWidth
  const trackEnd = track.getBoundingClientRect()
  const thumbEnd = thumb.getBoundingClientRect()
  const trackCs = getComputedStyle(track)
  const thumbCs = getComputedStyle(thumb)
  return {
    toggleEl,
    trackEnd,
    thumbEnd,
    endBgs: {
      track: { color: trackCs.backgroundColor, image: trackCs.backgroundImage },
      thumb: { color: thumbCs.backgroundColor, image: thumbCs.backgroundImage },
    },
  }
}

/** 点亮主题切换按钮。instant:跳过 .reveal 过渡立即呈现——
    变形接管时假进度条正盖在同位,必须瞬亮后下一帧撤假条才零跳变 */
export function revealToggle(instant?: boolean) {
  const t = document.querySelector<HTMLElement>('.theme-floating.reveal-after-boot')
  if (!t || t.classList.contains('is-visible')) return
  if (!instant) {
    t.classList.add('is-visible')
    return
  }
  t.style.transition = 'none'
  t.classList.add('is-visible')
  void t.offsetWidth
  t.style.transition = ''
}
