import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { beamDock } from './useBeamMerge'

/* ============================================================
 * beam 展开叙事(grow)—— 横梁合并钉位后,滑入第二页时平滑
 * 变形成左侧正方形品牌卡:
 *
 *   beam(英雄段钉位的横梁)
 *     → 原地展开:几何插值直奔方卡落定槽位,尺寸+位移同帧
 *       完成,卡片阴影同步淡入——横梁全程读作"同一块板"
 *     → 展开到最大即站在最终位置,钉住别动,等页面追上来
 *     → 到位后真卡阶跃不透明(beam 同色全盖,不可见)
 *     → beam 淡出交还 DOM,卡内品牌字 .is-born 淡入
 *
 * 编排(scrub 全程可逆):
 * - p 0→EXPAND_END:beam → 落定槽位,easeOut(与 mergeAmount 同式)
 * - p 其后→SET_SOLID:钉在落定槽位静态等待(页面滑入收尾)
 * - p ≥SET_SOLID  :真卡阶跃不透明(beam 仍全盖,同色不可见)
 * - p GHOST_OUT   :beam 连阴影淡出揭示 → visibility hidden
 * - p ≥BORN       :.is-born 卡内 SVG 淡入(CSS transition,
 *   回滚自动反向播放)
 *
 * 实现要点:
 * - 落定槽位 = 实时卡 rect 减去 section 顶距(顶距 = 页面剩余
 *   滑入行程,p=1 时为零):目标是常量,轨迹天然单调;
 *   不追实时位置(那会先下扎再回头),收敛由构造保证。
 * - 起点 beamDock.rect 钉死;卡尺寸/横向每帧现测,深刷/字体位移免疫。
 * - 只写 beam 的 left/top/width/height/box-shadow/opacity
 *   (beam 本就是 body 级 fixed 假层,零文档布局)。
 * - 圆角恒定 var(--radius)(18px),beam 与卡天然同形,无需插值。
 * - 与 useBeamMerge 互不干扰:回滚 p→0 时 beam 钉回
 *   beamDock.rect 原样,unbake 照旧接管。
 *
 * 坑(2026-08):本 ST 挂载早于 hero build()(pin/pin-spacer 后插),
 * 首量 start 少了 pin 行程;GSAP refresh 按 start 排序且量测时
 * 临时还原 pin → 本 ST 恒排在 hero pin 前、恒在 pin 还原态量测,
 * 错误自我强化(肉眼即"动画抢跑一帧跳变")。refresh 补不回来,
 * 必须 refreshPriority:-1 钉死"在 hero pin 之后刷新"。
 *
 * 坑2(2026-08):grow 行程起点(page-2 抵视口底)早于 bake 点
 * (hero pin 终点),两者之间进度空攒;bake 瞬间若直接按 ST 进度
 * 驱动,beam 会从合并态闪跳到膨胀中途。故捕获接管瞬间进度 p0
 * 为零点,以其后局部进度 pg 驱动,起点严丝合缝。
 * ============================================================ */
const EXPAND_END = 0.6 /* 展开窗 [0, EXPAND_END]:到位即最终位置 */
const SET_SOLID = 0.97 /* 真卡阶跃点(beam 仍全盖,同色不可见) */
const GHOST_OUT = [0.975, 1] /* beam 淡出揭示窗(末段,与真卡收敛零错位) */
const BORN = 0.97 /* 卡内 SVG 淡入阈值 */

const clamp01 = (t) => Math.min(1, Math.max(0, t))
const easeOut = (t) => 1 - (1 - t) * (1 - t) /* 与 mergeAmount 同式 power2.out */

const lerp = (a, b, t) => a + (b - a) * t
const lerpRect = (a, b, t) => ({
  left: lerp(a.left, b.left, t),
  top: lerp(a.top, b.top, t),
  width: lerp(a.width, b.width, t),
  height: lerp(a.height, b.height, t),
})

/* beam 阴影 = 方卡同款双侧 neu 阴影,alpha 随膨胀/淡出缩放;
   color-mix 派生透明色,不写第三份近似色,深浅主题自适应 */
const beamShadow = (a) =>
  a <= 0
    ? 'none'
    : `8px 8px 20px color-mix(in srgb, var(--shadow-dark) ${(a * 100).toFixed(1)}%, transparent),` +
      `-8px -8px 20px color-mix(in srgb, var(--shadow-light) ${(a * 100).toFixed(1)}%, transparent)`

