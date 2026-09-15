/* ============================================================
 * 品牌字真身飞入 tab 栏 —— GSAP ScrollTrigger pin + scrub
 * (与旧版项目展示栏同一库同一技法):
 * hero 被 pin 在视口顶,滚动行程(RANGE_VH·vh)即飞行进度——
 * 品牌字整体 transform 缩小平移到左上停靠位,滚多少走多少。
 * 展开/收回是独立完整动画,不占滚动行程:
 * 到位(onLeave)后数字以 back.out 弹性自己弹开("12569→123456789"),
 * 回滚(onEnterBack)时先收回、scrub 再接管飞回。
 * ============================================================ */
import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import type { Ref } from 'vue'
import { dockGeo, flyP, flyEase, themeScrollLock, bootDone } from './brandDock'
import { reduced as REDUCED } from '@/boot/timing'
import type { SocialDock } from './useSocialDock'

gsap.registerPlugin(ScrollTrigger)

export const RANGE_VH = 0.4 /* pin 行程(视口高倍数)= p 0→1;品牌字按此标定,勿擅自加长 */
const TARGET_FS = 40 /* 停靠字号 px:svg height=1em,故=停靠高度 */
const TARGET_TOP = 10
const SLOT_GAP = 12 /* 宽松态每个数字槽的加宽量 px */
const LEFT_MARGIN = 28 /* daum 贴视口左边缘的留白 */
const SLOT_OF = [0, 1, 4, 5, 8] /* 1/2/5/6/9 在 9 槽中的槽位 */
const VB_W = 5295.5 /* BRAND_VIEWBOX 宽,px→viewBox 单位换算用 */

export interface HeroDockDeps {
  slotRef: Ref<HTMLElement | null>
  titleRef: Ref<HTMLElement | null>
  pathRefs: SVGPathElement[]
  soc: SocialDock
}

export interface HeroDock {
  mount(): void
  destroy(): void
  /** 品牌 pin 进度(社交 chase 经此读 st.progress) */
  getProgress(): number
}

