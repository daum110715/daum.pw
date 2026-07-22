<template>
  <section id="hero" class="section hero" aria-label="首页">
    <div class="container hero-inner">
      <!-- 标题与开屏品牌同源 SVG:preloader 描边 -> 克隆飞入此位 -> 落地零跳变;
           下滚过阈值后同一个 h1 被 pin 成 fixed 一次性飞入顶部 tab 栏(WAAPI,
           与开屏飞行同技法),slot 占位保首屏布局 -->
      <div ref="slotRef" class="title-slot">
        <h1 ref="titleRef" class="hero-title handoff-pending">
          <svg
            class="hero-brand-svg"
            :viewBox="BRAND_VIEWBOX"
            aria-hidden="true"
            focusable="false"
            xmlns="http://www.w3.org/2000/svg"
          >
            <defs>
              <linearGradient id="heroBrandGrad" x1="0" y1="0" x2="5295.5" y2="0" gradientUnits="userSpaceOnUse">
                <stop offset="0" class="g-stop-1" />
                <stop offset="1" class="g-stop-2" />
              </linearGradient>
            </defs>
            <g :transform="BRAND_GROUP_TRANSFORM">
              <path
                v-for="(p, i) in BRAND_PATHS"
                :key="i"
                :ref="(el) => (pathRefs[i] = el)"
                class="hero-char-path"
                :class="[`digit-${i}`, { 'is-digit': i >= 4 }]"
                :d="p.d"
              />
            </g>
          </svg>
          <span class="visually-hidden">{{ BRAND_TEXT }}</span>
        </h1>
      </div>
      <div class="hero-social reveal reveal-after-boot">
        <div class="social-stage">
          <div class="social-row">
            <a
              v-for="s in social"
              :key="s.url"
              :href="s.url"
              class="social-icon"
              :aria-label="s.name"
              :target="s.url.startsWith('mailto:') ? undefined : '_blank'"
              rel="noopener"
            >
              <Icon
                :icon="s.key === 'email' ? 'lucide:mail' : `simple-icons:${s.key}`"
                width="22"
                height="22"
              />
            </a>
            <!-- 旧版站点入口:宽框 + 图标 + 文字,指向随站部署的 legacy 子站(./legacy/) -->
            <a
              href="./legacy/"
              class="legacy-link"
              title="旧版站点"
              @click="goLegacy"
            >
              <Icon icon="lucide:rotate-ccw" width="20" height="20" />
              <span>旧版</span>
            </a>
          </div>
        </div>
      </div>

    </div>
  </section>

  <!-- 旧版转场:圆形幕布自点击处展开,盖满后整页跳转(单次加载);
       旧版端 ?from=new 到岸幕布自同轴位置虹膜收拢揭示,与回新版方向对称 -->
  <Teleport to="body">
    <div
      v-if="legacyState !== 'idle'"
      class="legacy-veil"
      :class="`is-${legacyState}`"
      :style="veilOrigin"
      aria-hidden="true"
    >
      <div class="legacy-veil-glow" />
    </div>
  </Teleport>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount } from 'vue'
import { Icon } from '@iconify/vue'
import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { social } from '@/data/social'
import { BRAND_TEXT, BRAND_VIEWBOX, BRAND_GROUP_TRANSFORM, BRAND_PATHS } from '@/data/brandGlyph'
import { dockGeo, flyP, flyEase, themeScrollLock, bootDone } from '@/composables/brandDock'

gsap.registerPlugin(ScrollTrigger)

/* ============================================================
 * 品牌字真身飞入 tab 栏 —— GSAP ScrollTrigger pin + scrub
 * (与旧版项目展示栏同一库同一技法):
 * hero 被 pin 在视口顶,滚动行程(RANGE_VH·vh)即飞行进度——
 * 品牌字整体 transform 缩小平移到左上停靠位,滚多少走多少。
 * 展开/收回是独立完整动画,不占滚动行程:
 * 到位(onLeave)后数字以 back.out 弹性自己弹开("12569→123456789"),
 * 回滚(onEnterBack)时先收回、scrub 再接管飞回。
 * ============================================================ */