/**
 * @param {object} opts
 * @param {HTMLElement} opts.cardEl   方卡真身(文档流内)
 * @param {HTMLElement} opts.sectionEl 第二页 section(挂 .is-born)
 * @param {string}  [opts.trigger]  ScrollTrigger trigger(默认 '#page-2')
 * @param {boolean} [opts.reduced]  prefers-reduced-motion:直显兜底
 * @returns {() => void} destroy
 */
export function initBeamGrow(opts = {}) {
  const { cardEl, sectionEl, trigger = '#page-2', reduced = false } = opts
  if (!cardEl || !sectionEl) return () => {}
  gsap.registerPlugin(ScrollTrigger)

  /* 真卡初始隐藏(未展开到位前不露);reduced 直显兜底 */
  cardEl.style.opacity = '0'
  if (reduced) {
    cardEl.style.opacity = '1'
    sectionEl.classList.add('is-born')
    return () => {}
  }

  /* 接管零点:bake 瞬间的 ST 进度(此前 apply 早退,进度空攒);
     以其后局部进度 pg 驱动,展开起点与合并态严丝合缝 */
  let p0 = null

  function apply(p) {
    /* beam 未钉位(还在 hero 段):等 hero p=1 bake 后接管 */
    if (!beamDock.baked || !beamDock.el || !beamDock.rect) return
    const beam = beamDock.el
    const r0 = beamDock.rect
    const rCard = cardEl.getBoundingClientRect()

    /* 局部进度:深刷还原时 p0=p=1 → pg 钉 1(0/0 兜底) */
    if (p0 === null) p0 = p
    const pg = p0 >= 1 ? 1 : clamp01((p - p0) / (1 - p0))

    /* 展开直奔落定槽位:落定位置 = 实时卡 rect 减去 section 顶距
       (顶距 = 页面剩余滑入行程,p=1 时为零,收敛由构造保证);
       尺寸+位移同一插值,到位即最终位置,之后钉住别动 */
    const tE = easeOut(clamp01(pg / EXPAND_END))
    const secTop = sectionEl.getBoundingClientRect().top
    const rSettled = {
      left: rCard.left,
      top: rCard.top - secTop,
      width: rCard.width,
      height: rCard.height,
    }
    const r = lerpRect(r0, rSettled, tE)
    const ghostO = 1 - clamp01((pg - GHOST_OUT[0]) / (GHOST_OUT[1] - GHOST_OUT[0]))

    beam.style.left = `${r.left.toFixed(2)}px`
    beam.style.top = `${r.top.toFixed(2)}px`
    beam.style.width = `${r.width.toFixed(2)}px`
    beam.style.height = `${r.height.toFixed(2)}px`
    beam.style.boxShadow = beamShadow(tE * ghostO)
    beam.style.opacity = ghostO.toFixed(3)

    /* 真卡阶跃不透明(被同色 beam 全盖,无双层半透明透出) */
    cardEl.style.opacity = pg >= SET_SOLID ? '1' : '0'

    /* 揭示完成:beam 隐藏交还 DOM;回滚自动复原 */
    beam.style.visibility = ghostO <= 0 ? 'hidden' : ''

    /* 卡内 SVG 淡入:阈值切换 class,CSS transition,回滚自动反向 */
    sectionEl.classList.toggle('is-born', pg >= BORN)
  }

  const st = ScrollTrigger.create({
    trigger,
    start: 'top bottom',
    end: 'top top',
    scrub: true,
    invalidateOnRefresh: true,
    /* 钉死在 hero pin 之后刷新(根因见文件头):量测时 pin-spacer
       已就位,start/end 含 pin 行程;否则恒少算 pin 行程且无法自愈 */
    refreshPriority: -1,
    onUpdate: (self) => apply(self.progress),
    onRefresh: (self) => apply(self.progress),
  })
  apply(st.progress)

  return function destroyBeamGrow() {
    st.kill()
    sectionEl.classList.remove('is-born')
    cardEl.style.opacity = ''
    /* beam 交还 useBeamMerge:若仍 baked 钉回原位 */
    if (beamDock.baked && beamDock.el && beamDock.rect) {
      const r = beamDock.rect
      beamDock.el.style.left = `${r.left}px`
      beamDock.el.style.top = `${r.top}px`
      beamDock.el.style.width = `${r.width}px`
      beamDock.el.style.height = `${r.height}px`
      beamDock.el.style.opacity = '1'
      beamDock.el.style.borderRadius = 'var(--radius)'
      beamDock.el.style.boxShadow = ''
      beamDock.el.style.visibility = ''
    }
  }
}
