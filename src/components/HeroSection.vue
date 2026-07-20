<template>
  <section id="hero" class="section hero" aria-label="首页">
    <div class="container hero-inner">
      <!-- 标题与开屏品牌同源 SVG:preloader 描边 -> 克隆飞入此位 -> 落地零跳变 -->
      <h1 class="hero-title handoff-pending">
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
              class="hero-char-path"
              :d="p.d"
            />
          </g>
        </svg>
        <span class="visually-hidden">{{ BRAND_TEXT }}</span>
      </h1>
      <div class="hero-social reveal reveal-after-boot">
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

  <!-- 旧版转场:圆形幕布自点击处展开,幕后 iframe 预载旧版,就绪后无缝替换 -->
  <Teleport to="body">
    <div
      v-if="legacyState !== 'idle'"
      class="legacy-veil"
      :class="[`is-${legacyState}`, { 'is-frame-ready': frameReady }]"
      :style="veilOrigin"
      aria-hidden="true"
    >
      <div class="legacy-veil-glow" />
      <iframe
        class="legacy-veil-frame"
        src="./legacy/"
        title="旧版站点"
        tabindex="-1"
        @load="onFrameLoad"
      />
      <div class="legacy-veil-hint">
        <span class="legacy-veil-dot" />
        <span>正在前往旧版</span>
      </div>
    </div>
  </Teleport>
</template>

<script setup>
import { ref, computed, onBeforeUnmount } from 'vue'
import { Icon } from '@iconify/vue'
import { social } from '@/data/social'
import { BRAND_TEXT, BRAND_VIEWBOX, BRAND_GROUP_TRANSFORM, BRAND_PATHS } from '@/data/brandGlyph'

const LEGACY_HREF = './legacy/'
const REDUCED = window.matchMedia('(prefers-reduced-motion: reduce)').matches
const MIN_VEIL_MS = 850
const NAV_TIMEOUT_MS = 6000

const legacyState = ref('idle')
const frameReady = ref(false)
const veilOrigin = ref({ '--tx': '50%', '--ty': '50%' })

let navTimer = null
let minTimer = null
let frameLoaded = false
let veilShownAt = 0

const navigating = computed(() => legacyState.value === 'leaving')

function goLegacy(e) {
  if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return
  e.preventDefault()
  if (legacyState.value !== 'idle') return
  if (REDUCED) {
    window.location.assign(LEGACY_HREF)
    return
  }
  veilOrigin.value = { '--tx': `${e.clientX}px`, '--ty': `${e.clientY}px` }
  try {
    sessionStorage.setItem('daum-legacy-visit', '1')
  } catch (err) {}
  document.documentElement.style.overflow = 'hidden'
  veilShownAt = performance.now()
  legacyState.value = 'covering'
  requestAnimationFrame(() => requestAnimationFrame(() => {
    if (legacyState.value === 'covering') legacyState.value = 'covered'
  }))
  navTimer = setTimeout(navigate, NAV_TIMEOUT_MS)
}

function onFrameLoad() {
  if (frameLoaded) return
  frameLoaded = true
  const wait = Math.max(0, MIN_VEIL_MS - (performance.now() - veilShownAt))
  minTimer = setTimeout(() => {
    frameReady.value = true
    setTimeout(navigate, 420)
  }, wait)
}

function navigate() {
  if (legacyState.value === 'leaving') return
  legacyState.value = 'leaving'
  clearTimeout(navTimer)
  clearTimeout(minTimer)
  window.location.assign(LEGACY_HREF)
}

onBeforeUnmount(() => {
  clearTimeout(navTimer)
  clearTimeout(minTimer)
  document.documentElement.style.overflow = ''
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
.hero-title {
  font-size: clamp(2.8rem, 11vw, 6rem);
  line-height: 1;
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
.legacy-veil-frame {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  border: 0;
  opacity: 0;
  transform: scale(1.03);
  filter: blur(10px);
  transition:
    opacity 0.45s var(--ease),
    transform 0.6s cubic-bezier(0.22, 1, 0.36, 1),
    filter 0.5s var(--ease);
}
.legacy-veil.is-frame-ready .legacy-veil-frame {
  opacity: 1;
  transform: scale(1);
  filter: blur(0);
}
.legacy-veil-hint {
  position: absolute;
  left: 50%;
  bottom: clamp(28px, 6vh, 56px);
  transform: translateX(-50%);
  display: inline-flex;
  align-items: center;
  gap: 10px;
  color: var(--text-dim);
  font-size: 14px;
  font-family: var(--font-display);
  letter-spacing: 0.04em;
  opacity: 0;
  transition: opacity 0.4s var(--ease) 0.35s;
}
.legacy-veil.is-covered .legacy-veil-hint {
  opacity: 1;
}
.legacy-veil.is-frame-ready .legacy-veil-hint {
  opacity: 0;
  transition-delay: 0s;
}
.legacy-veil-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--accent);
  animation: legacy-veil-pulse 1s var(--ease) infinite;
}
@keyframes legacy-veil-pulse {
  0%, 100% { transform: scale(1); opacity: 1; }
  50% { transform: scale(1.7); opacity: 0.4; }
}
@media (prefers-reduced-motion: reduce) {
  .legacy-veil,
  .legacy-veil-glow,
  .legacy-veil-frame,
  .legacy-veil-hint {
    transition: none;
  }
  .legacy-veil-dot {
    animation: none;
  }
}

</style>
