/* ============================================================
 * 社交胶囊对接 tab 栏 —— 与品牌字同 pin/progress,但不走 timeline gap:
 * 合并用子项 translateX(合成层),飞行用 row translate3d;
 * applyState(p) 单一驱动(scrub onUpdate / chase 共用),边合边飞。
 * commitDock 烘成 gap:0+fixed;flyBackHome 还原 gap 后从 p=1 追赶回家。
 *
 * 背景:飞行进度 p 到一半(SOCIAL_BG_FADE_END)即消散完毕,回程后半再凝聚;
 * 不再绑品牌 flyEase 展开。停靠高与主题开关齐平(32px / top 18)。
 * ============================================================ */
import { gsap } from 'gsap'
import { reduced as REDUCED } from '@/boot/timing'
import { initBeamMerge } from './useBeamMerge'

const SOCIAL_RIGHT = 98 /* 主题开关(right 18 + 宽 64)+ 16 间距 */
const SOCIAL_GAP = 12 /* 与 .social-row gap 一致;合并时用 x 收拢,不改 gap 触布局 */
const SOCIAL_MERGE_END = 0.55 /* p 到此合并完成;飞行全程 0→1 与之重叠 */
const SOCIAL_BG_FADE_END = 0.5 /* 飞行进度到此背景消散完 */
const SOCIAL_NAT_H = 48 /* hero 自然态按钮高 */
const SOCIAL_DOCK_H = 40 /* 停靠钮高:略高于开关(track 32),图标更醒目 */
const SOCIAL_DOCK_TOP = 14 /* 与主题开关垂直居中(开关 top18+高32 中心 34;40 高取 14,窄屏 10) */
function socDockH() {
  return SOCIAL_DOCK_H
}
function socDockTop() {
  return typeof window !== 'undefined' && window.innerWidth <= 640 ? 10 : SOCIAL_DOCK_TOP
}

/* 首页图标显现级联时长:左→右 stagger + 同项内 svg 先、文字后 */
const SOC_FADE_MS = 213
const SOC_FADE_STAGGER_MS = 40

/** 品牌 pin 进度(品牌模块持有 st,经回调读取,chase 共用) */
export interface SocialDockDeps {
  getProgress: () => number
  /** 与 RANGE_VH 同步(beam pin 行程) */
  rangeVh: number
}

/** 品牌字模块经此接口对接(chase/烘焙/入场排演/量测) */
export interface SocialDock {
  mount(): void
  destroy(): void
  /** 自然态量测(hero 未被 pin/无 transform 时) */
  measure(): void
  applyState(p: number): void
  endChase(): void
  /** flyBack 内联:解烘焙 → 回 stage → p=1 → 追赶到当前 progress */
  flyBackHome(): void
  /** commitDock 内联:贴 p=1 → bake → fixed 钉住 → 入场排演 */
  commitDock(): void
  /** 深刷入场级联(armed 窗口内 commit 或 sync 收尾兜底调) */
  scheduleEnter(): void
  /** 深刷入场排演状态(armed/played/timer,品牌模块读写) */
  enter: { timer: number | undefined; played: boolean; armed: boolean }
  readonly chasing: boolean
  readonly baked: boolean
}

