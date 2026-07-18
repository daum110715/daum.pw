import { createApp } from 'vue'
import App from './App.vue'
import './styles/neu.css'
import './plugins/icons.js'

createApp(App).mount('#app')

/**
 * 开屏衔接
 * A. Outfit 800 字形轮廓逐字描边 + 填实(CSS pl-draw,同 fca14bf)
 * B. 实心飞行层叠在品牌位
 * C. 拆字 FLIP 飞到 Hero 标题
 * D. 同位交接
 *
 * 出场动画参考上次 git 提交的 pathLength 行笔;
 * 衔接/舞台/reveal 等为现在新增能力,一并保留。
 */
const prefersReduced =
  window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches

const LETTERS = 'daum12569'
const HOLD_MS = 220
const MOVE_MS = 820
const EASE_OUT = 'cubic-bezier(0.22, 1, 0.36, 1)'
// pl-draw: delay 0.15 + 8*0.1 + 0.45 = 1.4s
const LINE_DRAW_MS = 150 + (LETTERS.length - 1) * 100 + 450

function nextFrame() {
  return new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))
}

function wait(ms) {
  return new Promise((r) => window.setTimeout(r, ms))
}

function waitTransition(el, prop, ms) {
  return new Promise((resolve) => {
    let done = false
    const finish = () => {
      if (done) return
      done = true
      el.removeEventListener('transitionend', onEnd)
      resolve()
    }
    const onEnd = (e) => {
      if (e.target === el && (!prop || e.propertyName === prop)) finish()
    }
    el.addEventListener('transitionend', onEnd)
    window.setTimeout(finish, ms + 180)
  })
}

function box(r) {
  return {
    left: r.left,
    top: r.top,
    width: r.width,
    height: r.height,
    cx: r.left + r.width / 2,
    cy: r.top + r.height / 2,
  }
}

function finishBoot(heroTitle) {
  document.documentElement.classList.add('boot-done')
  document.body.setAttribute('aria-busy', 'false')
  if (heroTitle) {
    heroTitle.classList.remove('handoff-pending')
    heroTitle.classList.add('is-landed')
  }
  document.querySelectorAll('.reveal-after-boot').forEach((el, i) => {
    window.setTimeout(() => el.classList.add('is-visible'), 70 + i * 85)
  })
}

function simpleExit(el) {
  el.dataset.done = '1'
  el.classList.add('is-done')
  el.setAttribute('aria-hidden', 'true')
  finishBoot(document.querySelector('.hero-title'))
  const remove = () => {
    if (el.parentNode) el.parentNode.removeChild(el)
  }
  el.addEventListener(
    'animationend',
    (e) => {
      if (e.target === el) remove()
    },
    { once: true },
  )
  window.setTimeout(remove, 900)
}

function heroCharBoxes(heroBrand) {
  const text = (heroBrand.textContent || '').trim()
  if (heroBrand.childNodes.length !== 1 || heroBrand.firstChild.nodeType !== Node.TEXT_NODE) {
    heroBrand.textContent = text
  }
  const node = heroBrand.firstChild
  const range = document.createRange()
  const out = []
  for (let i = 0; i < text.length; i++) {
    range.setStart(node, i)
    range.setEnd(node, i + 1)
    out.push(box(range.getBoundingClientRect()))
  }
  return out
}

