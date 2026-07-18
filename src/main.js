import { createApp } from 'vue'
import App from './App.vue'
import './styles/neu.css'
import './plugins/icons.js'
import { BRAND_PATHS } from './data/brandGlyph.js'

createApp(App).mount('#app')

/* ============================================================
 * 开屏衔接(方案 D:同源 SVG 克隆飞行)
 *
 * 根因(三视角对抗审查确认):原方案用 HTML <span> 飞行层去对齐 SVG path
 * 墨迹,两套渲染管线度量语义不同——SVG getBoundingClientRect 返回字形
 * 墨迹盒,HTML 返回 line/em 盒(line-height:1 时≈字号);setFontToHeight
 * 令 HTML 盒高=SVG墨迹高,但 HTML 实际墨迹仅≈0.74×字号,系统性偏小约
 * 26% → 盖不住;left/top/font-size 逐帧 layout+重栅格 → 抖动;飞层独立
 * 合成层与 Hero 静态层子像素不一致 + 3 帧同框 → 落地重影。更致命的是
 * SVG 墨迹占比 0.587、HTML 占比 0.72,落地切换必有 18% 墨迹跳变,无法
 * 靠对齐消除。
 *
 * 修复:Hero 标题也用同一份 Outfit 800 SVG path(.hero-brand-svg)。描边
 * 完成后克隆 preloader SVG,用 transform: translate+scale 从描边位置飞到
 * Hero SVG 位置(同 viewBox 同墨迹比例,零对齐成本,矢量缩放不糊,GPU
 * 合成不抖)。落地 Hero SVG 亮起(被克隆盖住),下一帧移除克隆——同源
 * 同位,零跳变。pin/二分/重排全部消除。
 *
 * 同修独立时序 bug(架构改造不会自动修复):
 * - 4.5s 兜底揭示 Hero(收敛到共享 finishBoot,挂 window.__finishBoot)
 * - guard 抢先 return 前调 finishBoot(防兜底抢先时 Hero 永久隐形)
 * - 入口立即置 done=1 防兜底并发移除 preloader
 * - transitionend+setTimeout 替代固定 wait(防负载下中途硬切)
 * - document.hidden 后台标签页快进(防 rAF/transition 挂起)
 * - reduced 跳过 fonts.ready 竞态
 * - .catch 清理已提升到 body 的克隆
 * ============================================================ */

const reduced =
  window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches

const MOVE_MS = 780
const EASE = 'cubic-bezier(0.22, 1, 0.36, 1)'
/** 与 index.html pl-draw 一致: 0.15 + 8×0.1 + 0.5 */
const DRAW_MS = 150 + 800 + 500

const wait = (ms) => new Promise((r) => setTimeout(r, ms))

/** 下一帧:rAF 为主,setTimeout 兜底(后台标签页 rAF 暂停时仍能推进) */
const nextFrame = () =>
  new Promise((r) => {
    let done = false
    const fin = () => {
      if (done) return
      done = true
      r()
    }
    requestAnimationFrame(fin)
    window.setTimeout(fin, 50)
  })

function brandInk() {
  return (
    getComputedStyle(document.documentElement).getPropertyValue('--brand-ink').trim() ||
    getComputedStyle(document.documentElement).getPropertyValue('--accent-text').trim() ||
    '#5c6f7f'
  )
}

/** 全站品牌名实色钉死:preloader path / Hero path / 残留 .brand-ink */
function syncInk() {
  const ink = brandInk()
  document.documentElement.style.setProperty('--brand-ink', ink)
  document.querySelectorAll('.pl-char-path, .hero-char-path').forEach((p) => {
    p.setAttribute('fill', ink)
    p.style.fill = ink
  })
  document.querySelectorAll('.brand-ink').forEach((el) => {
    el.style.background = 'none'
    el.style.backgroundImage = 'none'
    el.style.color = ink
    el.style.webkitTextFillColor = ink
  })
  return ink
}

/** 共享收尾:揭示 Hero 标题 + 级联 reveal-after-boot。挂 window 供 index.html 兜底复用 */
function finishBoot(heroTitle) {
  document.documentElement.classList.add('boot-done')
  document.body.setAttribute('aria-busy', 'false')
  if (heroTitle) {
    heroTitle.classList.remove('handoff-pending')
    heroTitle.classList.add('is-landed')
  }
  document.querySelectorAll('.reveal-after-boot:not(.is-visible)').forEach((node, i) => {
    window.setTimeout(() => node.classList.add('is-visible'), 80 + i * 90)
  })
}
window.__finishBoot = function () {
  finishBoot(document.querySelector('.hero-title'))
}

function killPreloader(el) {
  if (!el) return
  el.dataset.done = '1'
  el.classList.add('is-done')
  el.setAttribute('aria-hidden', 'true')
  if (el.parentNode) el.parentNode.removeChild(el)
}

/** 描边钉在完成态(fill 实色,去描边) */
function finishDraw(paths, ink) {
  paths.forEach((p) => {
    p.style.animation = 'none'
    p.style.strokeDashoffset = '0'
    p.style.fillOpacity = '1'
    p.style.strokeWidth = '0'
    p.style.stroke = 'none'
    p.setAttribute('fill', ink)
    p.style.fill = ink
  })
}