export function useSocialDock(deps: SocialDockDeps): SocialDock {
  const { getProgress } = deps

  let socialStageEl: HTMLElement | null = null
  let socialRowEl: HTMLElement | null = null
  let socialItemEls: HTMLElement[] = []
  /* 自然态 {left,viewTop,docTop,natW,mergedW,dockMergedW} */
  interface SocNatGeo {
    left: number
    viewTop: number
    docTop: number
    natW: number
    mergedW: number
    dockMergedW: number
  }
  let socNat: SocNatGeo | null = null
  let socRadius = 18 /* px,自 --radius 读 */
  /* p:进度; _dx/_dy:上一帧写入的 translate; _hasTf:是否已有可反推 layout 的 transform
     pin 期间 hero layoutTop 会缓漂(测得 ~4px),若 dy 死盯 measure 时 docTop,
     p→1 时视觉落不到 dockTop,commit 瞬间下跳——用 visual−上一帧 translate 反推
     当前 layout,每帧对准绝对视口目标,末帧与 bake 同位零跳变 */
  const socPose = { p: 1, _dx: 0, _dy: 0, _hasTf: false }
  let socChasing = false
  let socBaked = false /* commit 后已烘成 gap:0,勿再 applySocState */
  let destroyBeamMerge: (() => void) | null = null /* useBeamMerge 卸载句柄 */

  /** 停靠时胶囊右缘(主题开关左) */
  function socDockRight() {
    return window.innerWidth - SOCIAL_RIGHT
  }

  /** 合并量 0-1:p 在 [0, SOCIAL_MERGE_END] 内 power2.out 收拢 */
  function mergeAmount(p: number) {
    const t = Math.min(1, Math.max(0, p / SOCIAL_MERGE_END))
    return 1 - (1 - t) * (1 - t)
  }

  /** 底块驱动态:o=飞行消散(1→0), scale=消散微扩——仅用于 row::before 胶囊 */
  const socBgState = { o: 1, scale: 1 }

  /** 背景随飞行进度消散:p=0 实底 → p≥SOCIAL_BG_FADE_END 全消;回程反向凝聚。
   *  消散只用 opacity + transform scale(均可合成,零重栅格); 子项白块已拆为独立
   *  背景层,不跟随图标,故只驱动 row::before 合并胶囊。
   *  不写 blur——动画化 blur 每帧重栅格 6 层底块,是滚动卡顿主因 */
  function applySocBg(p: number) {
    if (!socialItemEls.length) return
    const t = Math.min(1, Math.max(0, p / SOCIAL_BG_FADE_END))
    socBgState.o = 1 - t
    socBgState.scale = 1 + t * 0.06
    if (socialRowEl) {
      socialRowEl.style.setProperty('--soc-bg-o', socBgState.o.toFixed(3))
      socialRowEl.style.setProperty('--soc-bg-scale', socBgState.scale.toFixed(4))
    }
  }

  /** 飞行进度上的高度:自然 48 → 与主题开关齐平的 32;返回缩放比 s 供宽度解析 */
  function applySocSize(p: number) {
    if (!socialItemEls.length) return 1
    const h1 = SOCIAL_DOCK_H
    const h = SOCIAL_NAT_H + (h1 - SOCIAL_NAT_H) * p
    const s = h / SOCIAL_NAT_H
    const icon = (22 * s).toFixed(1)
    for (const el of socialItemEls) {
      el.style.height = `${h.toFixed(2)}px`
      if (el.classList.contains('social-icon')) {
        el.style.width = `${h.toFixed(2)}px`
        el.style.setProperty('--soc-icon', `${icon}px`)
      } else {
        el.style.paddingLeft = `${(18 * s).toFixed(2)}px`
        el.style.paddingRight = `${(18 * s).toFixed(2)}px`
        el.style.fontSize = `${(15 * s).toFixed(2)}px`
        el.style.setProperty('--soc-icon', `${(20 * s).toFixed(1)}px`)
      }
    }
    if (socialRowEl) socialRowEl.style.height = `${h.toFixed(2)}px`
    return s
  }

  /**
   * 按进度写合并 + 飞行。
   * 位移用「右缘锚定」:自然右缘 → 主题开关左缘 线性插值,再反推 left=right-packW。
   * 目标 left/top 是视口绝对坐标;transform = 目标 − 当前 layout 原点。
   * layout 原点用「visual − 上一帧 translate」反推,抵消 pin 漂,p=1 必落 dock。
   * 进度与 ST 1:1(飞回 chase 除外),commit 前贴 p=1 再 bake,末段零跳变。
   */
  function applySocState(p: number) {
    if (!socNat || !socialRowEl || socBaked) return
    const m = mergeAmount(p)
    const n = socialItemEls.length
    const r = socRadius
    const s = applySocSize(p)
    /* 钮宽之和走解析式:每项随 s 等比缩(与 applySocSize 同比例,
       误差仅 legacy 固定 8px gap 的 (1-s) 倍,≤2.7px 不可见)。
       逐帧读 offsetWidth 会与上方尺寸写入读写交错 → 强制同步重排,卡顿 */
    const sumW = s * socNat.mergedW
    for (let i = 0; i < n; i++) {
      const el = socialItemEls[i]
      el.style.transform = `translate3d(${(-i * SOCIAL_GAP * m).toFixed(2)}px,0,0)`
      el.style.borderRadius = `${r}px`
    }
    /* 视觉胶囊宽 = 当前钮宽之和 + 残余 gap */
    const packW = sumW + SOCIAL_GAP * Math.max(0, n - 1) * (1 - m)
    socialRowEl.style.setProperty('--soc-merge', m.toFixed(4))
    socialRowEl.style.setProperty('--soc-pack-w', `${packW.toFixed(2)}px`)
    applySocBg(p)
    /* 视口绝对目标:右缘锚主题开关左,顶锚 dockTop */
    const natRight = socNat.left + (socNat.natW || packW)
    const targetRight = natRight + (socDockRight() - natRight) * p
    const targetLeft = targetRight - packW
    const viewTop0 = socNat.viewTop != null ? socNat.viewTop : socNat.docTop
    const targetTop = viewTop0 + (socDockTop() - viewTop0) * p
    /* 当前 layout 原点(未计本行 translate):有历史 transform 则 visual 反推,
       否则用 measure 快照。pin 漂多少这里就吃掉多少 */
    let layoutLeft = socNat.left
    let layoutTop = viewTop0
    if (socPose._hasTf) {
      const vr = socialRowEl.getBoundingClientRect()
      layoutLeft = vr.left - socPose._dx
      layoutTop = vr.top - socPose._dy
    }
    const dx = targetLeft - layoutLeft
    const dy = targetTop - layoutTop
    socialRowEl.style.transform = `translate3d(${dx.toFixed(2)}px,${dy.toFixed(2)}px,0)`
    socPose._dx = dx
    socPose._dy = dy
    socPose._hasTf = true
    socPose.p = p
  }

  function socChase(_time: number, deltaTime: number) {
    const target = getProgress()
    const k = 1 - Math.pow(0.88, (deltaTime || 16.667) / 16.667)
    socPose.p += (target - socPose.p) * k
    if (Math.abs(target - socPose.p) < 0.0015) socPose.p = target
    applySocState(socPose.p)
    if (socPose.p === target) endSocChase()
  }

  function endSocChase() {
    if (!socChasing) return
    socChasing = false
    gsap.ticker.remove(socChase)
  }

  /* ---------- 非首页深刷入场 ----------
   * commitDock 把 row 提升到 body 后,父级 .hero-social 的 reveal 级联
   * (80ms+ 后才加 .is-visible)再也罩不住它 → 停靠瞬间全形蹦出。
   * commit 同帧挂 pending 隐藏(同一 JS 任务,无已绘制帧可闪),
   * 待主题开关假层撤离后自开关方向右→左级联点亮:
   * 每项 fade + 微升 + 微弹 + 轻旋正,与数字摊开同一家 spring 语言,幅度克制 */
  const socEnter = {
    timer: undefined as number | undefined,
    played: false,
    armed: false,
  }

  function scheduleSocialDockEntrance() {
    if (REDUCED || socEnter.played || !socialRowEl) return
    socEnter.played = true
    const row = socialRowEl
    row.classList.add('soc-enter-pending')
    /* 主题开关假层在 finishBoot 收尾后 ~2 帧撤离;留一呼吸口再入场 */
    socEnter.timer = window.setTimeout(() => {
      socEnter.timer = undefined
      row.classList.remove('soc-enter-pending')
      row.classList.add('soc-boot-enter')
      /* 末项(最左)延迟最长:0.5s + (n-1)·60ms,播完清场交还纯净 DOM */
      const span = 500 + Math.max(0, row.children.length - 1) * 60 + 150
      setTimeout(() => row.classList.remove('soc-boot-enter'), span)
    }, 160)
  }

  /* ============================================================
   * 首页社交胶囊图标显现 —— loading 背景收回成长方形、分裂成各图标底块后
   * (main.ts veil 序列),图标在各自胶囊内直接淡入。
   * 触发 = .hero-social 被加 .is-visible(main.ts 分裂完成后手动点亮;
   * finishBoot 通用级联兜底);深刷(胶囊已提升 body)只还原,归 soc-dock-in。
   * 播完清全部内联 + cancel WAAPI,DOM 交还纯净,dock/hover 零残留。
   * ============================================================ */
  let socEnterParts: { targets: (HTMLElement | SVGElement)[] }[] = [] /* [{ targets:[svg|span] }] */
  let socEnterPlayed = false
  let socEnterObserver: MutationObserver | null = null
  let heroSocialEl: HTMLElement | null = null

  function prepareSocialEnter() {
    if (REDUCED) return
    for (const el of socialItemEls) {
      const targets: (HTMLElement | SVGElement)[] = []
      const svg = el.querySelector('svg')
      if (svg) targets.push(svg)
      const span = el.querySelector('span')
      if (span) targets.push(span)
      if (!targets.length) continue
      targets.forEach((t) => {
        t.style.opacity = '0'
      })
      socEnterParts.push({ targets })
    }
  }

  /* 还原纯净 DOM(跳过播放/播完收尾共用) */
  function cleanupSocialEnter() {
    for (const it of socEnterParts) {
      it.targets.forEach((t) => {
        t.style.opacity = ''
      })
    }
    socEnterParts = []
  }

  function playSocialEnter() {
    if (socEnterPlayed || REDUCED) return
    /* 深刷:胶囊已被 commit 提升到 body 停靠,入场归 soc-dock-in;
       藏形必须还原,否则级联淡入后图标是空的 */
    if (socBaked || (socialRowEl && socialStageEl && socialRowEl.parentNode !== socialStageEl)) {
      cleanupSocialEnter()
      return
    }
    socEnterPlayed = true
    const anims: Animation[] = []
    socEnterParts.forEach((it, i) => {
      /* 左→右级联;同项内 svg 先、文字后 */
      it.targets.forEach((t, j) => {
        anims.push(
          t.animate([{ opacity: 0 }, { opacity: 1 }], {
            duration: SOC_FADE_MS,
            delay: i * SOC_FADE_STAGGER_MS + j * 33,
            easing: 'ease',
            fill: 'forwards',
          }),
        )
      })
    })
    Promise.all(anims.map((a) => a.finished.catch(() => {}))).then(() => {
      cleanupSocialEnter()
      anims.forEach((a) => a.cancel())
    })
  }

  /**
   * 停靠烘焙:先 applySocState(1) 贴齐末帧,再清 transform 改 fixed。
   * 用实测 gap:0 后宽度反推 left,右缘严丝合缝贴主题开关间距,避免公式宽与
   * 实宽差 1~2px 导致末段右缘轻跳。
   */
  function bakeSocDock() {
    if (!socialRowEl || !socNat) return
    const s = socialRowEl
    const r = socRadius
    const h = socDockH()
    const scale = h / SOCIAL_NAT_H
    /* 先画到 p=1 视觉位(自校正后 = 绝对 dock),再钉 fixed——末段连贯 */
    socBaked = false
    applySocState(1)
    socialItemEls.forEach((el) => {
      el.style.transform = ''
      el.style.height = `${h}px`
      el.style.borderRadius = `${r}px`
      if (el.classList.contains('social-icon')) {
        el.style.width = `${h}px`
        el.style.setProperty('--soc-icon', `${(22 * scale).toFixed(1)}px`)
      } else {
        el.style.paddingLeft = `${(18 * scale).toFixed(2)}px`
        el.style.paddingRight = `${(18 * scale).toFixed(2)}px`
        el.style.fontSize = `${(15 * scale).toFixed(2)}px`
        el.style.setProperty('--soc-icon', `${(20 * scale).toFixed(1)}px`)
      }
    })
    s.style.transform = ''
    s.style.gap = '0'
    s.style.height = `${h}px`
    s.style.setProperty('--soc-merge', '1')
    /* 实测烘焙宽(吃掉 legacy 固定 gap 等解析误差),右缘 = socDockRight */
    void s.offsetWidth
    const dockW = s.offsetWidth || socNat.dockMergedW || socNat.mergedW
    s.style.setProperty('--soc-pack-w', `${dockW}px`)
    const dockLeft = socDockRight() - dockW
    socBaked = true
    socPose._hasTf = false
    applySocBg(1)
    return { dockLeft, dockTop: socDockTop() }
  }

  /** 飞回前解除烘焙,恢复 CSS gap,姿态由 applySocState(1) 接 */
  function unbakeSocDock() {
    if (!socialRowEl) return
    socialRowEl.style.gap = ''
    socialRowEl.style.height = ''
    socialRowEl.style.left = ''
    socialRowEl.style.right = ''
    socialRowEl.style.top = ''
    socialRowEl.style.removeProperty('--soc-merge')
    socialRowEl.style.removeProperty('--soc-pack-w')
    socBaked = false
    /* 回 stage 后 layout 原点回到自然态,下一帧 apply 从 socNat 重锚 */
    socPose._hasTf = false
    socPose._dx = 0
    socPose._dy = 0
  }

  /** 自然态量测(品牌 measure 内联调):一次测量,停靠几何纯按比例换算 */
  function measureSoc() {
    if (socialRowEl && socialItemEls.length && !socBaked) {
      const r = socialRowEl.getBoundingClientRect()
      const mergedW = socialItemEls.reduce((sum, it) => sum + it.offsetWidth, 0)
      /* 停靠宽:缩到主题开关同高后的等比(图标方、旧版跟高缩放) */
      const sc = SOCIAL_DOCK_H / SOCIAL_NAT_H
      const dockMergedW = socialItemEls.reduce((sum, it) => {
        if (it.classList.contains('social-icon')) return sum + SOCIAL_DOCK_H
        return sum + it.offsetWidth * sc
      }, 0)
      socNat = {
        left: r.left,
        viewTop: r.top /* 视口 Y,飞行绝对目标用 */,
        docTop: r.top + window.scrollY,
        natW: r.width /* 含 gap 的自然总宽,右缘锚定用 */,
        mergedW,
        dockMergedW,
      }
      /* 重新量测后 transform 基准作废,下一帧从新原点锚 */
      socPose._hasTf = false
      socPose._dx = 0
      socPose._dy = 0
      const rad = getComputedStyle(document.documentElement).getPropertyValue('--radius').trim()
      const parsed = parseFloat(rad)
      if (!Number.isNaN(parsed)) socRadius = parsed
    }
  }

  /** flyBack 内联段:解烘焙 → 回 stage → p=1 姿态 → 追赶到当前 progress */
  function flyBackHome() {
    if (!(socialRowEl && socialStageEl && socNat)) return
    endSocChase()
    const s = socialRowEl
    /* 入场级联途中回滚:停演清场,回 hero 由 reveal 常态接管 */
    if (socEnter.timer) {
      clearTimeout(socEnter.timer)
      socEnter.timer = undefined
    }
    s.classList.remove('soc-enter-pending', 'soc-boot-enter')
    unbakeSocDock()
    socialStageEl.appendChild(s)
    s.style.position = ''
    s.style.margin = ''
    s.style.left = ''
    s.style.right = ''
    s.style.top = ''
    s.style.zIndex = ''
    socPose.p = 1
    applySocState(1)
    socChasing = true
    gsap.ticker.add(socChase)
  }

  /** commitDock 内联段:贴 p=1 → bake → fixed(left 与末帧同值),末段不跳;
      深刷入场在 armed 窗口内同帧藏起并排演级联;正常滚动停靠不播 */
  function commitSocDock() {
    if (socialRowEl && socNat) {
      endSocChase()
      const dockPos = bakeSocDock()
      if (dockPos) {
        const s = socialRowEl
        document.body.appendChild(s)
        s.style.position = 'fixed'
        s.style.margin = '0'
        s.style.right = 'auto'
        s.style.left = `${dockPos.dockLeft}px`
        s.style.top = `${dockPos.dockTop}px`
        s.style.zIndex = '60'
      }
    }
    /* 深刷入场:武装窗口内的 commit(boot 收尾,或还原 scroll 后 scroll
       任务里抢先触发的 onLeave)同帧藏起并排演级联;正常滚动停靠不播 */
    if (socEnter.armed) {
      socEnter.armed = false
      scheduleSocialDockEntrance()
    }
  }

  return {
    get chasing() {
      return socChasing
    },
    get baked() {
      return socBaked
    },
    enter: socEnter,
    measure: measureSoc,
    applyState: applySocState,
    endChase: endSocChase,
    flyBackHome,
    commitDock: commitSocDock,
    scheduleEnter: scheduleSocialDockEntrance,
    mount() {
      socialStageEl = document.querySelector<HTMLElement>('.social-stage')
      socialRowEl = document.querySelector<HTMLElement>('.social-row')
      socialItemEls = socialRowEl ? (Array.from(socialRowEl.children) as HTMLElement[]) : []
      /* 横梁合并(底块→bar,与图标飞行同窗可逆):逻辑在 composable,此处仅接线 */
      destroyBeamMerge = initBeamMerge({
        bgRowEl: socialStageEl && socialStageEl.querySelector<HTMLElement>('.social-bg-row'),
        gap: SOCIAL_GAP,
        mergeEnd: SOCIAL_MERGE_END,
        rangeVh: deps.rangeVh,
        reduced: REDUCED,
      })
      applySocBg(0)
      prepareSocialEnter()
      /* .is-visible = 入场信号(veil 分裂后手动点亮,或 finishBoot 级联兜底);
         已亮(热更)则直接播 */
      heroSocialEl = document.querySelector<HTMLElement>('.hero-social')
      if (heroSocialEl && !REDUCED) {
        if (heroSocialEl.classList.contains('is-visible')) playSocialEnter()
        else {
          socEnterObserver = new MutationObserver(() => {
            if (!heroSocialEl!.classList.contains('is-visible')) return
            socEnterObserver!.disconnect()
            socEnterObserver = null
            playSocialEnter()
          })
          socEnterObserver.observe(heroSocialEl, { attributes: true, attributeFilter: ['class'] })
        }
      }
    },
    destroy() {
      if (destroyBeamMerge) destroyBeamMerge()
      if (socEnterObserver) socEnterObserver.disconnect()
      if (socEnter.timer) clearTimeout(socEnter.timer)
      endSocChase()
    },
  }
}
