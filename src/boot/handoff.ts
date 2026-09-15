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
import {
  reduced,
  nextFrame,
  onTransformEnd,
  MOVE_MS,
  EASE,
} from './timing'
import {
  pinFixedBox,
  cssColor,
  syncInk,
  killPreloader,
  finishDraw,
} from './domFx'
import {
  freezeProgress,
  morphBarToToggle,
  measureToggleMorphEnds,
  revealToggle,
} from './toggleMorph'
import { splitVeilIntoSocial } from './veilSplit'
import { finishBoot } from './finishBoot'
import { bootResumeY } from './scrollLock'

/**
 * 非首页刷新 handoff:
 * 不再飞向 Hero 大标题(落地后 restore 会瞬移顶栏,动画被短路成跳变)。
 * 已过 pin 终点 → 同源克隆飞向停靠位,再 restore+commit+展开;
 * pin 中段 → 卸 preloader,restore 后由 ST scrub 摆姿态。
 * 进度条仍变形为 ThemeToggle(与首页同节奏)。
 */
async function handoffResume(el: HTMLElement, heroTitle: Element | null) {
  el.dataset.done = '1'
  window.scrollTo(0, 0)

  const brand = document.getElementById('preloader-brand-svg')
  const paths = [...el.querySelectorAll<SVGElement>('.pl-char-path')]
  const progFill = el.querySelector<HTMLElement>('.preloader__progress-fill')
  finishDraw(paths)
  freezeProgress(progFill)
  if (brand) void brand.offsetWidth
  await nextFrame()

  /* 与 HeroSection RANGE_VH=0.4 对齐:超过 pin 行程视为已停靠分区 */
  const PIN_RANGE_VH = 0.4
  const pinEndY = Math.round(window.innerHeight * PIN_RANGE_VH)
  const deep = bootResumeY >= pinEndY * 0.95

  if (typeof window.__prepareBrandDockForBoot === 'function') {
    window.__prepareBrandDockForBoot()
  }

  const pre = brand ? brand.getBoundingClientRect() : null
  const dock: BoxRect | null =
    deep && typeof window.__getBrandDockTarget === 'function'
      ? window.__getBrandDockTarget()
      : null
  const canFlyDock =
    deep && brand && pre && pre.width >= 2 && pre.height >= 2 && dock && dock.width >= 2

  let clone: HTMLElement | null = null
  if (canFlyDock) {
    clone = brand.cloneNode(true) as HTMLElement
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
  }

  const prog = el.querySelector<HTMLElement>('.preloader__progress')
  const fill = prog && prog.querySelector<HTMLElement>('.preloader__progress-fill')
  if (prog) {
    const pr = prog.getBoundingClientRect()
    document.body.appendChild(prog)
    pinFixedBox(prog, pr, 10002)
    prog.style.borderRadius = '9999px'
    prog.style.overflow = 'hidden'
  }

  if (brand) brand.style.visibility = 'hidden'
  el.style.visibility = 'hidden'
  el.style.pointerEvents = 'none'
  killPreloader(el)
  window.scrollTo(0, 0)
  await nextFrame()

  const ends = measureToggleMorphEnds()
  const morphP =
    prog && fill && ends
      ? morphBarToToggle(prog, fill, ends.trackEnd, ends.thumbEnd, ends.endBgs)
      : Promise.resolve()

  let brandP: Promise<void> = Promise.resolve()
  if (clone && dock && pre) {
    const dx = dock.left - pre.left
    const dy = dock.top - pre.top
    const sx = pre.width > 0 ? dock.width / pre.width : 1
    const sy = pre.height > 0 ? dock.height / pre.height : 1
    clone.style.transition = `transform ${MOVE_MS}ms ${EASE}`
    await nextFrame()
    clone.style.transform = `translate(${dx}px, ${dy}px) scale(${sx}, ${sy})`
    brandP = onTransformEnd(clone, MOVE_MS + 200)
  }

  await Promise.all([brandP, morphP])

  if (clone) clone.style.transition = 'none'
  // 先 restore+commit 再卸克隆:停靠态真身与飞层同位,零跳变
  await finishBoot(heroTitle, { resume: true })
  await nextFrame()
  if (clone) clone.remove()

  if (prog && fill && ends) {
    revealToggle(true)
    if (ends.toggleEl) ends.toggleEl.style.transform = ''
    await nextFrame()
    prog.remove()
    fill.remove()
  } else {
    if (prog) prog.remove()
    if (fill) fill.remove()
    revealToggle()
  }
}

