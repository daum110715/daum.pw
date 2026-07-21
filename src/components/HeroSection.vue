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
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import { Icon } from '@iconify/vue'
import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { social } from '@/data/social'
import { BRAND_TEXT, BRAND_VIEWBOX, BRAND_GROUP_TRANSFORM, BRAND_PATHS } from '@/data/brandGlyph'
import { dockGeo, flyP, flyEase } from '@/composables/brandDock'

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
const RANGE_VH = 0.4 /* pin 行程(视口高倍数)= p 0→1 */
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
   (旧实现:0.25s 固定终点补间 + 滚动即杀——snap 延迟 0.12s 小于收回
   0.35s,必然在收回途中挪动进度;杀补间瞬间姿态从 p=1 跳变到当前
   进度,即快速收回时瞬移的根因) */
function flyChase(_time, deltaTime) {
  const target = st ? st.progress : 0
  const k = 1 - Math.pow(0.82, (deltaTime || 16.667) / 16.667) /* 帧率无关追赶系数 */
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
  /* 社交胶囊同步回家:回到 hero 原位,同法追赶交还 scrub */
  if (socialRowEl && socialStageEl && socNat) {
    endSocChase()
    const s = socialRowEl
    socialStageEl.appendChild(s)
    s.style.position = ''
    s.style.margin = ''
    s.style.left = ''
    s.style.right = ''
    s.style.top = ''
    s.style.zIndex = ''
    socPose.p = 1
    applySocPose()
    socChasing = true
    gsap.ticker.add(socChase)
  }
}

/* ============================================================
 * 社交胶囊对接 tab 栏 —— 与品牌字同法:自然位测量、scrub 飞行、
 * commitDock 提交 fixed、flyBack 追赶回家;合并态原样停靠,不参与展开
 * ============================================================ */
const SOCIAL_TOP = 6 /* 与 pager 胶囊同顶线(dockGeo.top 10 - 4) */
const SOCIAL_RIGHT = 98 /* 主题开关(right 18 + 宽 64)+ 16 间距 */

let socialStageEl = null
let socialRowEl = null
let socialItemEls = []
let socNat = null /* 自然态几何 {left,docTop,mergedW} */
const socPose = { p: 1 }
let socChasing = false

function socDockLeft() {
  return window.innerWidth - SOCIAL_RIGHT - socNat.mergedW
}

function applySocPose() {
  if (!socNat || !socialRowEl) return
  const p = socPose.p
  socialRowEl.style.transform = `translate(${(socDockLeft() - socNat.left) * p}px, ${(SOCIAL_TOP - socNat.docTop) * p}px)`
}

function socChase(_time, deltaTime) {
  const target = st ? st.progress : 0
  const k = 1 - Math.pow(0.82, (deltaTime || 16.667) / 16.667)
  socPose.p += (target - socPose.p) * k
  if (Math.abs(target - socPose.p) < 0.002) socPose.p = target
  applySocPose()
  if (socPose.p === target) endSocChase() /* 收敛:姿态=scrub 渲染值,原地交还 */
}

