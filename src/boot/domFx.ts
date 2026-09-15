/* ============================================================
 * 开屏 DOM 小件 —— 几何帧/fixed 钉盒/CSS 颜色/墨迹/描边态/preloader 清理
 * 与 dev assert(brandGlyph SSOT 比对)。
 * ============================================================ */
import { BRAND_PATHS } from '@/data/brandGlyph'

export function boxKeyframes(from: BoxRect, to: BoxRect): Keyframe[] {
  const frame = (r: BoxRect) => ({
    left: r.left + 'px',
    top: r.top + 'px',
    width: r.width + 'px',
    height: r.height + 'px',
  })
  return [frame(from), frame(to)]
}

export function pinFixedBox(node: HTMLElement, rect: BoxRect, z: number) {
  node.style.transition = 'none'
  node.style.animation = 'none'
  node.style.position = 'fixed'
  node.style.left = rect.left + 'px'
  node.style.top = rect.top + 'px'
  node.style.width = rect.width + 'px'
  node.style.height = rect.height + 'px'
  node.style.right = 'auto'
  node.style.bottom = 'auto'
  node.style.margin = '0'
  node.style.zIndex = String(z)
  node.style.pointerEvents = 'none'
  node.style.borderRadius = '9999px'
}

/** 读取 CSS 变量的计算色值(--bg/--bg-2 均为 hex,WAAPI backgroundColor 需要实色) */
export function cssColor(name: string, fallback: string) {
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim()
  return v || fallback
}

function brandInk() {
  return (
    getComputedStyle(document.documentElement).getPropertyValue('--brand-ink').trim() ||
    getComputedStyle(document.documentElement).getPropertyValue('--accent-text').trim() ||
    '#b45309'
  )
}

/** 品牌名:CSS --brand-ink 随 data-theme 切换;勿写进 html 内联,否则会钉死开机色盖住主题变量。
 *  仅清掉残留 .brand-ink 的渐变/实色内联,交还给 var(--brand-ink) */
export function syncInk() {
  document.querySelectorAll<HTMLElement>('.brand-ink').forEach((el) => {
    el.style.background = 'none'
    el.style.backgroundImage = 'none'
    el.style.color = ''
    el.style.webkitTextFillColor = ''
  })
  /* 若历史会话曾写过 html 内联 --brand-ink,清掉以免钉死 */
  document.documentElement.style.removeProperty('--brand-ink')
  return brandInk()
}

export function killPreloader(el: HTMLElement | null) {
  if (!el) return
  el.dataset.done = '1'
  el.classList.add('is-done')
  el.setAttribute('aria-hidden', 'true')
  if (el.parentNode) el.parentNode.removeChild(el)
}

/** 描边钉在完成态(显渐变填充,去描边) */
export function finishDraw(paths: SVGElement[]) {
  paths.forEach((p) => {
    p.style.animation = 'none'
    p.style.strokeDashoffset = '0'
    p.style.fillOpacity = '1'
    p.style.strokeWidth = '0'
    p.style.stroke = 'none'
  })
}

/** dev assert:比对 index.html 内联 preloader path 与 brandGlyph.ts(SSOT) */
export function assertBrandSync() {
  try {
    const dom = document.querySelectorAll('#preloader-brand-svg .pl-char-path')
    if (dom.length !== BRAND_PATHS.length) {
      console.error(
        `[brand] preloader path 数量(${dom.length})与 brandGlyph.ts(${BRAND_PATHS.length})不一致,飞行将错位`,
      )
      return
    }
    dom.forEach((p, i) => {
      if (p.getAttribute('d') !== BRAND_PATHS[i].d) {
        console.error(`[brand] preloader path #${i} 与 brandGlyph.ts 不同源,飞行将错位`)
      }
    })
  } catch (e) {
    /* 忽略 */
  }
}
