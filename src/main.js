import { createApp } from 'vue'
import App from './App.vue'
import './styles/neu.css'
import './plugins/icons.js'
import { BRAND_PATHS } from './data/brandGlyph.js'

createApp(App).mount('#app')

/* ============================================================
 * 旧版回流到达幕布
 * index.html head 已在首帧前给 <html> 挂 data-from-legacy,
 * body::after 以 --bg 满幅遮盖。此处 boot 早期触发虹膜揭示:
 * mask 开孔自旧版「新版」按钮同轴位置放大,品牌描边在渐开的
 * 虹膜下显现——离场(旧版虹膜合拢遮盖)与到岸(新版虹膜开孔揭示)
 * 严格互逆,同一语言、同一节奏、同一轴线。
 * ============================================================ */
function openReturnVeil() {
  const root = document.documentElement
  if (root.getAttribute('data-from-legacy') !== '1') return
  if (root.classList.contains('return-veil-open')) return
  // 清 URL 参数,防刷新/分享重演转场
  try {
    history.replaceState(null, '', location.pathname + location.hash)
  } catch (e) {}
  root.classList.add('return-veil-open')
  window.setTimeout(() => {
    root.removeAttribute('data-from-legacy')
    root.classList.remove('return-veil-open')
  }, 1000)
}

const reducedMotion =
  window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches

if (reducedMotion) {
  document.documentElement.removeAttribute('data-from-legacy')
} else {
  requestAnimationFrame(() => requestAnimationFrame(openReturnVeil))
}

// bfcache 恢复(浏览器后退):head 检测脚本不重跑,按会话标记补开虹膜
window.addEventListener('pageshow', (e) => {
  if (!e.persisted || reducedMotion) return
  let flagged = false
  try {
    flagged = sessionStorage.getItem('daum-legacy-visit') === '1'
    sessionStorage.removeItem('daum-legacy-visit')
  } catch (err) {}
  if (!flagged) return
  document.documentElement.setAttribute('data-from-legacy', '1')
  requestAnimationFrame(() => requestAnimationFrame(openReturnVeil))
})

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
/** 品牌字飞行:略带回弹感的 ease-out */
const EASE = 'cubic-bezier(0.22, 1, 0.36, 1)'
/**
 * 进度条走满 + 变形统一 smooth 缓动(无折点)。
 * 走满由 runProgressFill 精确驱动,禁止中途 freeze 硬拉满。
 */
const SMOOTH = 'cubic-bezier(0.45, 0.05, 0.25, 1)'
/** 变形与字飞行同长,两者并行 */
const MORPH_MS = MOVE_MS
/** 真正走满 100% 后再停顿,然后飞/变形 */
const HOLD_MS = 500
/**
 * 与品牌描边同窗:
 * 首字 delay 0.15s, 末字结束 1.45s → 进度 0.15s 起步、1.3s 走满
 */
const BRAND_DRAW_DELAY_MS = 150
const BRAND_DRAW_SPAN_MS = 1300
const DRAW_MS = BRAND_DRAW_DELAY_MS + BRAND_DRAW_SPAN_MS

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

/**
 * 进度条 0→100%:与描边同窗,单一 transition 走满。
 * 等 transitionend 才算完成——绝不在中途把宽度硬拉满。
 */