function endSocChase() {
  if (!socChasing) return
  socChasing = false
  gsap.ticker.remove(socChase)
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
  if (socialRowEl && socialItemEls.length) {
    const r = socialRowEl.getBoundingClientRect()
    socNat = {
      left: r.left,
      docTop: r.top + window.scrollY,
      mergedW: socialItemEls.reduce((sum, it) => sum + it.offsetWidth, 0),
    }
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
  /* 社交胶囊同法提交:钉进 tab 栏右侧空白(pager 同顶线,主题开关左) */
  if (socialRowEl && socNat) {
    endSocChase()
    const s = socialRowEl
    gsap.set(s, { clearProps: 'transform' })
    document.body.appendChild(s)
    s.style.position = 'fixed'
    s.style.margin = '0'
    s.style.left = 'auto'
    s.style.right = `${SOCIAL_RIGHT}px`
    s.style.top = `${SOCIAL_TOP}px`
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
      scrub: true,
      pin: true,
      anticipatePin: 1,
      invalidateOnRefresh: true,
      /* 自动吸附:滚动停稳后若品牌字悬在飞行半途,吸附到就近端点
         (自然位 p=0 / 停靠位 p=1),消除"滚到一半"的尴尬态;
         吸附过程的连续滚动由 onUpdate 直接接管飞回姿态,与 snap 无冲突 */
      snap: {
        snapTo: (v) => (v < 0.5 ? 0 : 1),
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
           commitDock 随之钉住零跳变;其余情况追赶每帧自读 st.progress,
           无需干预——scrub 写入会被 ticker 上的追赶姿态覆盖,同公式同序 */
        if (flyChasing && self.progress >= 1) {
          endFlyChase()
          flyPose.p = 1
          applyFlyPose()
        }
        if (socChasing && self.progress >= 1) {
          endSocChase()
          socPose.p = 1
          applySocPose()
        }
      },
      onLeave: () => {
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
  /* 社交胶囊对接 tab 栏:图标原地合并成连续胶囊(0–0.22),随后整颗飞往
     栏内右侧停靠位(0.32–1,与品牌字同行程同抵),到位由 commitDock 提交
     fixed,合并态原样停靠;收回时从栏位起飞追赶回家 */
  if (socialStageEl && socialRowEl && socNat) {
    const socialRow = socialRowEl
    tl.to(
      socialRow,
      {
        gap: 0,
        duration: 0.22,
        ease: 'none',
      },
      0,
    )
    /* 合并时同步把中间子元素圆角收平、首尾保留外侧圆角,形成一个连续大按钮 */
    const radiusVal =
      getComputedStyle(document.documentElement).getPropertyValue('--radius').trim() || '18px'
    const firstItem = socialItemEls[0]
    const lastItem = socialItemEls[socialItemEls.length - 1]
    const middleItems = socialItemEls.slice(1, -1)
    if (middleItems.length) {
      tl.to(
        middleItems,
        {
          borderRadius: 0,
          duration: 0.22,
          ease: 'none',
        },
        0,
      )
    }
    tl.to(
      firstItem,
      {
        borderRadius: `${radiusVal} 0 0 ${radiusVal}`,
        duration: 0.22,
        ease: 'none',
      },
      0,
    )
    tl.to(
      lastItem,
      {
        borderRadius: `0 ${radiusVal} ${radiusVal} 0`,
        duration: 0.22,
        ease: 'none',
      },
      0,
    )
    /* 飞行:整颗胶囊对接 tab 栏右侧(主题开关左),与品牌字同抵 */
    tl.to(
      socialRow,
      {
        x: () => (socNat ? socDockLeft() - socNat.left : 0),
        y: () => (socNat ? SOCIAL_TOP - socNat.docTop : 0),
        ease: 'none',
        duration: 0.68,
      },
      0.32,
    )
  }
  st = tl.scrollTrigger
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

onMounted(() => {
  socialStageEl = document.querySelector('.social-stage')
  socialRowEl = document.querySelector('.social-row')
  socialItemEls = socialRowEl ? Array.from(socialRowEl.children) : []
  requestAnimationFrame(() => {
    measure()
    build()
  })
  window.addEventListener('resize', onResize)
  window.addEventListener('wheel', onWheelInertia, { passive: false })
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(() => {
      measure()
      if (st) ScrollTrigger.refresh()
      else build()
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

/* ============================================================
 * 飞行区间滚轮惯性 —— 仅 hero pin 行程内接管桌面滚轮
 * 区间内 wheel 事件转为速度累积,rAF 每帧指数衰减驱动 scrollTo;
 * 滑行停在中途由 snap 吸附到端点。触摸/键盘/滚动条保持原生,
 * scrub 仍 1:1 跟随真实滚动,零跳变交接不受影响
 * ============================================================ */
const WHEEL_BOOST = 8 /* 滚轮增量 → 初速度放大(px/s per px) */
const WHEEL_FRICTION = 0.94 /* 每帧速度保留率(60fps 基准) */
const WHEEL_MIN_V = 40 /* 低于该速度(px/s)停止滑行 */
const WHEEL_MAX_V = 4200

let wheelV = 0
let wheelRaf = null
let wheelLast = 0

function pinEndY() {
  return st ? st.end : window.innerHeight * RANGE_VH
}

function wheelInRange(e) {
  if (REDUCED || !st || legacyState.value !== 'idle') return false
  if (Math.abs(e.deltaY) < Math.abs(e.deltaX)) return false
  const y = window.scrollY
  if (e.deltaY > 0) return y < pinEndY()
  if (e.deltaY < 0) return y > 0 && y <= pinEndY() + 1
  return false
}

function onWheelInertia(e) {
  if (!wheelInRange(e)) {
    /* 区间外的滚轮输入 = 用户接管,终止残余滑行 */
    if (wheelRaf) stopWheelGlide()
    return
  }
  e.preventDefault()
  const unit = e.deltaMode === 1 ? 16 : 1
  wheelV = Math.max(-WHEEL_MAX_V, Math.min(WHEEL_MAX_V, wheelV + e.deltaY * unit * WHEEL_BOOST))
  if (!wheelRaf) {
    wheelLast = performance.now()
    wheelRaf = requestAnimationFrame(wheelGlide)
  }
}

function wheelGlide(now) {
  const dt = Math.min((now - wheelLast) / 1000, 0.05)
  wheelLast = now
  wheelV *= Math.pow(WHEEL_FRICTION, dt * 60)
  const y = window.scrollY
  if (Math.abs(wheelV) < WHEEL_MIN_V || (wheelV < 0 && y <= 0)) {
    stopWheelGlide()
    return
  }
  /* instant:绕过全局 scroll-behavior: smooth,避免双重平滑 */
  window.scrollTo({ top: y + wheelV * dt, behavior: 'instant' })
  wheelRaf = requestAnimationFrame(wheelGlide)
}

function stopWheelGlide() {
  if (wheelRaf) cancelAnimationFrame(wheelRaf)
  wheelRaf = null
  wheelV = 0
}

onBeforeUnmount(() => {
  clearTimeout(navTimer)
  stopWheelGlide()
  document.documentElement.style.overflow = ''
  window.removeEventListener('resize', onResize)
  window.removeEventListener('wheel', onWheelInertia)
  retractPending = false
  if (expandTween) expandTween.kill()
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
  /* 社交行整体由 GSAP 驱动离场动画,这里不再保留 opacity transition,
     避免与 scrub 驱动的位移动画冲突;transform 入场也关闭,让 scroll 动画完全接管。 */
  transition: none;
}
.social-stage {
  position: relative;
  display: inline-block;
  width: fit-content;
}
.social-row {
  display: flex;
  gap: 12px;
  position: relative;
  z-index: 1;
}
.social-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 48px;
  height: 48px;
  border-radius: var(--radius);
  background: var(--bg-2);
  color: var(--text);
  overflow: visible;
  transition:
    color var(--dur) var(--ease),
    background var(--dur) var(--ease);
}
.social-icon:hover {
  color: var(--accent);
  background: var(--accent-soft);
}
.social-icon :deep(svg) {
  width: 22px;
  height: 22px;
  overflow: visible;
}
/* 旧版入口:宽框 + 图标 + 文字,与 social-icon 同色系但形态区分 */
.legacy-link {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  height: 48px;
  padding: 0 18px;
  border-radius: var(--radius);
  background: var(--bg-2);
  color: var(--text);
  font-size: 15px;
  font-weight: 600;
  font-family: var(--font-display);
  white-space: nowrap;
  transition:
    color var(--dur) var(--ease),
    background var(--dur) var(--ease);
}
.legacy-link:hover {
  color: var(--accent);
  background: var(--accent-soft);
}
.legacy-link :deep(svg) {
  width: 20px;
  height: 20px;
  overflow: visible;
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
