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
                :ref="(el) => (pathRefs[i] = el as SVGPathElement)"
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
          <!-- 独立背景层:不随图标移动/缩放,只由 entrance 淡入,停靠时保持原位 -->
          <div class="social-bg-row" aria-hidden="true">
            <span v-for="s in social" :key="`bg-${s.url}`" class="social-bg" />
            <span class="social-bg social-bg-wide" />
          </div>
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

<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount } from 'vue'
import { Icon } from '@iconify/vue'
import { social } from '@/data/social'
import { BRAND_TEXT, BRAND_VIEWBOX, BRAND_GROUP_TRANSFORM, BRAND_PATHS } from '@/data/brandGlyph'
import { useSocialDock } from '@/composables/useSocialDock'
import { useHeroDock, RANGE_VH } from '@/composables/useHeroDock'
import { useLegacyVeil } from '@/composables/useLegacyVeil'

const slotRef = ref<HTMLElement | null>(null)
const titleRef = ref<HTMLElement | null>(null)
const pathRefs: SVGPathElement[] = []

/* 社交胶囊(合并/飞行/停靠/入场)与品牌字(pin/飞行/停靠/展开)分驻两个
   composable,经 ops 对象显式对接;社交 chase 经 getProgress 读 st.progress */
const soc = useSocialDock({ getProgress: () => dock.getProgress(), rangeVh: RANGE_VH })
const dock = useHeroDock({ slotRef, titleRef, pathRefs, soc })
const { legacyState, veilOrigin, goLegacy } = useLegacyVeil()

onMounted(() => {
  soc.mount()
  dock.mount()
})

onBeforeUnmount(() => {
  soc.destroy()
  dock.destroy()
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
  display: inline-flex;
  align-items: center;
}
.social-bg-row {
  display: flex;
  align-items: center;
  gap: 12px;
  pointer-events: none;
}
/* 图标层:绝对定位盖在背景层之上,自身可飞入/停靠;背景层不跟随 */
.social-row {
  --soc-merge: 0;
  --soc-pack-w: 100%;
  --soc-bg-o: 1;
  --soc-bg-blur: 0px;
  --soc-bg-scale: 1;
  position: absolute;
  left: 0;
  top: 0;
  display: flex;
  align-items: center;
  gap: 12px; /* 与 SOCIAL_GAP 同步;合并用子项 translateX,不动画此值 */
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
  transform: scale(var(--soc-bg-scale));
  transform-origin: center left;
  z-index: 0;
  pointer-events: none;
}
.social-icon,
.legacy-link {
  --soc-fg-dim: 0;
  position: relative;
  z-index: 1;
  background: transparent !important;
  color: color-mix(in srgb, var(--text) calc((1 - var(--soc-fg-dim)) * 100%), var(--text-dim));
}
.social-bg {
  width: 48px;
  height: 48px;
  border-radius: var(--radius);
  background: var(--bg-2);
  flex: 0 0 auto;
  transition: background var(--dur) var(--ease);
}
.social-bg-wide {
  width: 94px; /* 与 legacy-link 同宽 */
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
  justify-content: center;
  gap: 8px;
  width: 94px;
  height: 48px;
  padding: 0;
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
