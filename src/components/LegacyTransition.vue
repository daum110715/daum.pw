<template>
  <Teleport to="body">
    <div
      class="legacy-stage"
      :class="`is-${phase}`"
      :aria-hidden="phase === 'idle' ? 'true' : undefined"
    >
      <!-- 旧版 iframe:常驻预加载,过渡时与新版 main opacity 交叉(无遮罩、无 scale 模糊) -->
      <iframe
        ref="iframeEl"
        class="legacy-iframe"
        :src="iframeSrc"
        title="daum.pw 旧版站点"
        @load="onIframeLoad"
      />

      <!-- 品牌字 daum12569 SVG:描边填实(复刻开屏 pl-draw),过渡视觉锚点 -->
      <svg
        v-if="phase === 'enter' || phase === 'cover' || phase === 'reveal'"
        class="legacy-brand"
        :viewBox="BRAND_VIEWBOX"
        aria-hidden="true"
        xmlns="http://www.w3.org/2000/svg"
      >
        <g :transform="BRAND_GROUP_TRANSFORM">
          <path
            v-for="(p, i) in BRAND_PATHS"
            :key="i"
            class="legacy-brand-path"
            :d="p.d"
            :style="{ '--i': i }"
            pathLength="1"
          />
        </g>
      </svg>

      <!-- 克隆自按钮的图标:旋转放大飞向屏幕中心,自身持续 spin -->
      <span
        v-if="phase === 'enter' || phase === 'cover' || phase === 'reveal'"
        ref="flyIconEl"
        class="legacy-fly-icon"
        :style="iconStyle"
      >
        <Icon icon="lucide:history" class="legacy-spin" width="100%" height="100%" />
      </span>

      <!-- 返回新版 -->
      <button v-if="phase === 'done'" class="legacy-back" type="button" @click="exit">
        <Icon icon="lucide:arrow-left" width="18" height="18" />
        <span>返回新版</span>
      </button>
    </div>
  </Teleport>
</template>

<script setup>
import { ref, onMounted, onUnmounted, nextTick } from 'vue'
import { Icon } from '@iconify/vue'
import { BRAND_PATHS, BRAND_VIEWBOX, BRAND_GROUP_TRANSFORM } from '@/data/brandGlyph'

const emit = defineEmits(['fading'])

// 与 main.js 开屏动画同源回弹缓动
const EASE = 'cubic-bezier(0.22, 1, 0.36, 1)'
const reduced =
  typeof window !== 'undefined' &&
  window.matchMedia &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches

// idle -> enter -> cover -> reveal -> done -> closing -> idle
const phase = ref('idle')
const iframeSrc = ref('')
const iconStyle = ref({})
const iframeEl = ref(null)
const flyIconEl = ref(null)

let savedOverflow = ''
let loadResolver = null
let loadDone = false

/** 下一帧:rAF 为主,setTimeout 兜底 */
function nextFrame() {
  return new Promise((r) => {
    let done = false
    const fin = () => {
      if (done) return
      done = true
      r()
    }
    requestAnimationFrame(fin)
    window.setTimeout(fin, 50)
  })
}

/** transitionend + setTimeout 双保险(同 main.js onTransformEnd) */
function onTransitionEnd(el, prop, timeout) {
  return new Promise((resolve) => {
    if (!el) return resolve()
    let done = false
    const fin = () => {
      if (done) return
      done = true
      el.removeEventListener('transitionend', onEnd)
      resolve()
    }
    const onEnd = (e) => {
      if (e.target === el && e.propertyName === prop) fin()
    }
    el.addEventListener('transitionend', onEnd)
    window.setTimeout(fin, timeout)
  })
}

function onIframeLoad() {
  loadDone = true
  if (loadResolver) {
    const r = loadResolver
    loadResolver = null
    r()
  }
}

function waitForLoad(timeout = 8000) {
  if (loadDone) return Promise.resolve()
  return new Promise((resolve) => {
    loadResolver = resolve
    window.setTimeout(() => {
      if (loadResolver === resolve) {
        loadResolver = null
        resolve()
      }
    }, timeout)
  })
}

async function enter(rect) {
  if (phase.value !== 'idle') return
  savedOverflow = document.body.style.overflow
  document.body.style.overflow = 'hidden'
  if (!iframeSrc.value) iframeSrc.value = './legacy/'

  if (reduced || document.hidden) {
    phase.value = 'loading'
    emit('fading', true)
    await waitForLoad()
    phase.value = 'done'
    return
  }

  // 图标克隆到按钮位
  iconStyle.value = {
    left: rect.left + 'px',
    top: rect.top + 'px',
    width: rect.width + 'px',
    height: rect.height + 'px',
    transform: 'translate(0px, 0px) scale(1)',
    opacity: '1',
    transition: 'none',
  }
  // 同步触发:品牌字描边填实 + 图标旋转放大飞中间 + main/iframe opacity 交叉(无遮罩)
  phase.value = 'enter'
  emit('fading', true) // main 淡出
  await nextTick()
  await nextFrame()

  // 图标旋转放大飞向屏幕中心(与品牌字叠加,自身持续 spin)
  const vw = window.innerWidth
  const vh = window.innerHeight
  const target = Math.min(vw, vh) * 0.12
  const tx = vw / 2 - target / 2 - rect.left
  const ty = vh / 2 - target / 2 - rect.top
  const scale = rect.width > 0 ? target / rect.width : 1
  iconStyle.value = {
    left: rect.left + 'px',
    top: rect.top + 'px',
    width: rect.width + 'px',
    height: rect.height + 'px',
    transform: `translate(${tx}px, ${ty}px) scale(${scale})`,
    opacity: '1',
    transition: `transform 0.5s ${EASE}`,
  }
  phase.value = 'cover'

  // 图标飞到位 与 iframe 加载(预加载下即时) 并行;品牌字描边填实同步进行
  await Promise.all([
    onTransitionEnd(flyIconEl.value, 'transform', 600),
    waitForLoad(),
  ])

  // reveal:品牌字 + 图标淡出,等 iframe 淡入完
  phase.value = 'reveal'
  iconStyle.value = { ...iconStyle.value, opacity: '0', transition: 'opacity 0.4s var(--ease)' }
  await Promise.all([
    onTransitionEnd(flyIconEl.value, 'opacity', 500),
    onTransitionEnd(iframeEl.value, 'opacity', 700),
  ])

  phase.value = 'done'
}

