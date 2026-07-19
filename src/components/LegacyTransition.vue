<template>
  <Teleport to="body">
    <div
      class="legacy-stage"
      :class="`is-${phase}`"
      :aria-hidden="phase === 'idle' ? 'true' : undefined"
    >
      <iframe
        ref="iframeEl"
        class="legacy-iframe"
        :src="iframeSrc"
        title="daum.pw 旧版站点"
        @load="onIframeLoad"
      />

      <!-- morphing path:箭头(rotate-ccw) <-> 尾线 <-> 箭头,flubber 自动插值 -->
      <svg
        v-if="phase !== 'idle'"
        class="legacy-fly-icon"
        :style="iconStyle"
        viewBox="0 0 24 24"
        aria-hidden="true"
      >
        <path :d="morphD" class="legacy-fly-path" />
      </svg>

      <button v-if="phase === 'done'" class="legacy-back" type="button" @click="exit($event)">
        <span>返回新版</span>
      </button>
    </div>
  </Teleport>
</template>

<script setup>
import { ref, onMounted, onUnmounted, nextTick } from 'vue'
import { interpolate } from 'flubber'

const emit = defineEmits(['fading'])

const reduced =
  typeof window !== 'undefined' &&
  window.matchMedia &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches

// 返回按钮图标位中心(fly-icon width 40 -> 左上偏 20)
const RETURN_CENTER = { x: 46, y: 42 }
const FLY_SIZE = 40

// 箭头 path:rotate-ccw 精确(含 A 命令弧),绝对坐标,合并单 path
const ARROW = 'M3 12 A9 9 0 1 0 12 3 A9.75 9.75 0 0 0 5.26 5.74 L3 8 M3 3 L3 8 L8 8'
// 尾线 path:24x24 内弧线(代表拖尾线条形态),flubber 自动与 ARROW 插值
const TRAIL = 'M3 12 Q12 0 21 12'

// flubber 预建插值器(自动采样 A 命令,不同节点可插值)
const toTrail = interpolate(ARROW, TRAIL)
const toArrow = interpolate(TRAIL, ARROW)

const phase = ref('idle')
const iframeSrc = ref('')
const iconStyle = ref({})
const morphD = ref(ARROW)
const iframeEl = ref(null)

let savedOverflow = ''
let loadResolver = null
let loadDone = false
let rafId = 0

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

function lerp(a, b, t) {
  return a + (b - a) * t
}

function easeOut(t) {
  return 1 - Math.pow(1 - t, 3)
}

/** morphing + 位移:rAF 驱动,箭头(起点) -> 尾线 -> 箭头(终点) */
function runMorph(sx, sy, ex, ey, duration) {
  return new Promise((resolve) => {
    if (rafId) cancelAnimationFrame(rafId)
    const start = performance.now()
    function frame(now) {
      const p = Math.min(1, (now - start) / duration)
      const t = easeOut(p)
      const d = p < 0.5 ? toTrail(p * 2) : toArrow((p - 0.5) * 2)
      morphD.value = d
      const x = lerp(sx, ex, t) - FLY_SIZE / 2
      const y = lerp(sy, ey, t) - FLY_SIZE / 2
      iconStyle.value = { transform: `translate(${x}px, ${y}px)`, opacity: '1' }
      if (p < 1) {
        rafId = requestAnimationFrame(frame)
      } else {
        morphD.value = ARROW
        rafId = 0
        resolve()
      }
    }
    rafId = requestAnimationFrame(frame)
  })
}

async function enter(rect) {
  if (phase.value !== 'idle') return
  savedOverflow = document.body.style.overflow
  document.body.style.overflow = 'hidden'
  if (!iframeSrc.value) iframeSrc.value = './legacy/'

  const sx = rect.left + rect.width / 2
  const sy = rect.top + rect.height / 2
  const ex = RETURN_CENTER.x
  const ey = RETURN_CENTER.y

  if (reduced || document.hidden) {
    phase.value = 'loading'
    emit('fading', true)
    await waitForLoad()
    morphD.value = ARROW
    iconStyle.value = { transform: `translate(${ex - FLY_SIZE / 2}px, ${ey - FLY_SIZE / 2}px)` }
    phase.value = 'done'
    return
  }

  phase.value = 'enter'
  emit('fading', true)
  await nextTick()
  await nextFrame()

  phase.value = 'cover'
  await Promise.all([runMorph(sx, sy, ex, ey, 800), waitForLoad()])

  phase.value = 'done'
}

async function exit(event) {
  if (phase.value !== 'done') return
  const btn = event && event.currentTarget
  const btnRect = btn && btn.getBoundingClientRect()
  const sx = btnRect ? btnRect.left + btnRect.width / 2 : RETURN_CENTER.x
  const sy = btnRect ? btnRect.top + btnRect.height / 2 : RETURN_CENTER.y
  const link = document.querySelector('.legacy-link')
  const linkSvg = link && link.querySelector('svg')
  const linkRect = linkSvg
    ? linkSvg.getBoundingClientRect()
    : link
      ? link.getBoundingClientRect()
      : null
  const ex = linkRect ? linkRect.left + linkRect.width / 2 : window.innerWidth / 2
  const ey = linkRect ? linkRect.top + linkRect.height / 2 : window.innerHeight / 2

  phase.value = 'returning'
  emit('fading', false)
  await nextTick()
  await nextFrame()

  await runMorph(sx, sy, ex, ey, 800)

  reset()
}

function reset() {
  phase.value = 'idle'
  iconStyle.value = {}
  morphD.value = ARROW
  document.body.style.overflow = savedOverflow
}

function onKey(e) {
  if (e.key === 'Escape' && phase.value === 'done') exit()
}

onMounted(() => {
  window.addEventListener('keydown', onKey)
  window.setTimeout(() => {
    if (phase.value === 'idle' && !iframeSrc.value) iframeSrc.value = './legacy/'
  }, 3000)
})
onUnmounted(() => {
  window.removeEventListener('keydown', onKey)
  if (rafId) cancelAnimationFrame(rafId)
})

defineExpose({ enter })
</script>

<style scoped>
.legacy-stage {
  position: fixed;
  inset: 0;
  z-index: 10000;
  pointer-events: none;
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
  transition: opacity 0.6s var(--ease);
}
.legacy-stage.is-enter .legacy-iframe,
.legacy-stage.is-cover .legacy-iframe,
.legacy-stage.is-reveal .legacy-iframe,
.legacy-stage.is-done .legacy-iframe {
  opacity: 1;
}
.legacy-fly-icon {
  position: fixed;
  z-index: 6;
  width: 40px;
  height: 40px;
  overflow: visible;
  pointer-events: none;
  will-change: transform;
}
.legacy-fly-path {
  fill: none;
  stroke: var(--accent);
  stroke-width: 2;
  stroke-linecap: round;
  stroke-linejoin: round;
  transform-origin: 50% 50%;
}
.legacy-stage.is-done .legacy-fly-path {
  animation: legacy-spin 1.1s linear infinite;
}
@keyframes legacy-spin {
  to {
    transform: rotate(-360deg);
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
  height: 48px;
  padding: 0 18px 0 46px;
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
  .legacy-stage.is-done .legacy-fly-path {
    animation: none;
  }
}
</style>
