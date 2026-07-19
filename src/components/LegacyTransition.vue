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

      <!-- 转圈图标:在「旧版」按钮与「返回新版」按钮两地之间平滑移动,done 时停在返回按钮图标位 -->
      <span
        v-if="phase !== 'idle'"
        ref="flyIconEl"
        class="legacy-fly-icon"
        :style="iconStyle"
      >
        <Icon icon="lucide:rotate-ccw" class="legacy-spin" width="100%" height="100%" />
      </span>

      <!-- 返回新版 -->
      <button v-if="phase === 'done'" class="legacy-back" type="button" @click="exit($event)">
        <span>返回新版</span>
      </button>
    </div>
  </Teleport>
</template>

<script setup>
import { ref, onMounted, onUnmounted, nextTick } from 'vue'
import { Icon } from '@iconify/vue'

const emit = defineEmits(['fading'])

// 与 main.js 开屏动画同源回弹缓动
const EASE = 'cubic-bezier(0.22, 1, 0.36, 1)'
const reduced =
  typeof window !== 'undefined' &&
  window.matchMedia &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches

// 「返回新版」按钮图标位中心(.legacy-back top18 left18,去 arrow-left 后图标 left36 top32 -> 中心 46,42)
// enter 时该按钮尚未显示,用预设;exit 时按钮已显示,用实际 rect
const RETURN_CENTER = { x: 46, y: 42 }

// idle -> enter -> cover -> reveal -> done -> returning -> returning-out -> idle
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

/** 图标从 originRect 中心飞到 (targetX, targetY),尺寸不变(只平移+旋转) */
function flyTo(originRect, targetX, targetY) {
  const dx = targetX - (originRect.left + originRect.width / 2)
  const dy = targetY - (originRect.top + originRect.height / 2)
  return { dx, dy }
}

/** 取「旧版」按钮内图标 svg 的 rect(exit 时新版 main 已淡入,元素在 DOM) */
function getLegacyIconRect() {
  const link = document.querySelector('.legacy-link')
  const svg = link && link.querySelector('svg')
  return (svg || link || {}).getBoundingClientRect
    ? (svg || link).getBoundingClientRect()
    : null
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

  // 图标克隆到「旧版」按钮位
  iconStyle.value = {
    left: rect.left + 'px',
    top: rect.top + 'px',
    width: rect.width + 'px',
    height: rect.height + 'px',
    transform: 'translate(0px, 0px)',
    opacity: '1',
    transition: 'none',
  }
  // 同步触发:图标从旧版按钮位飞向返回按钮位 + main/iframe opacity 交叉(无遮罩)
  phase.value = 'enter'
  emit('fading', true) // main 淡出
  await nextTick()
  await nextFrame()

  const { dx, dy } = flyTo(rect, RETURN_CENTER.x, RETURN_CENTER.y)
  iconStyle.value = {
    left: rect.left + 'px',
    top: rect.top + 'px',
    width: rect.width + 'px',
    height: rect.height + 'px',
    transform: `translate(${dx}px, ${dy}px)`,
    opacity: '1',
    transition: `transform 0.5s ${EASE}`,
  }
  phase.value = 'cover'

  // 图标飞到位 与 iframe 加载(预加载下即时) 并行;品牌字描边填实同步进行
  await Promise.all([
    onTransitionEnd(flyIconEl.value, 'transform', 600),
    waitForLoad(),
  ])

  // reveal:等 iframe 淡入完(图标保持显示,停留返回按钮图标位)
  phase.value = 'reveal'
  await onTransitionEnd(iframeEl.value, 'opacity', 700)

  phase.value = 'done'
}

/** 返回新版:图标从「返回新版」按钮位飞回「旧版」按钮位(反向) */
async function exit(event) {
  if (phase.value !== 'done') return
  // origin:返回按钮内图标位(Esc 无 event,用预设返回按钮图标位)
  const backBtn = event && event.currentTarget
  const backSvg = backBtn && backBtn.querySelector('svg')
  const originRect =
    (backSvg && backSvg.getBoundingClientRect()) ||
    { left: RETURN_CENTER.x - 10, top: RETURN_CENTER.y - 10, width: 20, height: 20 }

  iconStyle.value = {
    left: originRect.left + 'px',
    top: originRect.top + 'px',
    width: originRect.width + 'px',
    height: originRect.height + 'px',
    transform: 'translate(0px, 0px)',
    opacity: '1',
    transition: 'none',
  }
  // 同步触发:图标从返回按钮位飞回旧版按钮位 + iframe 淡出/main 淡入
  phase.value = 'returning'
  emit('fading', false) // main 淡入
  await nextTick()
  await nextFrame()

  const legacyRect = getLegacyIconRect()
  const targetX = legacyRect ? legacyRect.left + legacyRect.width / 2 : window.innerWidth / 2
  const targetY = legacyRect ? legacyRect.top + legacyRect.height / 2 : window.innerHeight / 2
  const { dx, dy } = flyTo(originRect, targetX, targetY)
  iconStyle.value = {
    left: originRect.left + 'px',
    top: originRect.top + 'px',
    width: originRect.width + 'px',
    height: originRect.height + 'px',
    transform: `translate(${dx}px, ${dy}px)`,
    opacity: '1',
    transition: `transform 0.5s ${EASE}`,
  }

  // 图标飞到位 与 iframe 淡出 并行;品牌字描边填实同步
  await Promise.all([
    onTransitionEnd(flyIconEl.value, 'transform', 600),
    onTransitionEnd(iframeEl.value, 'opacity', 700),
  ])

  // returning-out:品牌字 + 图标淡出
  phase.value = 'returning-out'
  iconStyle.value = { ...iconStyle.value, opacity: '0', transition: 'opacity 0.4s var(--ease)' }
  await onTransitionEnd(flyIconEl.value, 'opacity', 500)

  reset()
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
/* 进过渡:iframe 淡入;done 全显;返回过渡(returning/returning-out):iframe 淡出(默认 opacity 0) */
.legacy-stage.is-enter .legacy-iframe,
.legacy-stage.is-cover .legacy-iframe,
.legacy-stage.is-reveal .legacy-iframe,
.legacy-stage.is-done .legacy-iframe {
  opacity: 1;
}
.legacy-fly-icon {
  position: fixed;
  z-index: 6;
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
/* 外层 fly-icon 管 translate(两地移动),内层 svg 管 spin,两层 transform 互不干扰 */
.legacy-fly-icon :deep(.legacy-spin) {
  animation: legacy-spin 1.1s linear infinite;
  transform-origin: 50% 50%;
}
@keyframes legacy-spin {
  to {
    transform: rotate(-360deg);
  }
}
/* 返回新版:与 HeroSection「旧版」入口(.legacy-link)同款风格,两个按钮对偶 */
.legacy-back {
  position: fixed;
  top: 18px;
  left: 18px;
  z-index: 5;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  height: 48px;
  padding: 0 18px 0 46px; /* 左 46 留 fly-icon 图标位(替代 arrow-left) */
  border-radius: var(--radius);
  background: var(--bg-2);
  color: var(--text);
  font-family: var(--font-display);
  font-weight: 600;
  font-size: 15px;
  white-space: nowrap;
  transition:
    color var(--dur) var(--ease),
    background var(--dur) var(--ease);
}
.legacy-back:hover {
  color: var(--accent);
  background: var(--accent-soft);
}
@media (prefers-reduced-motion: reduce) {
  .legacy-fly-icon :deep(.legacy-spin) {
    animation: none;
  }
}
</style>
