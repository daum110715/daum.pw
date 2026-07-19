<template>
  <Teleport to="body">
    <div
      v-if="active"
      class="legacy-stage"
      :class="`is-${phase}`"
      :aria-hidden="phase === 'idle' ? 'true' : undefined"
    >
      <!-- 旧版 iframe:全屏,平滑淡入(与新版 main 淡出交叉,无遮罩) -->
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

defineProps({ active: Boolean })
const emit = defineEmits(['exit', 'fading'])

// 与 main.js 开屏动画同源回弹缓动
const EASE = 'cubic-bezier(0.22, 1, 0.36, 1)'
const reduced =
  typeof window !== 'undefined' &&
  window.matchMedia &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches

// idle -> enter -> cover -> reveal -> done -> closing -> idle
// (reduced/后台: idle -> loading -> done)
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
  loadDone = false
  iframeSrc.value = './legacy/'

  // reduced-motion / 后台标签页:跳过动画,等加载后直接呈现
  if (reduced || document.hidden) {
    phase.value = 'loading'
    emit('fading', true)
    await waitForLoad()
    phase.value = 'done'
    return
  }

  // 图标克隆到按钮位,旋转放大飞向屏幕中心(自身持续 spin)
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

  // 图标飞到位 与 iframe 加载 并行,都完成才交叉过渡
  await Promise.all([
    onTransitionEnd(flyIconEl.value, 'transform', 600),
    waitForLoad(),
  ])

  // reveal:通知新版 main 淡出 + 旧版 iframe 平滑淡入 + 图标淡出(三者同步交叉,无遮罩)
  phase.value = 'reveal'
  emit('fading', true)
  iconStyle.value = { ...iconStyle.value, opacity: '0', transition: 'opacity 0.5s var(--ease)' }
  await nextTick()
  await onTransitionEnd(iframeEl.value, 'opacity', 700)

  phase.value = 'done'
}

function exit() {
  if (phase.value === 'idle' || phase.value === 'closing') return
  phase.value = 'closing'
  emit('fading', false) // 新版 main 同步淡入恢复
  window.setTimeout(() => {
    reset()
    emit('exit')
  }, 420)
}

function reset() {
  phase.value = 'idle'
  iframeSrc.value = ''
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
  /* 透明:不遮新版,让新版 main 淡出 + 旧版 iframe 淡入交叉过渡(无遮罩) */
}
.legacy-iframe {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  border: 0;
  background: var(--bg);
  opacity: 0;
  transition: opacity 0.6s var(--ease);
}
.legacy-stage.is-reveal .legacy-iframe,
.legacy-stage.is-done .legacy-iframe {
  opacity: 1;
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
  .legacy-fly-icon :deep(.legacy-spin) {
    animation: none;
  }
}
</style>