const TARGET_FS = 40 /* 停靠字号 px:svg height=1em,故=停靠高度 */
const TARGET_TOP = 10
const SLOT_GAP = 12 /* 宽松态每个数字槽的加宽量 px */
const LEFT_MARGIN = 28 /* daum 贴视口左边缘的留白 */
const RANGE_VH = 0.4 /* pin 行程(视口高倍数)= p 0→1;品牌字按此标定,勿擅自加长 */
const SLOT_OF = [0, 1, 4, 5, 8] /* 1/2/5/6/9 在 9 槽中的槽位 */
const VB_W = 5295.5 /* BRAND_VIEWBOX 宽,px→viewBox 单位换算用 */

const slotRef = ref(null)
const titleRef = ref(null)
const pathRefs = []
let nat = null /* 自然态几何 {fs,left,docTop,svgH,digitCx[5]} */
let spreadDeltas = null /* 各数字 path 摊开位移(viewBox 单位),computeDock 算 */
let tl = null
let st = null
let committed = false /* onLeave 后 h1 已提交 fixed 钉住 */

/* ---------- 展开/收回:独立完整动画,不占滚动行程 ---------- */
const expandState = { v: 0 } /* 展开度 0-1(back.out 可短暂 >1 过冲) */
let expandTween = null

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