/** 在品牌位叠一层与 Hero 同字体的实心字,尺寸贴合 brand 盒 */
function buildFlyerFromBrand(brand, heroBrand) {
  const from = box(brand.getBoundingClientRect())
  if (from.width < 2 || from.height < 2) return null

  const cs = getComputedStyle(heroBrand)
  const heroFs = parseFloat(cs.fontSize) || 48
  const brandFs = from.height * 0.92
  const letterSpacing =
    cs.letterSpacing && cs.letterSpacing !== 'normal' ? cs.letterSpacing : '-0.03em'

  const layer = document.createElement('div')
  layer.className = 'pl-handoff-word'
  layer.setAttribute('aria-hidden', 'true')
  layer.style.cssText = [
    'position:fixed',
    `left:${from.left}px`,
    `top:${from.top}px`,
    `width:${from.width}px`,
    `height:${from.height}px`,
    'margin:0',
    'padding:0',
    'z-index:10002',
    'pointer-events:none',
    'display:flex',
    'align-items:center',
    'justify-content:center',
    'box-sizing:border-box',
    'opacity:0',
  ].join(';')

  const solid = document.createElement('span')
  solid.className = 'pl-brand-solid grad-text'
  solid.textContent = LETTERS
  solid.style.cssText = [
    'display:block',
    'line-height:1',
    'white-space:nowrap',
    'margin:0',
    'padding:0',
    `font-family:${cs.fontFamily}`,
    `font-weight:${cs.fontWeight || 800}`,
    `letter-spacing:${letterSpacing}`,
    `font-size:${brandFs}px`,
  ].join(';')
  layer.appendChild(solid)
  document.body.appendChild(layer)

  layer.style.opacity = '0.02'
  void solid.offsetWidth
  let sr = solid.getBoundingClientRect()
  if (sr.height > 0.5) {
    solid.style.fontSize = `${brandFs * (from.height / sr.height)}px`
    void solid.offsetWidth
    sr = solid.getBoundingClientRect()
  }
  // 宽度接近 brand 时观感更好(同 Outfit 800 轮廓)
  if (sr.width > 0.5 && Math.abs(sr.width - from.width) / from.width > 0.06) {
    const fsNow = parseFloat(solid.style.fontSize)
    solid.style.fontSize = `${fsNow * (from.width / sr.width)}px`
    void solid.offsetWidth
    sr = solid.getBoundingClientRect()
    if (sr.height > from.height * 1.1) {
      solid.style.fontSize = `${fsNow * (from.height / sr.height)}px`
      void solid.offsetWidth
      sr = solid.getBoundingClientRect()
    }
  }

  const w = Math.max(sr.width, 1)
  const h = Math.max(sr.height, 1)
  layer.style.left = `${from.cx - w / 2}px`
  layer.style.top = `${from.cy - h / 2}px`
  layer.style.width = `${w}px`
  layer.style.height = `${h}px`
  layer.style.opacity = '0'

  return {
    layer,
    solid,
    heroFs,
    fitFs: parseFloat(solid.style.fontSize) || brandFs,
  }
}

function spawnFlyers(solid, fitFs) {
  const text = (solid.textContent || LETTERS).trim()
  solid.textContent = text
  const node = solid.firstChild
  if (!node || node.nodeType !== Node.TEXT_NODE) return null

  const cs = getComputedStyle(solid)
  const range = document.createRange()
  const flyers = []

  for (let i = 0; i < text.length; i++) {
    range.setStart(node, i)
    range.setEnd(node, i + 1)
    const r = box(range.getBoundingClientRect())
    if (r.width < 0.5) continue

    const cell = document.createElement('div')
    cell.className = 'pl-letter-cell'
    cell.dataset.ch = text[i]
    cell.style.cssText = [
      'position:fixed',
      `left:${r.left}px`,
      `top:${r.top}px`,
      `width:${r.width}px`,
      `height:${r.height}px`,
      'margin:0',
      'padding:0',
      'z-index:10003',
      'pointer-events:none',
      'display:flex',
      'align-items:center',
      'justify-content:center',
      'box-sizing:border-box',
      'opacity:1',
    ].join(';')

    const span = document.createElement('span')
    span.className = 'pl-brand-solid grad-text'
    span.textContent = text[i]
    span.style.cssText = [
      'display:block',
      'line-height:1',
      'white-space:nowrap',
      'margin:0',
      'padding:0',
      `font-family:${cs.fontFamily}`,
      `font-weight:${cs.fontWeight}`,
      'letter-spacing:0',
      `font-size:${fitFs}px`,
    ].join(';')
    cell.appendChild(span)
    document.body.appendChild(cell)
    flyers.push({ cell, span, ch: text[i] })
  }
  return flyers
}