/** transitionend(transform)+ setTimeout 双保险,替代固定 wait */
function onTransformEnd(el, timeout) {
  return new Promise((resolve) => {
    let done = false
    const finish = () => {
      if (done) return
      done = true
      el.removeEventListener('transitionend', onEnd)
      resolve()
    }
    const onEnd = (e) => {
      if (e.target === el && e.propertyName === 'transform') finish()
    }
    el.addEventListener('transitionend', onEnd)
    window.setTimeout(finish, timeout)
  })
}

/** dev assert:比对 index.html 内联 preloader path 与 brandGlyph.js(SSOT) */
function assertBrandSync() {
  try {
    const dom = document.querySelectorAll('#preloader-brand-svg .pl-char-path')
    if (dom.length !== BRAND_PATHS.length) {
      console.error(
        `[brand] preloader path 数量(${dom.length})与 brandGlyph.js(${BRAND_PATHS.length})不一致,飞行将错位`,
      )
      return
    }
    dom.forEach((p, i) => {
      if (p.getAttribute('d') !== BRAND_PATHS[i].d) {
        console.error(`[brand] preloader path #${i} 与 brandGlyph.js 不同源,飞行将错位`)
      }
    })
  } catch (e) {
    /* 忽略 */
  }
}

async function handoff() {
  const el = document.getElementById('preloader')
  const heroTitle = document.querySelector('.hero-title')

  // guard:已被兜底处理 → 仍要揭示 Hero(修原 guard 静默 return 致永久隐形)
  if (!el || el.dataset.done === '1') {
    finishBoot(heroTitle)
    return
  }

  // reduced 或后台标签页:rAF/transition 不可靠,直接快进
  if (reduced || document.hidden) {
    killPreloader(el)
    finishBoot(heroTitle)
    return
  }

  const brand = document.getElementById('preloader-brand-svg')
  const heroSvg = document.querySelector('.hero-brand-svg')
  const paths = [...el.querySelectorAll('.pl-char-path')]

  if (!heroTitle || !heroSvg || !brand || paths.length < 9) {
    killPreloader(el)
    finishBoot(heroTitle)
    return
  }

  // 入口立即占位,防 4.5s 兜底并发移除 preloader
  el.dataset.done = '1'

  const ink = syncInk()

  // ---- A. 描边完成态 ----
  finishDraw(paths, ink)
  void brand.offsetWidth
  await nextFrame()

  const pre = brand.getBoundingClientRect()
  // brand 异常零尺寸(被 detach 等):硬退
  if (pre.width < 2 || pre.height < 2) {
    killPreloader(el)
    finishBoot(heroTitle)
    return
  }

  // ---- B. 克隆 SVG,锁定到当前位置(fixed,视觉不动) ----
  const clone = brand.cloneNode(true)
  clone.setAttribute('aria-hidden', 'true')
  clone.classList.add('pl-fly-svg')
  clone.style.position = 'fixed'
  clone.style.left = pre.left + 'px'
  clone.style.top = pre.top + 'px'
  clone.style.width = pre.width + 'px'
  clone.style.height = pre.height + 'px'
  clone.style.margin = '0'
  clone.style.transformOrigin = '0 0'
  clone.style.willChange = 'transform'
  clone.style.zIndex = '10003'
  clone.style.pointerEvents = 'none'
  document.body.appendChild(clone)

  // 幕布硬切隐藏(无淡化)
  brand.style.visibility = 'hidden'
  el.style.visibility = 'hidden'
  el.style.pointerEvents = 'none'
  await nextFrame()

  // ---- C. 量终点,transform 飞行(同源同墨迹比例,矢量缩放不糊) ----
  const to = heroSvg.getBoundingClientRect()
  const dx = to.left - pre.left
  const dy = to.top - pre.top
  const sx = pre.width > 0 ? to.width / pre.width : 1
  const sy = pre.height > 0 ? to.height / pre.height : 1

  clone.style.transition = `transform ${MOVE_MS}ms ${EASE}`
  await nextFrame()
  clone.style.transform = `translate(${dx}px, ${dy}px) scale(${sx}, ${sy})`

  await onTransformEnd(clone, MOVE_MS + 200)

  // ---- D. 落地:Hero SVG 亮起(被克隆盖住),下一帧移除克隆(同源零跳变) ----
  clone.style.transition = 'none'
  heroTitle.classList.remove('handoff-pending')
  heroTitle.classList.add('is-landed')
  void heroSvg.offsetWidth

  await nextFrame()
  clone.remove()
  killPreloader(el)
  finishBoot(heroTitle)
}

/* boot */
syncInk()
assertBrandSync()
if (reduced) {
  // reduced:不等字体竞态,即时呈现
  wait(0).then(handoff)
} else {
  Promise.all([
    Promise.race([(document.fonts && document.fonts.ready) || Promise.resolve(), wait(2000)]),
    wait(DRAW_MS + 60),
  ])
    .then(handoff)
    .catch(() => {
      document.querySelectorAll('.pl-fly-svg').forEach((n) => n.remove())
      killPreloader(document.getElementById('preloader'))
      finishBoot(document.querySelector('.hero-title'))
    })
}