function driveExpansion(to) {
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
  if (!nat) return
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
function flyChase(_time, deltaTime) {
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
  if (!committed || !nat) return
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
  if (socialRowEl && socialStageEl && socNat) {
    endSocChase()
    const s = socialRowEl
    /* 入场级联途中回滚:停演清场,回 hero 由 reveal 常态接管 */
    if (socEnter.timer) {
      clearTimeout(socEnter.timer)
      socEnter.timer = null
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
}

/* ============================================================
 * 社交胶囊对接 tab 栏 —— 与品牌字同 pin/progress,但不走 timeline gap:
 * 合并用子项 translateX(合成层),飞行用 row translate3d;
 * applySocState(p) 单一驱动(scrub onUpdate / chase 共用),边合边飞。
 * commitDock 烘成 gap:0+fixed;flyBack 还原 gap 后从 p=1 追赶回家。
 *
 * 背景:飞行进度 p 到一半(SOCIAL_BG_FADE_END)即消散完毕,回程后半再凝聚;
 * 不再绑品牌 flyEase 展开。停靠高与主题开关齐平(32px / top 18)。
 * ============================================================ */
const SOCIAL_RIGHT = 98 /* 主题开关(right 18 + 宽 64)+ 16 间距 */
const SOCIAL_GAP = 12 /* 与 .social-row gap 一致;合并时用 x 收拢,不改 gap 触布局 */
const SOCIAL_MERGE_END = 0.55 /* p 到此合并完成;飞行全程 0→1 与之重叠 */
const SOCIAL_BG_FADE_END = 0.5 /* 飞行进度到此背景消散完 */
const SOCIAL_NAT_H = 48 /* hero 自然态按钮高 */
const SOCIAL_DOCK_H = 32 /* 与 ThemeToggle .track 同高 */
const SOCIAL_DOCK_TOP = 18 /* 与 .theme-floating top 同顶(窄屏 14 见 socDockTop) */
function socDockH() {
  return SOCIAL_DOCK_H
}
function socDockTop() {
  return typeof window !== 'undefined' && window.innerWidth <= 640 ? 14 : SOCIAL_DOCK_TOP
}

let socialStageEl = null
let socialRowEl = null
let socialItemEls = []
let socNat = null /* 自然态 {left,docTop,natW,mergedW,dockMergedW} */
let socRadius = 18 /* px,自 --radius 读 */
const socPose = { p: 1 }
let socChasing = false
let socBaked = false /* commit 后已烘成 gap:0,勿再 applySocState */

/** 停靠时胶囊右缘(主题开关左) */
function socDockRight() {
  return window.innerWidth - SOCIAL_RIGHT
}

function socDockLeft() {
  const w = socNat.dockMergedW || socNat.mergedW
  return socDockRight() - w
}

/** 合并量 0-1:p 在 [0, SOCIAL_MERGE_END] 内 power2.out 收拢 */
function mergeAmount(p) {
  const t = Math.min(1, Math.max(0, p / SOCIAL_MERGE_END))
  return 1 - (1 - t) * (1 - t)
}

/** 背景随飞行进度消散:p=0 实底 → p≥SOCIAL_BG_FADE_END 全消;回程反向凝聚 */
function applySocBg(p) {
  if (!socialItemEls.length) return
  const t = Math.min(1, Math.max(0, p / SOCIAL_BG_FADE_END))
  const bgO = (1 - t).toFixed(3)
  const blur = `${(t * 10).toFixed(2)}px`
  const scale = (1 + t * 0.06).toFixed(4)
  const applyVars = (el) => {
    el.style.setProperty('--soc-bg-o', bgO)
    el.style.setProperty('--soc-bg-blur', blur)
    el.style.setProperty('--soc-bg-scale', scale)
    el.style.setProperty('--soc-fg-dim', '0')
  }
  if (socialRowEl) applyVars(socialRowEl)
  for (const el of socialItemEls) applyVars(el)
}

/** 飞行进度上的高度:自然 48 → 与主题开关齐平的 32 */
function applySocSize(p) {
  if (!socialItemEls.length) return
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
}

/**
 * 按进度写合并 + 飞行。
 * 位移用「右缘锚定」:自然右缘 → 主题开关左缘 线性插值,再反推 left=right-packW。
 * 避免用最终 dock 宽算 left 导致缩宽/合并时右缘折线、最后一段像跳一下。
 * 进度与 ST 1:1(飞回 chase 除外),commit 前贴 p=1 再 bake,末段零跳变。
 */
function applySocState(p) {
  if (!socNat || !socialRowEl || socBaked) return
  const m = mergeAmount(p)
  const n = socialItemEls.length
  const r = socRadius
  applySocSize(p)
  let sumW = 0
  for (let i = 0; i < n; i++) {
    const el = socialItemEls[i]
    sumW += el.offsetWidth
    el.style.transform = `translate3d(${(-i * SOCIAL_GAP * m).toFixed(2)}px,0,0)`
    el.style.borderRadius = `${r}px`
  }
  /* 视觉胶囊宽 = 当前钮宽之和 + 残余 gap */
  const packW = sumW + SOCIAL_GAP * Math.max(0, n - 1) * (1 - m)
  socialRowEl.style.setProperty('--soc-merge', m.toFixed(4))
  socialRowEl.style.setProperty('--soc-pack-w', `${packW.toFixed(2)}px`)
  applySocBg(p)
  const natRight = socNat.left + (socNat.natW || packW)
  const right = natRight + (socDockRight() - natRight) * p
  const left = right - packW
  const dx = left - socNat.left
  const dy = (socDockTop() - socNat.docTop) * p
  socialRowEl.style.transform = `translate3d(${dx.toFixed(2)}px,${dy.toFixed(2)}px,0)`
  socPose.p = p
}

function socChase(_time, deltaTime) {
  const target = st ? st.progress : 0
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
const socEnter = { timer: null, played: false }

function scheduleSocialDockEntrance() {
  if (REDUCED || socEnter.played || !socialRowEl) return
  socEnter.played = true
  const row = socialRowEl
  row.classList.add('soc-enter-pending')
  /* 主题开关假层在 finishBoot 收尾后 ~2 帧撤离;留一呼吸口再入场 */
  socEnter.timer = setTimeout(() => {
    socEnter.timer = null
    row.classList.remove('soc-enter-pending')
    row.classList.add('soc-boot-enter')
    /* 末项(最左)延迟最长:0.5s + (n-1)·60ms,播完清场交还纯净 DOM */
    const span = 500 + Math.max(0, row.children.length - 1) * 60 + 150
    setTimeout(() => row.classList.remove('soc-boot-enter'), span)
  }, 160)
}

/**
 * 停靠烘焙:先 applySocState(1) 贴齐末帧,再清 transform 改 fixed。
 * 用 left(与 applySocState 右缘公式同值)而非只设 right,避免末段切换坐标系跳一下。
 */
function bakeSocDock() {
  if (!socialRowEl || !socNat) return
  const s = socialRowEl
  const r = socRadius
  const h = socDockH()
  const scale = h / SOCIAL_NAT_H
  const dockW = socNat.dockMergedW || socNat.mergedW
  const dockLeft = socDockRight() - dockW
  /* 先画到 p=1 视觉位,再钉 fixed——与品牌 clearProps 同序,末段连贯 */
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
  s.style.setProperty('--soc-pack-w', `${dockW}px`)
  socBaked = true
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
}

/* 自然态测量(hero 未被 pin/无 transform 时):一次测量,停靠几何纯按比例换算 */
function measure() {
  const el = titleRef.value
  if (!el || committed) return
  const svg = el.querySelector('.hero-brand-svg')
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
      docTop: r.top + window.scrollY,
      natW: r.width /* 含 gap 的自然总宽,右缘锚定用 */,
      mergedW,
      dockMergedW,
    }
    const rad = getComputedStyle(document.documentElement).getPropertyValue('--radius').trim()
    const parsed = parseFloat(rad)
    if (!Number.isNaN(parsed)) socRadius = parsed
  }
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
      (spacer + s * slotW + slotW / 2 - nat.digitCx[j] * rto) * (VB_W / (nat.w * rto)),
  )
}

/* pin 终点(onLeave):h1 提交为 fixed 钉在停靠位,与 timeline 末帧同位零跳变。
   必须提升到 body:被 pin 的 #hero 祖先可能残留 transform/clip 等形成
   包含块,fixed 相对它定位就会跟着滚走——挂到 body 下钉视口才真正钉住 */
function commitDock() {
  if (committed || !nat) return
  committed = true
  endFlyChase()
  const el = titleRef.value
  slotRef.value.style.height = `${nat.svgH}px`
  gsap.set(el, { clearProps: 'transform' })
  document.body.appendChild(el)
  el.style.position = 'fixed'
  el.style.margin = '0'
  el.style.left = `${dockGeo.left}px`
  el.style.top = `${dockGeo.top}px`
  el.style.fontSize = `${TARGET_FS}px`
  /* 社交胶囊:贴 p=1 → bake → fixed(left 与末帧同值),末段不跳 */
  if (socialRowEl && socNat) {
    endSocChase()
    const { dockLeft, dockTop } = bakeSocDock()
    const s = socialRowEl
    document.body.appendChild(s)
    s.style.position = 'fixed'
    s.style.margin = '0'
    s.style.right = 'auto'
    s.style.left = `${dockLeft}px`
    s.style.top = `${dockTop}px`
    s.style.zIndex = '60'
  }
}

function build() {
  if (!nat || !dockGeo.ready || tl || REDUCED) return
  const el = titleRef.value
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
        if (socChasing && self.progress >= 1) {
          endSocChase()
          applySocState(1)
        }
        /* 社交 1:1 跟 progress(飞回 chase 时由 ticker 覆盖) */
        if (!socChasing && !socBaked) applySocState(self.progress)
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
          if (!socChasing && !socBaked) applySocState(self.progress)
          return
        }
        const el = titleRef.value
        gsap.set(el, { clearProps: 'transform' })
        el.style.left = `${dockGeo.left}px`
        el.style.top = `${dockGeo.top}px`
        el.style.fontSize = `${TARGET_FS}px`
      },
    },
  })
  /* 品牌字 timeline scrub 1:1;社交 onUpdate → applySocState 右缘锚定 */
  tl.to(
    el,
    {
      x: () => dockGeo.left - nat.left,
      y: () => TARGET_TOP - nat.docTop,
      scale: () => TARGET_FS / nat.fs,
      transformOrigin: 'top left',
      ease: 'none',
      duration: 1,
    },
    0,
  )
  st = tl.scrollTrigger
  if (socNat) applySocState(st.progress)
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
 * 供 main.js 非首页 boot:量测 + 建 ST(仍在 scroll=0 / bootDone=false),
 * 不 commit——防 handoff 被钉停靠短路。
 */