async function handoffExit(el) {
  const brand = el.querySelector('.preloader__brand')
  const paths = el.querySelectorAll('.pl-char-path')
  const heroTitle = document.querySelector('.hero-title')
  const heroBrand = document.querySelector('.hero-title .grad-text')

  if (!brand || !heroTitle || !heroBrand) {
    simpleExit(el)
    return
  }

  el.dataset.done = '1'
  heroTitle.classList.add('handoff-pending')

  // 钉死品牌位;确保描边/填色完成态
  brand.style.animation = 'none'
  brand.style.transform = 'none'
  paths.forEach((p) => {
    p.style.animation = 'none'
    p.style.strokeDashoffset = '0'
    p.style.fillOpacity = '1'
  })
  void brand.offsetWidth
  await nextFrame()

  // 提示/进度退场(品牌已填实)
  el.classList.add('is-filling')
  if (HOLD_MS > 0) await wait(HOLD_MS)

  // ========== 飞向 Hero ==========
  const flyer = buildFlyerFromBrand(brand, heroBrand)
  if (!flyer) {
    simpleExit(el)
    return
  }
  const { layer, solid, heroFs, fitFs } = flyer

  brand.style.visibility = 'hidden'
  brand.style.opacity = '0'
  layer.style.opacity = '1'
  void layer.offsetWidth

  void heroBrand.offsetWidth
  await nextFrame()
  const targets = heroCharBoxes(heroBrand)
  if (targets.length < LETTERS.length) {
    layer.remove()
    simpleExit(el)
    return
  }

  const flyers = spawnFlyers(solid, fitFs)
  if (!flyers || flyers.length < LETTERS.length) {
    layer.remove()
    simpleExit(el)
    return
  }
  layer.remove()

  el.classList.add('is-done', 'is-handoff', 'is-morphing')
  el.setAttribute('aria-hidden', 'true')

  flyers.forEach(({ cell, span }, i) => {
    const delay = Math.min(i * 16, 90)
    cell.style.transition = [
      `left ${MOVE_MS}ms ${EASE_OUT}`,
      `top ${MOVE_MS}ms ${EASE_OUT}`,
      `width ${MOVE_MS}ms ${EASE_OUT}`,
      `height ${MOVE_MS}ms ${EASE_OUT}`,
    ].join(',')
    span.style.transition = `font-size ${MOVE_MS}ms ${EASE_OUT}`
    cell.style.transitionDelay = `${delay}ms`
    span.style.transitionDelay = `${delay}ms`
  })

  await nextFrame()
  flyers.forEach((f, i) => {
    f.to = targets[i]
  })
  flyers.forEach(({ cell, span, to }) => {
    cell.style.left = `${to.left}px`
    cell.style.top = `${to.top}px`
    cell.style.width = `${Math.max(to.width, 1)}px`
    cell.style.height = `${Math.max(to.height, 1)}px`
    span.style.fontSize = `${heroFs}px`
  })

  const maxDelay = Math.min((flyers.length - 1) * 16, 90)
  await waitTransition(flyers[0].cell, 'left', MOVE_MS + maxDelay)

  flyers.forEach(({ cell, span, to }) => {
    cell.style.transition = 'none'
    span.style.transition = 'none'
    cell.style.left = `${to.left}px`
    cell.style.top = `${to.top}px`
    cell.style.width = `${Math.max(to.width, 1)}px`
    cell.style.height = `${Math.max(to.height, 1)}px`
    span.style.fontSize = `${heroFs}px`
  })
  void flyers[0].cell.offsetWidth

  // ========== 交接 ==========
  heroTitle.classList.remove('handoff-pending')
  heroTitle.classList.add('is-landed')
  void heroBrand.offsetWidth
  flyers.forEach(({ cell }) => {
    if (cell.parentNode) cell.parentNode.removeChild(cell)
  })
  if (el.parentNode) el.parentNode.removeChild(el)
  finishBoot(heroTitle)
}

function hidePreloader() {
  const el = document.getElementById('preloader')
  if (!el || el.dataset.done === '1') return

  if (prefersReduced) {
    el.dataset.done = '1'
    el.classList.add('is-done', 'is-filling')
    el.setAttribute('aria-hidden', 'true')
    if (el.parentNode) el.parentNode.removeChild(el)
    finishBoot(document.querySelector('.hero-title'))
    return
  }

  handoffExit(el).catch(() => simpleExit(el))
}

const fontReady = (document.fonts && document.fonts.ready) || Promise.resolve()
const cap = prefersReduced ? 600 : 2000
const minDisplay = prefersReduced ? 0 : LINE_DRAW_MS + 120

Promise.all([
  Promise.race([fontReady, new Promise((r) => setTimeout(r, cap))]),
  new Promise((r) => setTimeout(r, minDisplay)),
]).then(hidePreloader)
