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
      <div class="hero-social reveal reveal-after-boot" :style="socialStyle">
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
 * hero 被 pin 在视口顶,滚动行程(RANGE_VH·vh)即动画进度——
 * p 0→0.7 品牌字整体 transform 缩小平移到左上停靠位;
 * p 0.75→1 同一个 SVG 内的 5 条数字路径平移摊开(左→右微交错),
 * 空槽由 PagePager 的 3/4/7/8 新数字补入——自始至终就这一个元素,
 * 无交接、无替身、无重影。
 * 进度可正放可倒放,滚多少走多少。滚过终点 onLeave 时 h1 提交为
 * fixed 钉住(视觉零跳变),回滚 onEnterBack 恢复 scrub 接管。
 * 数字展开由 flyP(=st.progress)驱动 PagePager。
 * ============================================================ */
const TARGET_FS = 40 /* 停靠字号 px:svg height=1em,故=停靠高度 */
const TARGET_TOP = 10
const SLOT_GAP = 12 /* 宽松态每个数字槽的加宽量 px */
const LEFT_MARGIN = 16 /* daum 贴视口左边缘的留白 */
const RANGE_VH = 0.8 /* pin 行程(视口高倍数)= p 0→1 */
const SLOT_OF = [0, 1, 4, 5, 8] /* 1/2/5/6/9 在 9 槽中的槽位 */
const VB_W = 5295.5 /* BRAND_VIEWBOX 宽,px→viewBox 单位换算用 */

const slotRef = ref(null)
const titleRef = ref(null)
const pathRefs = []
const scrollYVal = ref(0)
let nat = null /* 自然态几何 {fs,left,docTop,svgH,digitCx[5]} */
let spreadDeltas = null /* 各数字 path 摊开位移(viewBox 单位),computeDock 算 */
let tl = null
let st = null
let committed = false /* onLeave 后 h1 已提交 fixed 钉住 */

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
  const el = titleRef.value
  slotRef.value.style.height = `${nat.svgH}px`
  gsap.set(el, { clearProps: 'transform' })
  document.body.appendChild(el)
  el.style.position = 'fixed'
  el.style.margin = '0'
  el.style.left = `${dockGeo.left}px`
  el.style.top = `${dockGeo.top}px`
  el.style.fontSize = `${TARGET_FS}px`
}

  /* 回滚进触发区(onEnterBack):撤掉 fixed,按当前 progress 摆回 scrub 姿态,
   之后由 scrub 接管——无一帧跳变。移动段只占 p 0→0.7,先归一化 */
function uncommitDock() {
  if (!committed || !nat) return
  committed = false
  const el = titleRef.value
  slotRef.value.appendChild(el) /* 放回 slot,恢复 scrub 接管 */
  el.style.position = ''
  el.style.margin = ''
  el.style.left = ''
  el.style.top = ''
  el.style.fontSize = ''
  slotRef.value.style.height = ''
  const pm = Math.min(1, (st ? st.progress : 0) / 0.7)
  el.style.transformOrigin = 'top left'
  el.style.transform = `translate(${(dockGeo.left - nat.left) * pm}px, ${(TARGET_TOP - nat.docTop) * pm}px) scale(${1 + (TARGET_FS / nat.fs - 1) * pm})`
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
      onUpdate: (self) => {
        const p = self.progress
        flyP.value = p
        /* 展开单一驱动:p 0.75→1 经 smoothstep 缓动后广播——
           SVG 数字位置、PagePager 槽宽/新数字全用这一条曲线,
           任意进度下每个数字都严丝合缝落在自己槽位,不叠字 */
        const t = Math.min(1, Math.max(0, (p - 0.75) / 0.25))
        const e = t * t * (3 - 2 * t)
        flyEase.value = e
        if (spreadDeltas) {
          for (let j = 0; j < 5; j++) {
            gsap.set(pathRefs[4 + j], { x: spreadDeltas[j] * e })
          }
        }
      },
      onLeave: commitDock,
      onEnterBack: uncommitDock,
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
      duration: 0.7,
    },
    0,
  )
  /* 时间轴补满到时长 1:移动段 0→0.7 到位后静止,
     展开段 0.75→1 由 onUpdate 经 flyEase 手工驱动(无补间) */
  tl.set({}, {}, 1)
  st = tl.scrollTrigger
}

function onScroll() {
  scrollYVal.value = window.scrollY
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

/* 社交行(含旧版入口):下滚前 200px 内淡出消失,不跟着品牌飞 */
const socialStyle = computed(() => {
  const o = Math.max(0, 1 - scrollYVal.value / 200)
  if (o === 1) return {}
  return { opacity: o, pointerEvents: o === 0 ? 'none' : '' }
})

onMounted(() => {
  requestAnimationFrame(() => {
    measure()
    build()
  })
  window.addEventListener('scroll', onScroll, { passive: true })
  window.addEventListener('resize', onResize)
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

onBeforeUnmount(() => {
  clearTimeout(navTimer)
  document.documentElement.style.overflow = ''
  window.removeEventListener('scroll', onScroll)
  window.removeEventListener('resize', onResize)
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
/* 社交行恢复可点(淡出时 socialStyle 会再关掉) */
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
  display: flex;
  gap: 12px;
  margin-top: 8px;
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
