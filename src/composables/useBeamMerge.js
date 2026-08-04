import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'

/* ============================================================
 * 社交横梁(beam/bar)—— 图标飞向顶栏停靠后,留在原位的 5 个底块
 * (.social-bg)合并成一条圆角横梁,钉在 hero 社交行原视口位,
 * 等待下一页接管变形(接管入口 = 下方 beamDock)。
 *
 * 与开屏 veil→bar→pieces 严格互逆:滚动进度 p 驱动合并量 m
 * (与图标 SOCIAL_MERGE_END 同窗同缓动),回滚重新分裂,全程可逆。
 *
 * 实现要点:
 * - 独立 ScrollTrigger,与品牌/社交同 trigger '#hero'、同行程、
 *   同 1:1 scrub;不 pin(hero ST 已 pin),只读 progress。
 * - p<1:块在文档流内 translateX 收拢(合成层,零布局),横梁垫在
 *   块下(z:-1)随 m 渐显填缝——与图标合并胶囊同一手法。
 * - p=1(hero 即将解 pin):横梁提升到 body 钉 fixed(bake),块随
 *   hero 滚走,同色重叠零跳变;回滚 p<1 同帧放回(unbake)。
 * - bake/unbake 幂等,onUpdate/onRefresh 双通道断言,覆盖深刷还原。
 * ============================================================ */
const BEAM_Z = 40 /* 钉视口层级:常规分区(z1/2)之上,pager(z50)/hero(z55)之下 */
const HIDE_START = 0.6 /* m 过此点原块开始淡出,m=1 时只留横梁独自成形 */

/** 横梁状态:下一页变形接管的入口(el=横梁 DOM,baked=已钉视口,rect=钉位) */
export const beamDock = {
  el: null,
  baked: false,
  rect: null /* {left,top,width,height} 视口坐标 */,
}

/**
 * @param {object} opts
 * @param {HTMLElement} opts.bgRowEl  .social-bg-row(5 底块的容器)
 * @param {number} opts.gap           与 SOCIAL_GAP 同步
 * @param {number} opts.mergeEnd      与 SOCIAL_MERGE_END 同步
 * @param {number} opts.rangeVh       与 RANGE_VH 同步(pin 行程)
 * @param {boolean} opts.reduced      prefers-reduced-motion:整体跳过
 * @returns {() => void} destroy:组件卸载时调用
 */
export function initBeamMerge(opts = {}) {
  const { bgRowEl, gap = 12, mergeEnd = 0.55, rangeVh = 0.4, reduced = false } = opts
  if (!bgRowEl || reduced) return () => {}
  gsap.registerPlugin(ScrollTrigger)

  const blocks = Array.from(bgRowEl.children)
  const n = blocks.length
  if (!n) return () => {}

  /* 横梁垫在块下:bg-row 提为层叠上下文,beam z:-1 填缝不盖块 */
  bgRowEl.style.position = 'relative'
  bgRowEl.style.zIndex = '0'
  const beam = document.createElement('div')
  beam.className = 'social-beam'
  beam.setAttribute('aria-hidden', 'true')
  const FLOW_CSS =
    'position:absolute;left:0;top:0;height:100%;width:0;z-index:-1;' +
    'border-radius:var(--radius);background:var(--bg-2);opacity:0;pointer-events:none;'
  beam.style.cssText = FLOW_CSS
  bgRowEl.insertBefore(beam, bgRowEl.firstChild)
  blocks.forEach((b) => {
    b.style.willChange = 'transform'
  })

  let natW = 0
  let pinRect = null /* 横梁钉住位的视口矩形 */
  let baked = false

  /* 钉住位 = 文档位(pin 起于 scroll 0):r.top+scrollY 与当前滚位无关,
     深刷还原(已过 pin、hero 离屏)时量测依然正确 */
  const measurePinRect = () => {
    natW = bgRowEl.offsetWidth
    const r = bgRowEl.getBoundingClientRect()
    pinRect = {
      left: r.left,
      top: r.top + window.scrollY,
      width: natW - gap * (n - 1),
      height: r.height,
    }
  }

  /* 合并量:与图标 mergeAmount 同式同窗,视觉语言一致 */
  const mergeAmount = (p) => {
    const t = Math.min(1, Math.max(0, p / mergeEnd))
    return 1 - (1 - t) * (1 - t)
  }

  function bake() {
    if (baked) return
    baked = true
    const r = pinRect
    document.body.appendChild(beam)
    beam.style.cssText =
      `position:fixed;left:${r.left}px;top:${r.top}px;width:${r.width}px;height:${r.height}px;` +
      `z-index:${BEAM_Z};border-radius:var(--radius);background:var(--bg-2);opacity:1;pointer-events:none;`
    beamDock.el = beam
    beamDock.baked = true
    beamDock.rect = r
  }

  function unbake() {
    if (!baked) return
    baked = false
    beam.style.cssText = FLOW_CSS
    bgRowEl.insertBefore(beam, bgRowEl.firstChild)
    beamDock.el = null
    beamDock.baked = false
    beamDock.rect = null
  }

  function apply(p) {
    /* p=1 时 hero 仍钉住:文档流位即钉住位,同帧换 fixed 零跳变 */
    if (p >= 1) {
      bake()
      return
    }
    if (baked) unbake()
    const m = mergeAmount(p)
    /* 末段交叉淡化:原块边收边隐,横梁渐显接管,m=1 时横梁为唯一视觉 */
    const hideT = Math.min(1, Math.max(0, (m - HIDE_START) / (1 - HIDE_START)))
    const blockO = (1 - hideT).toFixed(3)
    for (let i = 0; i < n; i++) {
      blocks[i].style.transform = `translate3d(${(-i * gap * m).toFixed(2)}px,0,0)`
      blocks[i].style.opacity = blockO
    }
    /* 块缝/圆角缺口由横梁垫填:宽随行收敛,透明度随 m 渐显 */
    beam.style.width = `${(natW - gap * (n - 1) * m).toFixed(2)}px`
    beam.style.opacity = m.toFixed(3)
  }

  const st = ScrollTrigger.create({
    trigger: '#hero',
    start: 'top top',
    end: () => `+=${window.innerHeight * rangeVh}`,
    scrub: true,
    pin: false,
    invalidateOnRefresh: true,
    onUpdate: (self) => apply(self.progress),
    /* refresh(fonts/resize/深刷还原)后重锚:未 baked 时重测钉位;
       baked 保持钉位(resize 后不跟随,待下一页接管时统一处理) */
    onRefresh: (self) => {
      if (!baked) measurePinRect()
      apply(self.progress)
    },
  })
  measurePinRect()
  apply(st.progress)

  return function destroyBeamMerge() {
    st.kill()
    beam.remove()
    beamDock.el = null
    beamDock.baked = false
    beamDock.rect = null
    blocks.forEach((b) => {
      b.style.transform = ''
      b.style.opacity = ''
      b.style.willChange = ''
    })
    bgRowEl.style.position = ''
    bgRowEl.style.zIndex = ''
  }
}
