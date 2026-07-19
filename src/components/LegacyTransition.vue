<template>
  <Teleport to="body">
    <div
      v-if="active"
      class="legacy-stage"
      :class="`is-${phase}`"
      :aria-hidden="phase === 'idle' ? 'true' : undefined"
    >
      <!-- 旧版 iframe(下层,幕布淡出后露出) -->
      <iframe
        ref="iframeEl"
        class="legacy-iframe"
        :src="iframeSrc"
        title="daum.pw 旧版站点"
        @load="onIframeLoad"
      />

      <!-- 幕布层:clip-path 扩散铺满,reveal 时整体淡出 -->
      <div ref="curtainEl" class="legacy-curtain" :style="curtainStyle">
        <div ref="faceEl" class="legacy-curtain-face" :style="faceStyle" />
      </div>

      <!-- 克隆自按钮的图标:放大飞向屏幕中心,自身持续 spin -->
      <span
        v-if="phase === 'enter' || phase === 'cover' || phase === 'reveal'"
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

defineProps({ active: Boolean })
const emit = defineEmits(['exit'])

// 与 main.js 开屏动画同源缓动:回弹 ease-out + smooth 无折点
const EASE = 'cubic-bezier(0.22, 1, 0.36, 1)'
const SMOOTH = 'cubic-bezier(0.45, 0.05, 0.25, 1)'
const reduced =
  typeof window !== 'undefined' &&
  window.matchMedia &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches

// idle -> enter -> cover -> reveal -> done -> closing -> idle
// (reduced/后台: idle -> loading -> done)
const phase = ref('idle')
const iframeSrc = ref('')
const curtainStyle = ref({})
const faceStyle = ref({})
const iconStyle = ref({})
const iframeEl = ref(null)
const curtainEl = ref(null)
const faceEl = ref(null)

let savedOverflow = ''
let loadResolver = null
let loadDone = false

/** 下一帧:rAF 为主,setTimeout 兜底(后台标签页 rAF 暂停仍能推进) */
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
  loadDone = false
  iframeSrc.value = './legacy/'

  // reduced-motion / 后台标签页:跳过动画,等加载后直接呈现
  if (reduced || document.hidden) {
    phase.value = 'loading'
    await waitForLoad()
    phase.value = 'done'
    return
  }

  const cx = rect.left + rect.width / 2
  const cy = rect.top + rect.height / 2

  // 初始态:幕布缩为图标位置的圆点,图标克隆至按钮图标位
  curtainStyle.value = { clipPath: `circle(0px at ${cx}px ${cy}px)`, transition: 'none' }
  faceStyle.value = { opacity: '1', transition: 'none' }
  iconStyle.value = {
    left: rect.left + 'px',
    top: rect.top + 'px',
    width: rect.width + 'px',
    height: rect.height + 'px',
    transform: 'translate(0px, 0px) scale(1)',
    opacity: '1',
    transition: 'none',
  }
  phase.value = 'enter'
  await nextTick()
  await nextFrame()

  // cover:幕布圆形扩散铺满 + 图标放大飞向屏幕中心(图标自身持续 spin)
  const vw = window.innerWidth
  const vh = window.innerHeight
  const target = Math.min(vw, vh) * 0.2
  const tx = vw / 2 - target / 2 - rect.left
  const ty = vh / 2 - target / 2 - rect.top
  const scale = rect.width > 0 ? target / rect.width : 1
  // 对角线 1.1 倍:偏心扩散(从按钮位)也能覆盖到最远角
  const coverR = Math.hypot(vw, vh) * 1.1
  curtainStyle.value = {
    clipPath: `circle(${coverR}px at ${cx}px ${cy}px)`,
    transition: `clip-path 0.5s ${SMOOTH}`,
  }
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

  // 幕布铺满 与 iframe 加载 并行,都完成才过渡
  await Promise.all([onTransitionEnd(curtainEl.value, 'clip-path', 700), waitForLoad()])

  // reveal:图标持续旋转,幕布+图标平滑淡出,露出旧版(无 3D 翻转)
  phase.value = 'reveal'
  iconStyle.value = { ...iconStyle.value, opacity: '0', transition: `opacity 0.5s ${SMOOTH}` }
  faceStyle.value = { opacity: '0', transition: 'opacity 0.6s var(--ease)' }
  await nextTick()
  await onTransitionEnd(faceEl.value, 'opacity', 700)

  phase.value = 'done'
}

function exit() {
  if (phase.value === 'idle' || phase.value === 'closing') return
  phase.value = 'closing'
  window.setTimeout(() => {
    reset()
    emit('exit')
  }, 420)
}

function reset() {
  phase.value = 'idle'
  iframeSrc.value = ''
  curtainStyle.value = {}
  faceStyle.value = {}
  iconStyle.value = {}
  document.body.style.overflow = savedOverflow
  loadDone = false
}

function onKey(e) {
  if (e.key === 'Escape' && phase.value === 'done') exit()
}
onMounted(() => window.addEventListener('keydown', onKey))
onUnmounted(() => window.removeEventListener('keydown', onKey))

defineExpose({ enter })
</script>

<style scoped>
.legacy-stage {
  position: fixed;
  inset: 0;
  z-index: 10000;
  background: var(--bg); /* iframe 淡入中间态兜底,不透到新版页面 */
}
.legacy-iframe {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  border: 0;
  background: var(--bg);
  z-index: 1;
  opacity: 0;
  transition: opacity 0.6s var(--ease);
}
/* reveal/done:旧版内容平滑淡入(与幕布淡出同步) */
.legacy-stage.is-reveal .legacy-iframe,
.legacy-stage.is-done .legacy-iframe {
  opacity: 1;
}
.legacy-curtain {
  position: absolute;
  inset: 0;
  z-index: 2;
  pointer-events: none;
}
/* 幕布背景:与 neu.css body 同款多层暖色光斑,延续当前页面背景(非纯色橙) */
.legacy-curtain-face {
  position: absolute;
  inset: 0;
  background-color: var(--bg);
  background-image:
    radial-gradient(circle at 8% 12%, rgba(216, 164, 127, 0.18) 0%, transparent 32%),
    radial-gradient(circle at 92% 8%, rgba(159, 180, 204, 0.16) 0%, transparent 28%),
    radial-gradient(circle at 50% 95%, rgba(232, 220, 200, 0.18) 0%, transparent 30%),
    radial-gradient(circle at 50% -10%, var(--bg-2), var(--bg) 55%);
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
/* 图标持续旋转:外层 fly-icon 管 translate+scale,内层 svg 管 spin,互不干扰 */
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
/* done 态幕布退场,reduced 路径 loading 不显示幕布 */
.legacy-stage.is-done .legacy-curtain {
  display: none;
}
.legacy-stage.is-loading .legacy-curtain {
  display: none;
}
.legacy-stage.is-closing {
  opacity: 0;
  transition: opacity 0.4s var(--ease);
}
@media (prefers-reduced-motion: reduce) {
  .legacy-stage.is-closing {
    transition: none;
  }
  .legacy-fly-icon :deep(.legacy-spin) {
    animation: none;
  }
}
</style>