async function runProgressFill(fill) {
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

  await new Promise((resolve) => {
    let done = false
    const fin = () => {
      if (done) return
      done = true
      fill.removeEventListener('transitionend', onEnd)
      resolve()
    }
    const onEnd = (e) => {
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
function freezeProgress(fill) {
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

function boxKeyframes(from, to) {
  const frame = (r) => ({
    left: r.left + 'px',
    top: r.top + 'px',
    width: r.width + 'px',
    height: r.height + 'px',
  })
  return [frame(from), frame(to)]
}

function pinFixedBox(node, rect, z) {
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

/**
 * 进度条 → 主题按钮:WAAPI 单段插值,与字飞行并行。
 * 轨道/填充均为 body 级 fixed,视口绝对几何,无父子裁切。
 */
async function morphBarToToggle(prog, fill, trackEnd, thumbEnd) {
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

  const opts = { duration: MORPH_MS, easing: SMOOTH, fill: 'forwards' }
  const aTrack = prog.animate(boxKeyframes(trackStart, trackEnd), opts)
  const aFill = fill.animate(boxKeyframes(fillStart, thumbEnd), opts)
  await Promise.all([aTrack.finished.catch(() => {}), aFill.finished.catch(() => {})])

  // 提交终态,取消 WAAPI 残留
  pinFixedBox(prog, trackEnd, 10002)
  pinFixedBox(fill, thumbEnd, 10003)
  aTrack.cancel()
  aFill.cancel()
}

function brandInk() {
  return (
    getComputedStyle(document.documentElement).getPropertyValue('--brand-ink').trim() ||
    getComputedStyle(document.documentElement).getPropertyValue('--accent-text').trim() ||
    '#b45309'
  )
}

/** 品牌名渐变(SVG url(#*BrandGrad) 由 CSS stop-color 跟随主题);残留 .brand-ink 仍钉实色 */
function syncInk() {
  const ink = brandInk()
  document.documentElement.style.setProperty('--brand-ink', ink)
  document.querySelectorAll('.brand-ink').forEach((el) => {
    el.style.background = 'none'
    el.style.backgroundImage = 'none'
    el.style.color = ink
    el.style.webkitTextFillColor = ink
  })
  return ink
}

/** 共享收尾:揭示 Hero 标题 + 级联 reveal-after-boot。挂 window 供 index.html 兜底复用。
    主题切换按钮(.theme-floating)不在此级联:正常路径由进度条变形归位后 revealToggle 点亮 */
function finishBoot(heroTitle) {
  document.documentElement.classList.add('boot-done')
  document.body.setAttribute('aria-busy', 'false')
  if (heroTitle) {
    heroTitle.classList.remove('handoff-pending')
    heroTitle.classList.add('is-landed')
  }
  document
    .querySelectorAll('.reveal-after-boot:not(.is-visible):not(.theme-floating)')
    .forEach((node, i) => {
      window.setTimeout(() => node.classList.add('is-visible'), 80 + i * 90)
    })
}
/** 点亮主题切换按钮。instant:跳过 .reveal 过渡立即呈现——
    变形接管时假进度条正盖在同位,必须瞬亮后下一帧撤假条才零跳变 */
function revealToggle(instant) {
  const t = document.querySelector('.theme-floating.reveal-after-boot')
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
window.__finishBoot = function () {
  finishBoot(document.querySelector('.hero-title'))
  revealToggle()
}

function killPreloader(el) {
  if (!el) return
  el.dataset.done = '1'
  el.classList.add('is-done')
  el.setAttribute('aria-hidden', 'true')
  if (el.parentNode) el.parentNode.removeChild(el)
}

/** 描边钉在完成态(显渐变填充,去描边) */
function finishDraw(paths) {
  paths.forEach((p) => {
    p.style.animation = 'none'
    p.style.strokeDashoffset = '0'
    p.style.fillOpacity = '1'
    p.style.strokeWidth = '0'
    p.style.stroke = 'none'
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
    revealToggle()
    return
  }

  // reduced 或后台标签页:rAF/transition 不可靠,直接快进
  if (reduced || document.hidden) {
    killPreloader(el)
    finishBoot(heroTitle)
    revealToggle()
    return
  }

  const brand = document.getElementById('preloader-brand-svg')
  const heroSvg = document.querySelector('.hero-brand-svg')
  const paths = [...el.querySelectorAll('.pl-char-path')]
  const progFill = el.querySelector('.preloader__progress-fill')

  if (!heroTitle || !heroSvg || !brand || paths.length < 9) {
    killPreloader(el)
    finishBoot(heroTitle)
    revealToggle()
    return
  }

  // 入口立即占位,防 4.5s 兜底并发移除 preloader
  el.dataset.done = '1'

  const ink = syncInk()

  // ---- A. 描边完成态(进度已在 boot 阶段完整走满并停顿过) ----
  finishDraw(paths, ink)
  freezeProgress(progFill)
  void brand.offsetWidth
  await nextFrame()

  const pre = brand.getBoundingClientRect()
  if (pre.width < 2 || pre.height < 2) {
    killPreloader(el)
    finishBoot(heroTitle)
    revealToggle()
    return
  }

  // ---- B. 克隆字 + 提升进度条(不随 preloader 隐藏) ----
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
  clone.style.zIndex = '10004'
  clone.style.pointerEvents = 'none'
  document.body.appendChild(clone)

  const prog = el.querySelector('.preloader__progress')
  const fill = prog && prog.querySelector('.preloader__progress-fill')
  if (prog) {
    const pr = prog.getBoundingClientRect()
    document.body.appendChild(prog)
    pinFixedBox(prog, pr, 10002)
    prog.style.borderRadius = '9999px'
    prog.style.overflow = 'hidden'
  }

  brand.style.visibility = 'hidden'
  el.style.visibility = 'hidden'
  el.style.pointerEvents = 'none'
  killPreloader(el)
  await nextFrame()

  // ---- C+E 并行:字飞向 Hero + 进度条变形为 ThemeToggle(同长同节奏,条不满格停住) ----
  const to = heroSvg.getBoundingClientRect()
  const dx = to.left - pre.left
  const dy = to.top - pre.top
  const sx = pre.width > 0 ? to.width / pre.width : 1
  const sy = pre.height > 0 ? to.height / pre.height : 1

  const toggleEl = document.querySelector('.theme-floating')
  const track = toggleEl && toggleEl.querySelector('.track')
  const thumb = toggleEl && toggleEl.querySelector('.thumb')

  let trackEnd = null
  let thumbEnd = null
  if (toggleEl && track && thumb) {
    toggleEl.style.transition = 'none'
    toggleEl.style.transform = 'none'
    void toggleEl.offsetWidth
    trackEnd = track.getBoundingClientRect()
    thumbEnd = thumb.getBoundingClientRect()
  }

  clone.style.transition = `transform ${MOVE_MS}ms ${EASE}`
  await nextFrame()
  clone.style.transform = `translate(${dx}px, ${dy}px) scale(${sx}, ${sy})`

  const brandP = onTransformEnd(clone, MOVE_MS + 200)
  const morphP =
    prog && fill && trackEnd && thumbEnd
      ? morphBarToToggle(prog, fill, trackEnd, thumbEnd)
      : Promise.resolve()

  await Promise.all([brandP, morphP])

  // ---- D. 字落地 + 真按钮接管(假层同位瞬亮后卸) ----
  clone.style.transition = 'none'
  heroTitle.classList.remove('handoff-pending')
  heroTitle.classList.add('is-landed')
  void heroSvg.offsetWidth
  await nextFrame()
  clone.remove()

  finishBoot(heroTitle)

  if (prog && fill && trackEnd) {
    revealToggle(true)
    if (toggleEl) toggleEl.style.transform = ''
    await nextFrame()
    prog.remove()
    fill.remove()
  } else {
    if (prog) prog.remove()
    if (fill) fill.remove()
    revealToggle()
  }
}

/* boot */
syncInk()
assertBrandSync()
const bootFill = document.querySelector('.preloader__progress-fill')
const bootCatch = () => {
  document.querySelectorAll('.pl-fly-svg').forEach((n) => n.remove())
  document.querySelectorAll('body > .preloader__progress, body > .preloader__progress-fill').forEach((n) => n.remove())
  killPreloader(document.getElementById('preloader'))
  finishBoot(document.querySelector('.hero-title'))
  revealToggle()
}
if (reduced) {
  if (bootFill) {
    bootFill.style.transition = 'none'
    bootFill.style.width = '100%'
  }
  wait(0).then(handoff).catch(bootCatch)
} else {
  // 等:字体 + 描边窗 + 进度条真正 transition 到 100% → 停顿 0.5s → 再飞/变形
  Promise.all([
    Promise.race([(document.fonts && document.fonts.ready) || Promise.resolve(), wait(2000)]),
    wait(DRAW_MS),
    runProgressFill(bootFill),
  ])
    .then(async () => {
      await wait(HOLD_MS)
      return handoff()
    })
    .catch(bootCatch)
}