function exit() {
  if (phase.value === 'idle' || phase.value === 'closing') return
  phase.value = 'closing'
  emit('fading', false) // main 淡入恢复
  window.setTimeout(() => {
    reset()
  }, 420)
}

function reset() {
  phase.value = 'idle'
  iconStyle.value = {}
  document.body.style.overflow = savedOverflow
  // iframe src 与 loadDone 保留:下次 enter 即时(已预加载)
}

function onKey(e) {
  if (e.key === 'Escape' && phase.value === 'done') exit()
}

onMounted(() => {
  window.addEventListener('keydown', onKey)
  // 开屏结束后预加载旧版(避免与 preloader 抢带宽);idle 隐藏不挡新版
  window.setTimeout(() => {
    if (phase.value === 'idle' && !iframeSrc.value) iframeSrc.value = './legacy/'
  }, 3000)
})
onUnmounted(() => window.removeEventListener('keydown', onKey))

defineExpose({ enter })
</script>

<style scoped>
.legacy-stage {
  position: fixed;
  inset: 0;
  z-index: 10000;
  pointer-events: none; /* idle 不挡新版交互 */
}
.legacy-stage:not(.is-idle) {
  pointer-events: auto;
}
.legacy-iframe {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  border: 0;
  background: var(--bg);
  opacity: 0;
  transition: opacity 0.6s var(--ease); /* 纯 opacity 交叉,无 scale(避免 iframe 位图缩放模糊) */
}
.legacy-stage.is-enter .legacy-iframe,
.legacy-stage.is-cover .legacy-iframe,
.legacy-stage.is-reveal .legacy-iframe,
.legacy-stage.is-done .legacy-iframe {
  opacity: 1;
}
/* 品牌字 SVG:屏幕中心,描边填实(复刻 index.html pl-draw),reveal 时淡出 */
.legacy-brand {
  position: fixed;
  z-index: 3;
  left: 50%;
  top: 50%;
  height: clamp(2rem, 8vw, 4rem);
  width: auto;
  transform: translate(-50%, -50%);
  overflow: visible;
  pointer-events: none;
  transition: opacity 0.4s var(--ease);
}
.legacy-stage.is-reveal .legacy-brand {
  opacity: 0;
}
.legacy-brand-path {
  fill: var(--brand-ink);
  fill-opacity: 0;
  stroke: color-mix(in srgb, var(--accent) 55%, white);
  stroke-width: 40;
  stroke-linecap: round;
  stroke-linejoin: round;
  stroke-dasharray: 1;
  stroke-dashoffset: 1;
  animation: legacy-brand-draw 0.5s var(--ease) forwards;
  animation-delay: calc(var(--i) * 0.05s);
}
@keyframes legacy-brand-draw {
  0% {
    stroke-dashoffset: 1;
    fill-opacity: 0;
    stroke-width: 40;
  }
  72% {
    stroke-dashoffset: 0;
    fill-opacity: 0;
    stroke-width: 40;
  }
  100% {
    stroke-dashoffset: 0;
    fill-opacity: 1;
    stroke-width: 0;
  }
}
.legacy-fly-icon {
  position: fixed;
  z-index: 4; /* 图标在品牌字之上,叠加旋转 */
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: var(--accent);
  pointer-events: none;
  will-change: transform, opacity;
}
.legacy-fly-icon :deep(svg) {
  width: 100%;
  height: 100%;
}
/* 外层 fly-icon 管 translate+scale,内层 svg 管 spin,两层 transform 互不干扰 */
.legacy-fly-icon :deep(.legacy-spin) {
  animation: legacy-spin 1.1s linear infinite;
  transform-origin: 50% 50%;
}
@keyframes legacy-spin {
  to {
    transform: rotate(360deg);
  }
}
.legacy-back {
  position: fixed;
  top: 18px;
  left: 18px;
  z-index: 5;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  height: 44px;
  padding: 0 16px;
  border-radius: var(--radius);
  background: var(--bg-2);
  color: var(--accent-text);
  font-family: var(--font-display);
  font-weight: 600;
  font-size: 14px;
  box-shadow: 0 6px 20px rgba(0, 0, 0, 0.2);
  transition:
    transform var(--dur) var(--ease),
    background var(--dur) var(--ease);
}
.legacy-back:hover {
  transform: translateY(-2px);
  background: var(--accent-soft);
}
.legacy-stage.is-closing {
  opacity: 0;
  transition: opacity 0.4s var(--ease);
}
@media (prefers-reduced-motion: reduce) {
  .legacy-stage.is-closing {
    transition: none;
  }
  .legacy-brand-path {
    animation: none;
    stroke-dashoffset: 0;
    fill-opacity: 1;
    stroke-width: 0;
  }
  .legacy-fly-icon :deep(.legacy-spin) {
    animation: none;
  }
}
</style>
