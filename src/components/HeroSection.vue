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
import { ref, computed, watch, onMounted, onBeforeUnmount } from 'vue'
import { Icon } from '@iconify/vue'
import { social } from '@/data/social'
import { BRAND_TEXT, BRAND_VIEWBOX, BRAND_GROUP_TRANSFORM, BRAND_PATHS } from '@/data/brandGlyph'
import { dockGeo, dockState } from '@/composables/brandDock'

/* ============================================================
 * 品牌字真身飞入 tab 栏 —— 与开屏 preloader→Hero 同一技法:
 * 越过滚动阈值时,把同一个 h1 pin 成 fixed,一次性 WAAPI 飞行
 * (left/top/fontSize,780ms SMOOTH),落地提交终态;回滚到顶反向。
 * 反向收回与飞行交叠:3/4/7/8 收没 + 数字滑回先行 200ms,
 * 飞行随即启动,收回(0.5s)在飞行(0.78s)途中完成,全程无停顿。
 * 落位后:daum 留在 tab 栏最左不动(SVG 真身),SVG 数字淡出,
 * PagePager 的同字体 DOM 数字原位淡入并左→右展开 3/4/7/8。
 * ============================================================ */
const TARGET_FS = 40 /* 停靠字号 px:svg height=1em,故=停靠高度 */
const TARGET_TOP = 10
const SLOT_GAP = 12 /* 宽松态每个数字槽的加宽量 px */
const LEFT_MARGIN = 16 /* daum 贴视口左边缘的留白 */
const FLIGHT_MS = 780
const COLLAPSE_LEAD_MS = 200 /* 收回先行量(与飞行交叠) */
const SMOOTH = 'cubic-bezier(0.45, 0.05, 0.25, 1)'
const FLY_DOWN_Y = 80
const FLY_BACK_Y = 40

const slotRef = ref(null)
const titleRef = ref(null)
const pathRefs = []
const scrollYVal = ref(0)
const wait = (ms) => new Promise((r) => setTimeout(r, ms))
let nat = null /* 自然态几何 {fs,left,docTop,w,digitCx[5]} */
let flying = false

/* 自然态测量(仅 state=hero 时可信):一次测量,停靠几何纯按比例换算 */
function measure() {
  const el = titleRef.value
  if (!el || dockState.value !== 'hero') return
  const svg = el.querySelector('.hero-brand-svg')
  const r = svg.getBoundingClientRect()
  const digitEls = [4, 5, 6, 7, 8].map((i) => pathRefs[i]).filter(Boolean)
  if (digitEls.length !== 5) return
  nat = {
    fs: parseFloat(getComputedStyle(el).fontSize),
    left: r.left,
    docTop: r.top + window.scrollY,
    w: r.width,
    digitCx: digitEls.map((d) => {
      const b = d.getBoundingClientRect()
      return b.left + b.width / 2 - r.left
    }),
    digitH: digitEls[0].getBoundingClientRect().height,
  }
  computeDock()
}

/* 停靠几何 = 自然几何 × (TARGET_FS/fs):
   daum 在左(spacer=数字 1 槽位左缘),右接 9 个等步进数字槽;
   胶囊左缘对齐视口 LEFT_MARGIN,散开时向右生长,daum 纹丝不动 */
function computeDock() {
  if (!nat) return
  const rto = TARGET_FS / nat.fs
  const a = (nat.digitCx[1] - nat.digitCx[0]) * rto
  const spacer = (nat.digitCx[0] - (nat.digitCx[1] - nat.digitCx[0]) / 2) * rto
  const wCompact = spacer + 5 * a + 8
  const wFull = spacer + 9 * (a + SLOT_GAP) + 8
  Object.assign(dockGeo, {
    ready: true,
    left: LEFT_MARGIN + 4,
    top: TARGET_TOP,
    w: nat.w * rto,
    h: TARGET_FS,
    advance: a,
    slotLoose: a + SLOT_GAP,
    spacer,
    wCompact,
    wFull,
    digitH: nat.digitH * rto,
  })
}

/* 停靠态/首屏态的样式由 watcher 在状态稳定后应用;飞行中(flying)
   不干预,避免 Vue :style 绑定覆盖 WAAPI 关键帧。后台切回时
   visibilitychange 也会触发一次补刷。 */