export async function handoff() {
  const el = document.getElementById('preloader')
  const heroTitle = document.querySelector<HTMLElement>('.hero-title')

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

  // 非首页刷新:勿飞大标题再 restore 瞬移——走停靠/中段恢复路径
  if (bootResumeY > 1) {
    try {
      await handoffResume(el, heroTitle)
    } catch (e) {
      document.querySelectorAll('.pl-fly-svg').forEach((n) => n.remove())
      killPreloader(document.getElementById('preloader'))
      finishBoot(heroTitle, { resume: true })
      revealToggle()
    }
    return
  }

  const brand = document.getElementById('preloader-brand-svg')
  const heroSvg = document.querySelector<HTMLElement>('.hero-brand-svg')
  const paths = [...el.querySelectorAll<SVGElement>('.pl-char-path')]
  const progFill = el.querySelector<HTMLElement>('.preloader__progress-fill')

  if (!heroTitle || !heroSvg || !brand || paths.length < 9) {
    killPreloader(el)
    finishBoot(heroTitle)
    revealToggle()
    return
  }

  // 入口立即占位,防 4.5s 兜底并发移除 preloader
  el.dataset.done = '1'

  /* 量测前强制顶:任何中途滚位都会让 heroSvg rect 离屏,飞行目标错位 */
  window.scrollTo(0, 0)

  syncInk()

  // ---- A. 描边完成态(进度已在 boot 阶段完整走满并停顿过) ----
  finishDraw(paths)
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
  const clone = brand.cloneNode(true) as HTMLElement
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

  const prog = el.querySelector<HTMLElement>('.preloader__progress')
  const fill = prog && prog.querySelector<HTMLElement>('.preloader__progress-fill')
  if (prog) {
    const pr = prog.getBoundingClientRect()
    document.body.appendChild(prog)
    pinFixedBox(prog, pr, 10002)
    prog.style.borderRadius = '9999px'
    prog.style.overflow = 'hidden'
  }

  brand.style.visibility = 'hidden'

  /* ---- B2. loading 背景归宿:preloader 底即 --bg-2 实色,veil 直接以同色
     起幕接管硬切,与品牌飞行同窗收回成社交行整宽的圆角长方形(与展开后
     同位同宽高);落地后分裂成各图标底块(splitVeilIntoSocial),全程同色
     无需颜色/渐变过渡。
     开屏三归宿同场:品牌字→标题,进度条→主题开关,背景→社交胶囊 ---- */
  const heroSocialEl = document.querySelector<HTMLElement>('.hero-social')
  const socialRowEl = document.querySelector<HTMLElement>('.social-row')
  const rowRect = socialRowEl ? socialRowEl.getBoundingClientRect() : null
  const canVeil = !!(heroSocialEl && rowRect && rowRect.width >= 40)
  let veil: HTMLElement | null = null
  let veilP: Promise<void> = Promise.resolve()
  let barRect: BoxRect | null = null
  if (canVeil && socialRowEl) {
    const bg2 = cssColor('--bg-2', '#ffffff')
    barRect = {
      left: rowRect.left,
      top: rowRect.top,
      width: rowRect.width,
      height: rowRect.height,
    }
    veil = document.createElement('div')
    veil.className = 'boot-veil'
    veil.style.cssText = `position:fixed;left:0;top:0;width:${window.innerWidth}px;height:${window.innerHeight}px;z-index:9998;pointer-events:none;overflow:hidden;background:${bg2};`
    document.body.appendChild(veil)

    const itemRadius = socialRowEl.firstElementChild
      ? getComputedStyle(socialRowEl.firstElementChild).borderRadius
      : '0px'
    const veilFrom = {
      left: '0px',
      top: '0px',
      width: window.innerWidth + 'px',
      height: window.innerHeight + 'px',
      borderRadius: '0px',
    }
    const veilTo = {
      left: barRect.left + 'px',
      top: barRect.top + 'px',
      width: barRect.width + 'px',
      height: barRect.height + 'px',
      borderRadius: itemRadius,
    }
    const aBox = veil.animate([veilFrom, veilTo], {
      duration: MOVE_MS,
      easing: EASE,
      fill: 'forwards',
    })
    veilP = aBox.finished.catch(() => {}).then(() => {
      /* 钉终态后卸 WAAPI,防残留 */
      if (!veil) return
      veil.style.left = veilTo.left
      veil.style.top = veilTo.top
      veil.style.width = veilTo.width
      veil.style.height = veilTo.height
      veil.style.borderRadius = veilTo.borderRadius
      aBox.cancel()
    })
  }

  el.style.visibility = 'hidden'
  el.style.pointerEvents = 'none'
  killPreloader(el)
  window.scrollTo(0, 0)
  await nextFrame()

  // ---- C+E 并行:字飞向 Hero + 进度条变形为 ThemeToggle(同长同节奏,条不满格停住) ----
  const to = heroSvg.getBoundingClientRect()
  const dx = to.left - pre.left
  const dy = to.top - pre.top
  const sx = pre.width > 0 ? to.width / pre.width : 1
  const sy = pre.height > 0 ? to.height / pre.height : 1

  const ends = measureToggleMorphEnds()
  const trackEnd = ends?.trackEnd
  const thumbEnd = ends?.thumbEnd
  const endBgs = ends?.endBgs ?? null
  const toggleEl = ends?.toggleEl

  clone.style.transition = `transform ${MOVE_MS}ms ${EASE}`
  await nextFrame()
  clone.style.transform = `translate(${dx}px, ${dy}px) scale(${sx}, ${sy})`

  const brandP = onTransformEnd(clone, MOVE_MS + 200)
  const morphP =
    prog && fill && trackEnd && thumbEnd
      ? morphBarToToggle(prog, fill, trackEnd, thumbEnd, endBgs)
      : Promise.resolve()

  await Promise.all([brandP, morphP, veilP])

  // ---- D. 字落地 + 真按钮接管(假层同位瞬亮后卸) ----
  clone.style.transition = 'none'
  heroTitle.classList.remove('handoff-pending')
  heroTitle.classList.add('is-landed')
  void heroSvg.offsetWidth
  await nextFrame()
  clone.remove()

  /* veil 落地成整行长方形 → 分裂成各图标底块 → 点亮社交胶囊(hold 延展滚动锁) */
  const socialRevealP =
    veil && barRect && socialRowEl
      ? splitVeilIntoSocial(veil, socialRowEl, heroSocialEl, barRect)
      : Promise.resolve()
  finishBoot(heroTitle, { skipSocial: !!veil, hold: socialRevealP })

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
