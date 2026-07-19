<template>
  <Teleport to="body">
    <div
      class="legacy-stage"
      :class="`is-${phase}`"
      :aria-hidden="phase === 'idle' ? 'true' : undefined"
    >
      <!-- 旧版 iframe:常驻预加载,过渡时与新版 main 景深交叉(无遮罩) -->
      <iframe
        ref="iframeEl"
        class="legacy-iframe"
        :src="iframeSrc"
        title="daum.pw 旧版站点"
        @load="onIframeLoad"
      />

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

/** transitionend + setTimeout 双保险 */
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
  // iframe 未预加载则立即加载(预加载下此分支不触发)
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
  // 同步触发:新版 main 淡出+缩小 与 旧版 iframe 淡入+放大(景深交叉),无遮罩、无等待
  phase.value = 'enter'
  emit('fading', true)
  await nextTick()
  await nextFrame()

  // 图标旋转放大飞向屏幕中心(自身持续 spin)
  const vw = window.innerWidth
  const vh = window.innerHeight
  const target = Math.min(vw, vh) * 0.2
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

  // 图标飞到位 与 iframe 加载(预加载下即时) 并行
  await Promise.all([
    onTransitionEnd(flyIconEl.value, 'transform', 600),
    waitForLoad(),
  ])

  // 图标淡出(旧版已显现),等 iframe 淡入完
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
  emit('fading', false) // 新版 main 淡入恢复
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
  // 开屏结束后预加载旧版(避免与 preloader 抢带宽);idle 时隐藏不挡新版
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
  transform: scale(0.94);
  transform-origin: center;
  transition: opacity 0.6s var(--ease), transform 0.6s var(--ease);
}
/* enter/cover/reveal/done:旧版平滑淡入+放大到位(与新版 main 淡出+缩小景深交叉) */
.legacy-stage.is-enter .legacy-iframe,
.legacy-stage.is-cover .legacy-iframe,
.legacy-stage.is-reveal .legacy-iframe,
.legacy-stage.is-done .legacy-iframe {
  opacity: 1;
  transform: scale(1);
}
.legacy-fly-icon {
  position: fixed;
  z-index: 3;
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
  z-index: 4;
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
  .legacy-iframe {
    transform: none !important;
    transition: opacity 0.6s var(--ease);
  }
  .legacy-fly-icon :deep(.legacy-spin) {
    animation: none;
  }
}
</style>