function applyDockStyle() {
  const el = titleRef.value
  if (!el) return
  if (dockState.value === 'docked') {
    el.style.position = 'fixed'
    el.style.left = `${dockGeo.left}px`
    el.style.top = `${dockGeo.top}px`
    el.style.fontSize = `${TARGET_FS}px`
    el.style.margin = '0'
  } else if (dockState.value === 'hero') {
    el.style.position = ''
    el.style.left = ''
    el.style.top = ''
    el.style.fontSize = ''
    el.style.margin = ''
  }
}
watch(dockState, applyDockStyle)

async function fly(toDock) {
  if (flying || !dockGeo.ready) return
  flying = true
  const el = titleRef.value
  const slot = slotRef.value
  const svg = el.querySelector('.hero-brand-svg')
  /* 反向收回先行 200ms(数字滑回 + 3/4/7/8 收没),随即启动飞行,
     收回(0.5s)在飞行(0.78s)途中完成——全程平滑位移 */
  if (!toDock && !REDUCED) {
    dockState.value = 'collapsing'
    await wait(COLLAPSE_LEAD_MS)
  }
  const fromRect = svg.getBoundingClientRect()
  const fromFs = toDock ? parseFloat(getComputedStyle(el).fontSize) : TARGET_FS
  const to = toDock
    ? { left: dockGeo.left, top: TARGET_TOP, fs: TARGET_FS }
    : { left: nat.left, top: nat.docTop - window.scrollY, fs: nat.fs }
  dockState.value = 'flying'
  slot.style.height = `${fromRect.height}px`
  el.style.position = 'fixed'
  el.style.margin = '0'
  el.style.left = `${fromRect.left}px`
  el.style.top = `${fromRect.top}px`
  el.style.fontSize = `${fromFs}px`
  if (!toDock) el.classList.remove('is-docked')

  const finish = () => {
    if (toDock) {
      /* 落位:SVG 数字淡出(DOM 数字同位淡入由 PagePager .is-docked 驱动),
         daum 留在原地——它就是 tab 栏最左的标识 */
      el.classList.add('is-docked')
      dockState.value = 'docked'
    } else {
      el.style.position = ''
      el.style.margin = ''
      el.style.left = ''
      el.style.top = ''
      el.style.fontSize = ''
      slot.style.height = ''
      dockState.value = 'hero'
    }
    flying = false
    onScroll()
  }
  if (REDUCED) {
    finish()
    return
  }
  try {
    const anim = el.animate(
      [
        { left: `${fromRect.left}px`, top: `${fromRect.top}px`, fontSize: `${fromFs}px` },
        { left: `${to.left}px`, top: `${to.top}px`, fontSize: `${to.fs}px` },
      ],
      { duration: FLIGHT_MS, easing: SMOOTH, fill: 'forwards' },
    )
    await anim.finished.catch(() => {})
    anim.cancel()
  } catch (e) {}
  finish()
}

function onScroll() {
  scrollYVal.value = window.scrollY
  if (flying) return
  if (dockState.value === 'hero' && window.scrollY > FLY_DOWN_Y) fly(true)
  else if (dockState.value === 'docked' && window.scrollY < FLY_BACK_Y) fly(false)
}

function onResize() {
  if (dockState.value === 'hero') {
    measure()
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
  requestAnimationFrame(measure)
  window.addEventListener('scroll', onScroll, { passive: true })
  window.addEventListener('resize', onResize)
  document.addEventListener('visibilitychange', onVisibility)
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(measure)
})

function onVisibility() {
  if (!document.hidden) applyDockStyle()
}

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
  document.removeEventListener('visibilitychange', onVisibility)
})
</script>

<style scoped>
/* 首屏用扁平设计(实色填充 + 边框)而非新拟态阴影,风格在滚动后才揭晓 */
.hero {
  min-height: 92vh;
  display: flex;
  align-items: center;
  padding-top: clamp(80px, 14vw, 140px);
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
/* 停靠后 SVG 数字淡出:PagePager 的同字体 DOM 数字同位淡入接替,
   daum 保持 SVG 真身不动 */
.hero-title.is-docked .hero-char-path.is-digit {
  opacity: 0;
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