function prepareBrandDockForBoot() {
  try {
    if (!committed) measure()
    if (!tl) build()
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
 * 供 main.js 非首页 boot 收尾:还原 scroll 后刷新 ST,
 * 若已过 pin 则 commit 停靠 + 展开(与 onLeave 同态)。
 * 仅应在 bootDone 后调用——boot 中途 progress=1 会短路 handoff 大标题落地。
 * opts.landTitle: 非首页路径保持 handoff-pending 至此处再亮,避免大标题闪一下再瞬移停靠。
 */
function syncBrandDockForBoot(opts = {}) {
  try {
    if (!nat && !committed) measure()
    if (!tl) build()
    ScrollTrigger.update()
    ScrollTrigger.refresh()
    if (st) {
      flyP.value = st.progress
      if (st.progress >= 1) {
        if (!committed) {
          commitDock()
          /* 深刷落地:row 已脱离 reveal 级联,同帧藏起并排演入场 */
          if (opts.landTitle) scheduleSocialDockEntrance()
        }
        driveExpansion(1)
      } else if (!committed && !socChasing && !socBaked) {
        applySocState(st.progress)
      }
    }
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

onMounted(() => {
  socialStageEl = document.querySelector('.social-stage')
  socialRowEl = document.querySelector('.social-row')
  socialItemEls = socialRowEl ? Array.from(socialRowEl.children) : []
  applySocBg(0)
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
})

const LEGACY_HREF = './legacy/?from=new'
const REDUCED = window.matchMedia('(prefers-reduced-motion: reduce)').matches
const NAV_DELAY_MS = 880

const legacyState = ref('idle')
const veilOrigin = ref({ '--tx': '50%', '--ty': '50%' })

let navTimer = null

function goLegacy(e) {
  if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return
  e.preventDefault()
  if (legacyState.value !== 'idle') return
  if (REDUCED) {
    window.location.assign('./legacy/')
    return
  }
  veilOrigin.value = { '--tx': `${e.clientX}px`, '--ty': `${e.clientY}px` }
  try {
    sessionStorage.setItem('daum-legacy-visit', '1')
    // 到岸虹膜同轴:旧版首帧前读取点击坐标,虹膜从此处收拢揭示。一次性,读后即清
    sessionStorage.setItem('daum-from-new', `${e.clientX},${e.clientY}`)
  } catch (err) {}
  document.documentElement.style.overflow = 'hidden'
  legacyState.value = 'covering'
  requestAnimationFrame(() => requestAnimationFrame(() => {
    if (legacyState.value === 'covering') legacyState.value = 'covered'
  }))
  navTimer = setTimeout(navigate, NAV_DELAY_MS)
}

function navigate() {
  if (legacyState.value === 'idle' || legacyState.value === 'leaving') return
  legacyState.value = 'leaving'
  clearTimeout(navTimer)
  window.location.assign(LEGACY_HREF)
}

onBeforeUnmount(() => {
  clearTimeout(navTimer)
  document.documentElement.style.overflow = ''
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
  if (socEnter.timer) clearTimeout(socEnter.timer)
  endFlyChase()
  endSocChase()
  if (st) st.kill()
  if (tl) tl.kill()
  st = null
  tl = null
})
</script>

<style scoped>
/* 首屏用扁平设计(实色填充 + 边框)而非新拟态阴影,风格在滚动后才揭晓 */
.hero {
  min-height: 92vh;
  display: flex;
  align-items: center;
  padding-top: clamp(80px, 14vw, 140px);
  /* pin 期间 GSAP 给本 section 加 transform 形成层叠上下文,
     h1 的 z-60 出不去,pager(z-50)的新数字会压在 SVG 数字上面画
     → 整个 section 提层,SVG 真身始终盖住滑入的新数字。
     pointer-events 放空,不挡主题切换等下层交互 */
  position: relative;
  z-index: 55;
  pointer-events: none;
}
/* 社交行恢复可点;其离场动画由 hero ScrollTrigger 驱动 */
.hero-social {
  pointer-events: auto;
}
.hero-inner {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  text-align: left;
  gap: 22px;
}
.title-slot {
  /* 飞行期间撑起 h1 原位,保首屏布局不塌 */
  align-self: flex-start;
}
.hero-title {
  font-size: clamp(2.8rem, 11vw, 6rem);
  line-height: 1;
  margin: 0;
  /* 停靠后浮在 tab 胶囊(z50)之上:daum 字形不被胶囊底盖住;
     点击穿透,让 PagePager 的数字按钮可点 */
  position: relative;
  z-index: 60;
  pointer-events: none;
}
/* Hero 品牌字:与 preloader 同源 Outfit800 SVG path,同字形同墨迹占比,
   height: 1em 使 SVG 视觉高≈原 HTML 文字(同字号同占比)。若实测 Hero 字
   偏大/偏小,微调此系数(偏大调小趋 0.9,偏小调大趋 1.2)。 */
.hero-brand-svg {
  height: 1em;
  width: auto;
  display: block;
  overflow: visible;
  will-change: transform;
}
.hero-char-path {
  fill: url(#heroBrandGrad);
  transition: opacity 0.2s var(--ease);
}
/* 交接前占位不可见;落地后立即显示(无淡入抢戏--飞行克隆已盖住同位) */
.hero-title.handoff-pending .hero-brand-svg {
  opacity: 0;
}
.hero-title.is-landed .hero-brand-svg {
  opacity: 1;
  transition: none;
}
@media (prefers-reduced-motion: reduce) {
  .hero-title.handoff-pending .hero-brand-svg,
  .hero-title.is-landed .hero-brand-svg {
    opacity: 1;
    transition: none;
  }
}
.hero-social {
  position: relative;
  margin-top: 8px;
}
/* 入场:纯淡入(覆盖全局 .reveal 的上移);位移由 GSAP 写在 .social-row 上,不冲突 */
.hero-social.reveal,
.hero-social.reveal-after-boot:not(.is-visible) {
  opacity: 0;
  transform: none;
  transition: opacity 0.55s var(--ease);
}
.hero-social.reveal.is-visible {
  opacity: 1;
  transform: none;
}
.social-stage {
  position: relative;
  display: inline-block;
  width: fit-content;
}
.social-row {
  --soc-merge: 0;
  --soc-pack-w: 100%;
  --soc-bg-o: 1;
  --soc-bg-blur: 0px;
  --soc-bg-scale: 1;
  display: flex;
  align-items: center;
  gap: 12px; /* 与 SOCIAL_GAP 同步;合并用子项 translateX,不动画此值 */
  position: relative;
  z-index: 1;
  will-change: transform;
}
/* 合并后唯一底:整条圆角胶囊,无接缝、不切碎边框 */
.social-row::before {
  content: '';
  position: absolute;
  left: 0;
  top: 0;
  height: 100%;
  width: var(--soc-pack-w);
  border-radius: var(--radius-full);
  background: var(--bg-2);
  opacity: calc(var(--soc-bg-o) * var(--soc-merge));
  filter: blur(var(--soc-bg-blur));
  transform: scale(var(--soc-bg-scale));
  transform-origin: center left;
  z-index: 0;
  pointer-events: none;
}
/* 子项底:自然态各自一块;合并时淡出,交给 row 胶囊 */
.social-icon,
.legacy-link {
  --soc-bg-o: 1;
  --soc-bg-blur: 0px;
  --soc-bg-scale: 1;
  --soc-fg-dim: 0;
  position: relative;
  z-index: 1;
  isolation: isolate;
  background: transparent !important;
  color: color-mix(in srgb, var(--text) calc((1 - var(--soc-fg-dim)) * 100%), var(--text-dim));
}
.social-icon::before,
.legacy-link::before {
  content: '';
  position: absolute;
  inset: 0;
  border-radius: inherit;
  background: var(--bg-2);
  /* 合并进度 ↑ → 子项底 ↓,避免五块圆角硬拼 */
  opacity: calc(var(--soc-bg-o) * (1 - var(--soc-merge)));
  filter: blur(var(--soc-bg-blur));
  transform: scale(var(--soc-bg-scale));
  transform-origin: center;
  z-index: -1;
  pointer-events: none;
  transition: background var(--dur) var(--ease);
}
.social-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 48px;
  height: 48px;
  border-radius: var(--radius);
  overflow: visible;
  will-change: transform;
  transition: color var(--dur) var(--ease);
}
.social-icon:hover {
  color: var(--accent);
}
.social-icon:hover::before {
  background: var(--accent-soft);
}
.social-icon :deep(svg) {
  width: var(--soc-icon, 22px);
  height: var(--soc-icon, 22px);
  overflow: visible;
  position: relative;
  z-index: 1;
}
/* 旧版入口:宽框 + 图标 + 文字,与 social-icon 同色系但形态区分 */
.legacy-link {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  height: 48px;
  padding: 0 18px;
  border-radius: var(--radius);
  font-size: 15px;
  font-weight: 600;
  font-family: var(--font-display);
  white-space: nowrap;
  will-change: transform;
  transition: color var(--dur) var(--ease);
}
.legacy-link:hover {
  color: var(--accent);
}
.legacy-link:hover::before {
  background: var(--accent-soft);
}
.legacy-link :deep(svg) {
  width: var(--soc-icon, 20px);
  height: var(--soc-icon, 20px);
  overflow: visible;
  position: relative;
  z-index: 1;
}
.legacy-link span {
  position: relative;
  z-index: 1;
}

/* ---------- 非首页深刷:停靠社交行入场 ----------
   commit 同帧 pending 隐藏;入场自主题开关方向右→左级联,
   微升 + 微弹 + 轻旋正,与数字摊开同一 spring 语系 */
.social-row.soc-enter-pending {
  opacity: 0;
}
.social-row.soc-boot-enter > * {
  animation: soc-dock-in 0.5s cubic-bezier(0.34, 1.35, 0.42, 1) both;
}
.social-row.soc-boot-enter > :nth-last-child(1) {
  animation-delay: 0ms;
}
.social-row.soc-boot-enter > :nth-last-child(2) {
  animation-delay: 60ms;
}
.social-row.soc-boot-enter > :nth-last-child(3) {
  animation-delay: 120ms;
}
.social-row.soc-boot-enter > :nth-last-child(4) {
  animation-delay: 180ms;
}
.social-row.soc-boot-enter > :nth-last-child(5) {
  animation-delay: 240ms;
}
.social-row.soc-boot-enter > :nth-last-child(6) {
  animation-delay: 300ms;
}
@keyframes soc-dock-in {
  0% {
    opacity: 0;
    transform: translate3d(7px, 4px, 0) scale(0.55) rotate(-5deg);
  }
  55% {
    opacity: 1;
  }
  100% {
    opacity: 1;
    transform: translate3d(0, 0, 0) scale(1) rotate(0deg);
  }
}
@media (prefers-reduced-motion: reduce) {
  .social-row.soc-boot-enter > * {
    animation: none;
  }
}

/* ---------- 旧版转场幕布 ---------- */
.legacy-veil {
  position: fixed;
  inset: 0;
  z-index: 9999;
  background: var(--bg);
  clip-path: circle(0px at var(--tx, 50%) var(--ty, 50%));
  pointer-events: none;
}
.legacy-veil.is-covered,
.legacy-veil.is-leaving {
  clip-path: circle(150vmax at var(--tx, 50%) var(--ty, 50%));
  transition: clip-path 0.85s cubic-bezier(0.65, 0, 0.2, 1);
}
.legacy-veil-glow {
  position: absolute;
  inset: 0;
  background: radial-gradient(
    circle 38vmax at var(--tx, 50%) var(--ty, 50%),
    var(--accent-soft),
    transparent 70%
  );
  opacity: 0;
  transition: opacity 0.6s var(--ease);
}
.legacy-veil.is-covered .legacy-veil-glow {
  opacity: 1;
}
@media (prefers-reduced-motion: reduce) {
  .legacy-veil,
  .legacy-veil-glow {
    transition: none;
  }
}

</style>