export function useHeroDock(deps: HeroDockDeps): HeroDock {
  const { slotRef, titleRef, pathRefs, soc } = deps

  /* 自然态几何:digitCx = 5 个数字字形相对 SVG 左缘的中心距(px) */
  interface NatGeo {
    fs: number
    left: number
    docTop: number
    w: number
    svgH: number
    digitCx: number[]
    digitH: number
  }
  let nat: NatGeo | null = null
  let spreadDeltas: number[] | null = null /* 各数字 path 摊开位移(viewBox 单位),computeDock 算 */
  let tl: gsap.core.Timeline | null = null
  let st: ScrollTrigger | null = null
  let committed = false /* onLeave 后 h1 已提交 fixed 钉住 */

  /* ---------- 展开/收回:独立完整动画,不占滚动行程 ---------- */
  const expandState = { v: 0 } /* 展开度 0-1(back.out 可短暂 >1 过冲) */
  let expandTween: gsap.core.Tween | null = null

  function applyExpansion() {
    const e = expandState.v
    flyEase.value = e
    if (spreadDeltas) {
      for (let j = 0; j < 5; j++) {
        gsap.set(pathRefs[4 + j], { x: spreadDeltas[j] * e })
      }
    }
  }

  /* to=1 弹开(back.out 带过冲),to=0 收回。
     收到反向触发时立即打断当前补间并从当前状态折返,避免展开中途被收回
     时先冲到全开再收——3478 数字会因此出现又突然消失;收回期间
     (retractPending)h1 保持 committed,onUpdate 每帧把 scrub 写入的飞行
     transform 清回停靠姿态,收回没做完品牌字一动不动;播完 flyBack 从停靠
     位平滑追赶到当前进度再交还 scrub */
  let expandTarget = 0
  let retractPending = false
  let flyChasing = false /* 飞回追赶中:每帧指数逼近 st.progress,无"目标过期" */

  function driveExpansion(to: number) {
    if (expandTarget === to && expandTween && expandTween.isActive()) return
    if (expandTween) expandTween.kill()
    expandTarget = to
    expandTween = gsap.to(expandState, {
      v: to,
      duration: to === 1 ? 0.6 : 0.35,
      ease: to === 1 ? 'back.out(1.4)' : 'power2.inOut',
      onUpdate: applyExpansion,
      onComplete: () => {
        applyExpansion()
        const want = st && st.progress >= 1 ? 1 : 0
        if (want !== to) {
          driveExpansion(want)
          return
        }
        if (want === 1) {
          retractPending = false /* 期间又滚回来了,取消待飞回 */
          return
        }
        if (to === 0 && retractPending) {
          retractPending = false
          flyBack()
        }
      },
    })
  }

  /* 飞回姿态:与 scrub 飞行 tween 同公式(位移/缩放均随 p 线性),
     故 applyFlyPose(progress) ≡ scrub 渲染结果,交接处零跳变 */
  const flyPose = { p: 1 }
  function applyFlyPose() {
    if (!nat || !titleRef.value) return
    const p = flyPose.p
    const rto = TARGET_FS / nat.fs
    titleRef.value.style.transform = `translate(${(dockGeo.left - nat.left) * p}px, ${(TARGET_TOP - nat.docTop) * p}px) scale(${1 + (rto - 1) * p})`
  }

  /* 收回播完:h1 交还 scrub。自停靠位(p=1,与 fixed 视觉一致)起飞,
     每帧指数追赶 st.progress——目标随滚动(snap/惯性/用户)实时变化,
     追赶永不"过期";目标静止则自然收敛,原地交还 scrub。
     (旧实现:0.25s 固定终点补间 + 滚动即杀——snap 延迟小于收回时长时
     必然在收回途中挪动进度;杀补间瞬间姿态从 p=1 跳变到当前
     进度,即快速收回时瞬移的根因) */
  function flyChase(_time: number, deltaTime: number) {
    const target = st ? st.progress : 0
    const k = 1 - Math.pow(0.82, (deltaTime || 16.667) / 16.667) /* 帧率无关追赶系数(品牌标定) */
    flyPose.p += (target - flyPose.p) * k
    if (Math.abs(target - flyPose.p) < 0.002) flyPose.p = target
    applyFlyPose()
    if (flyPose.p === target) endFlyChase() /* 收敛:姿态=scrub 渲染值,原地交还 */
  }

  function endFlyChase() {
    if (!flyChasing) return
    flyChasing = false
    gsap.ticker.remove(flyChase)
  }

  function flyBack() {
    if (!committed || !nat || !titleRef.value || !slotRef.value) return
    committed = false
    endFlyChase()
    const el = titleRef.value
    slotRef.value.appendChild(el)
    el.style.position = ''
    el.style.margin = ''
    el.style.left = ''
    el.style.top = ''
    el.style.fontSize = ''
    slotRef.value.style.height = ''
    el.style.transformOrigin = 'top left'
    flyPose.p = 1
    applyFlyPose()
    flyChasing = true
    gsap.ticker.add(flyChase)
    /* 社交胶囊同步回家:解除烘焙 → 回 stage → p=1 姿态 → 追赶到当前 progress */
    soc.flyBackHome()
  }

  /* 自然态测量(hero 未被 pin/无 transform 时):一次测量,停靠几何纯按比例换算 */
  function measure() {
    const el = titleRef.value
    if (!el || committed) return
    const svg = el.querySelector('.hero-brand-svg')
    if (!svg) return
    const r = svg.getBoundingClientRect()
    const digitEls = [4, 5, 6, 7, 8].map((i) => pathRefs[i]).filter(Boolean)
    if (digitEls.length !== 5) return
    nat = {
      fs: parseFloat(getComputedStyle(el).fontSize),
      left: r.left,
      docTop: r.top + window.scrollY,
      w: r.width,
      svgH: r.height,
      digitCx: digitEls.map((d) => {
        const b = d.getBoundingClientRect()
        return b.left + b.width / 2 - r.left
      }),
      digitH: digitEls[0].getBoundingClientRect().height,
    }
    soc.measure()
    computeDock()
  }

  /* 停靠几何 = 自然几何 × (TARGET_FS/fs):
     daum 在左(spacer=数字 1 槽位左缘),右接 9 个等步进数字槽 */
  function computeDock() {
    if (!nat) return
    const rto = TARGET_FS / nat.fs
    const a = (nat.digitCx[1] - nat.digitCx[0]) * rto
    const spacer = (nat.digitCx[0] - (nat.digitCx[1] - nat.digitCx[0]) / 2) * rto
    Object.assign(dockGeo, {
      ready: true,
      left: LEFT_MARGIN + 4,
      top: TARGET_TOP,
      w: nat.w * rto,
      h: TARGET_FS,
      advance: a,
      gap: SLOT_GAP,
      spacer,
      digitH: nat.digitH * rto,
    })
    /* 每个数字 path 从紧凑位到摊开槽位的位移(viewBox 单位) */
    const slotW = a + SLOT_GAP
    spreadDeltas = SLOT_OF.map(
      (s, j) =>
        (spacer + s * slotW + slotW / 2 - nat!.digitCx[j] * rto) * (VB_W / (nat!.w * rto)),
    )
  }

  /* pin 终点(onLeave):h1 提交为 fixed 钉在停靠位,与 timeline 末帧同位零跳变。
     必须提升到 body:被 pin 的 #hero 祖先可能残留 transform/clip 等形成
     包含块,fixed 相对它定位就会跟着滚走——挂到 body 下钉视口才真正钉住 */
  function commitDock() {
    if (committed || !nat) return
    const el = titleRef.value
    if (!el || !slotRef.value) return
    committed = true
    endFlyChase()
    slotRef.value.style.height = `${nat.svgH}px`
    gsap.set(el, { clearProps: 'transform' })
    document.body.appendChild(el)
    el.style.position = 'fixed'
    el.style.margin = '0'
    el.style.left = `${dockGeo.left}px`
    el.style.top = `${dockGeo.top}px`
    el.style.fontSize = `${TARGET_FS}px`
    /* 社交胶囊:贴 p=1 → bake → fixed(left 与末帧同值),末段不跳;
       深刷入场在 armed 窗口内同帧藏起并排演级联 */
    soc.commitDock()
  }

  function build() {
    const el = titleRef.value
    if (!nat || !dockGeo.ready || tl || REDUCED || !el) return
    tl = gsap.timeline({
      scrollTrigger: {
        trigger: '#hero',
        start: 'top top',
        end: () => `+=${window.innerHeight * RANGE_VH}`,
        /* 必须 true:品牌字 timeline/flyChase/commit 均按 1:1 scrub 标定。
           社交同样 1:1 跟 progress(右缘锚定),避免滞后在 commit 时被钉飞 */
        scrub: true,
        pin: true,
        anticipatePin: 1,
        invalidateOnRefresh: true,
        /* 自动吸附:停稳后吸到就近端点(品牌+社交共用 scroll 端点) */
        snap: {
          /* 主题换肤期间 themeScrollLock=true:原样返回当前进度,禁止吸到端点 */
          snapTo: (v) => (themeScrollLock.value ? v : v < 0.5 ? 0 : 1),
          duration: { min: 0.15, max: 0.45 },
          delay: 0.12,
          ease: 'power2.inOut',
        },
        onUpdate: (self) => {
          flyP.value = self.progress
          /* 收回 pending 期间 h1 仍是 fixed:scrub 每次渲染都会把飞行 transform
             写上来 → 立即清回停靠姿态,视觉上钉死不动 */
          if (committed) {
            gsap.set(titleRef.value, { clearProps: 'transform' })
            return
          }
          /* 飞回追赶中进度冲到 1(用户/snap 直冲停靠位):立即贴齐,
             commitDock 随之钉住零跳变;其余情况追赶每帧自读 st.progress */
          if (flyChasing && self.progress >= 1) {
            endFlyChase()
            flyPose.p = 1
            applyFlyPose()
          }
          if (soc.chasing && self.progress >= 1) {
            soc.endChase()
            soc.applyState(1)
          }
          /* 社交 1:1 跟 progress(飞回 chase 时由 ticker 覆盖) */
          if (!soc.chasing && !soc.baked) soc.applyState(self.progress)
        },
        onLeave: () => {
          /* boot 锁顶期间若仍误触 progress=1,绝不能钉停靠,否则 handoff 飞向顶栏 */
          if (!bootDone.value) return
          commitDock()
          driveExpansion(1) /* 到位后独立弹开(h1 已钉住,页面可继续滚) */
        },
        onEnterBack: () => {
          /* 回滚:h1 保持停靠钉住(onUpdate 每帧钳回),收回动画完整播完
             后 flyBack 平滑追赶交还 scrub——收回没做完品牌字不动 */
          retractPending = true
          driveExpansion(0)
        },
        /* invalidateOnRefresh 的 refresh(如 fonts.ready 二次刷新)会按
           progress=1 重渲染 timeline,把飞行 transform 写回已提交的
           h1(非首页刷新时品牌字被扔出视口的根因)——重新断言 fixed 终态 */
        onRefresh: (self) => {
          if (!committed) {
            flyP.value = self.progress
            if (!soc.chasing && !soc.baked) soc.applyState(self.progress)
            return
          }
          const el = titleRef.value
          if (!el) return
          gsap.set(el, { clearProps: 'transform' })
          el.style.left = `${dockGeo.left}px`
          el.style.top = `${dockGeo.top}px`
          el.style.fontSize = `${TARGET_FS}px`
        },
      },
    })
    /* 品牌字 timeline scrub 1:1;社交 onUpdate → applyState 右缘锚定 */
    tl.to(
      el,
      {
        x: () => dockGeo.left - nat!.left,
        y: () => TARGET_TOP - nat!.docTop,
        scale: () => TARGET_FS / nat!.fs,
        transformOrigin: 'top left',
        ease: 'none',
        duration: 1,
      },
      0,
    )
    st = tl.scrollTrigger ?? null
    if (st) soc.applyState(st.progress)
  }

  function onResize() {
    if (!committed) {
      measure()
      if (st) ScrollTrigger.refresh()
    } else {
      computeDock()
      const el = titleRef.value
      if (el) el.style.left = `${dockGeo.left}px`
    }
  }

  /**
   * 供 main.ts 非首页 boot:量测 + 建 ST(仍在 scroll=0 / bootDone=false),
   * 不 commit——防 handoff 被钉停靠短路。
   */
  function prepareBrandDockForBoot() {
    try {
      if (!committed) measure()
      if (!tl) build()
      /* 武装深刷入场:此后到 sync 收尾前,任何路径的 commit(含还原
         scroll 后 scroll 任务里抢先触发的 onLeave)都排演社交行入场 */
      if (!committed && !soc.enter.played) soc.enter.armed = true
    } catch (e) {
      /* ignore */
    }
  }

  /** 停靠目标矩形(视口),供非首页 handoff 把 preloader 字飞向顶栏 */
  function getBrandDockTarget() {
    if (!dockGeo.ready) return null
    return {
      left: dockGeo.left,
      top: dockGeo.top,
      width: dockGeo.w,
      height: dockGeo.h,
    }
  }

  /**
   * 供 main.ts 非首页 boot 收尾:还原 scroll 后刷新 ST,
   * 若已过 pin 则 commit 停靠 + 展开(与 onLeave 同态)。
   * 仅应在 bootDone 后调用——boot 中途 progress=1 会短路 handoff 大标题落地。
   * opts.landTitle: 非首页路径保持 handoff-pending 至此处再亮,避免大标题闪一下再瞬移停靠。
   */
  function syncBrandDockForBoot(opts: { landTitle?: boolean } = {}) {
    try {
      if (!nat && !committed) measure()
      if (!tl) build()
      ScrollTrigger.update()
      ScrollTrigger.refresh()
      if (st) {
        flyP.value = st.progress
        if (st.progress >= 1) {
          /* commit 可能已由 onLeave 在上方 update/refresh 内同步完成;
             入场排演统一走 commitDock 武装窗口 + 下方收尾兜底 */
          if (!committed) commitDock()
          driveExpansion(1)
        } else if (!committed && !soc.chasing && !soc.baked) {
          soc.applyState(st.progress)
        }
      }
      /* 深刷收尾:撤防;若已停靠但入场未排(未经 prepare 武装的兜底
         路径,如 4.5s fallback / bootCatch),此处补排 */
      soc.enter.armed = false
      if (opts.landTitle && committed && !soc.enter.played) soc.scheduleEnter()
      if (opts.landTitle) {
        const el = titleRef.value
        if (el) {
          el.classList.remove('handoff-pending')
          el.classList.add('is-landed')
        }
      }
    } catch (e) {
      /* ignore */
    }
  }

  return {
    getProgress: () => (st ? st.progress : 0),
    mount() {
      window.__prepareBrandDockForBoot = prepareBrandDockForBoot
      window.__getBrandDockTarget = getBrandDockTarget
      window.__syncBrandDockForBoot = syncBrandDockForBoot
      requestAnimationFrame(() => {
        measure()
        build()
        /* boot 完成前绝不能按 progress=1 钉停靠,否则开屏飞向顶栏而非大标题 */
        if (bootDone.value && st && st.progress >= 1) syncBrandDockForBoot({ landTitle: true })
      })
      window.addEventListener('resize', onResize)
      if (document.fonts && document.fonts.ready) {
        document.fonts.ready.then(() => {
          if (!committed) measure()
          if (st) ScrollTrigger.refresh()
          else build()
          if (bootDone.value && st && st.progress >= 1) syncBrandDockForBoot({ landTitle: true })
        })
      }
    },
    destroy() {
      window.removeEventListener('resize', onResize)
      if (window.__syncBrandDockForBoot === syncBrandDockForBoot) {
        delete window.__syncBrandDockForBoot
      }
      if (window.__prepareBrandDockForBoot === prepareBrandDockForBoot) {
        delete window.__prepareBrandDockForBoot
      }
      if (window.__getBrandDockTarget === getBrandDockTarget) {
        delete window.__getBrandDockTarget
      }
      retractPending = false
      if (expandTween) expandTween.kill()
      endFlyChase()
      soc.endChase()
      if (st) st.kill()
      if (tl) tl.kill()
      st = null
      tl = null
    },
  }
}
