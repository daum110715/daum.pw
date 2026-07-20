<template>
  <button
    class="theme-toggle"
    :aria-label="`切换到${theme === 'dark' ? '亮色' : '暗色'}主题`"
    :aria-pressed="theme === 'dark'"
    @click="toggleWithTransition"
  >
    <span class="track">
      <span class="thumb-lift"><span class="thumb" :data-pos="theme" /></span>
    </span>
  </button>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useTheme } from '@/composables/useTheme'

const { theme, toggle, set } = useTheme()
const reducedMotion = ref(false)

onMounted(() => {
  reducedMotion.value = window.matchMedia('(prefers-reduced-motion: reduce)').matches
})

let curtainBusy = false
let activeVt = null
let curtainCleanup = null

// 切后台时 VT 动画暂停、伪元素快照滞留会盖住真按钮(返回后按钮"消失");
// 隐藏瞬间跳到终态并立即清理,忙锁绝不带到前台
document.addEventListener('visibilitychange', () => {
  if (!document.hidden || !activeVt) return
  try {
    activeVt.skipTransition()
  } catch (e) {}
  if (curtainCleanup) curtainCleanup()
})

function toggleWithTransition() {
  const next = theme.value === 'dark' ? 'light' : 'dark'
  if (reducedMotion.value || !document.startViewTransition) {
    toggle()
    return
  }
  // 忙锁兜底:无活动 VT 的残留锁直接作废
  if (curtainBusy && !activeVt) curtainBusy = false
  if (curtainBusy) return
  curtainBusy = true

  // 帘形遮罩:遮罩内是新主题快照,遮罩外仍是旧页。运动由 JS 烘焙的
  // 24 帧弹簧关键帧驱动(帧间线性插值,无速度突变),方向跟 thumb:
  // dark 从左向右拉 / light 镜像
  const styleEl = document.createElement('style')
  styleEl.textContent = bakeCurtainKeyframes(next === 'dark')
  document.head.appendChild(styleEl)

  // 圆点(.thumb-lift 包裹)带独立 view-transition-name(neu.css),不进根
  // 快照:实时浮在帘上,thumb 从点击瞬间起滑;胶囊背景留在根快照随帘
  // 揭示——若整个按钮等帘边扫到才动,浅色模式(帘从左来、按钮在右上)
  // 揭示时位移已过大半,看起来"按钮没动画"
  const cleanup = () => {
    if (!curtainBusy) return
    curtainBusy = false
    activeVt = null
    curtainCleanup = null
    styleEl.remove()
  }
  curtainCleanup = cleanup
  try {
    const vt = document.startViewTransition(() => {
      document.documentElement.setAttribute('data-theme', next)
      set(next)
    })
    activeVt = vt
    vt.finished.then(cleanup).catch(cleanup)
  } catch (e) {
    cleanup()
    toggle()
    return
  }
  setTimeout(cleanup, 3000)
}

/* 烘焙 24 帧帘形关键帧:顶部单段 easeInOut 一拉到底(0→118%,无减速
   爬行);底部滞后量先 smoothstep 涨到 14%,t=0.5 释放后按临界阻尼曲线
   冲向 -8(底部靠惯性甩过顶部,帘边离场瞬间向前过摆);弧形边 21 点
   采样,滞后量按 (y/100)² 分布——上挺下荡。可见区 = 前缘以左(pullRight) */
function bakeCurtainKeyframes(pullRight) {
  const FRAMES = 24
  const ys = []
  for (let y = 0; y <= 100; y += 5) ys.push(y)
  const smoothstep = (u) => u * u * (3 - 2 * u)
  const easeInOutCubic = (u) => (u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2)
  const topAt = (t) => 118 * easeInOutCubic(t)
  const lagAt = (t) => {
    if (t < 0.5) return 14 * smoothstep(t / 0.5)
    const u = (t - 0.5) / 0.5
    return -8 + 22 * (1 + 5 * u) * Math.exp(-5 * u)
  }
  const blocks = []
  for (let i = 0; i < FRAMES; i++) {
    const t = i / (FRAMES - 1)
    const top = topAt(t)
    const lag = lagAt(t)
    const pts = ys.map((y) => {
      const x = top - lag * Math.pow(y / 100, 2)
      return `${(pullRight ? x : 100 - x).toFixed(2)}% ${y}%`
    })
    const poly = pullRight
      ? `polygon(${['0% 0%', ...pts, '0% 100%'].join(',')})`
      : `polygon(${['100% 0%', ...pts, '100% 100%'].join(',')})`
    blocks.push(`${(t * 100).toFixed(2)}% { clip-path: ${poly}; }`)
  }
  return `@keyframes theme-curtain-mask-baked { ${blocks.join(' ')} }`
}
</script>

<style scoped>
.theme-toggle {
  display: inline-flex;
  align-items: center;
  padding: 0;
  background: transparent;
}
/* ---- 纯扁平,与 preloader 进度条 → 按钮变形动画同款观感:
   轨道纯色 --bg-2 无描边,圆点纯色 --accent(变形假层用的就是这两个值,
   main.js morphBarToToggle 收尾按这里的计算背景同步,假层/真按钮零色差) ---- */
.track {
  position: relative;
  width: 64px;
  height: 32px;
  border-radius: var(--radius-full);
  background: var(--bg-2);
  overflow: hidden;
  transition: background var(--dur) var(--ease);
}
/* 无变换包裹层:view-transition-name 挂在这(neu.css),不带进根快照,
   圆点实时浮在帘上;translateX 留在内层 .thumb 上,避免与 VT 组矩阵叠加 */
.thumb-lift {
  position: absolute;
  top: 3px;
  left: 3px;
  width: 26px;
  height: 26px;
}
/* 圆点纯色 --accent,与进度条填充同色(变形动画的视觉来源) */
.thumb {
  display: block;
  width: 26px;
  height: 26px;
  border-radius: var(--radius-full);
  background: var(--accent);
  transform: translateX(0);
  /* 时长与帘形幕布(theme-curtain-*,0.9s,neu.css)平齐:圆点与幕布同起同落 */
  transition:
    transform 0.9s cubic-bezier(0.34, 1.35, 0.4, 1),
    background var(--dur) var(--ease);
}
.thumb[data-pos='dark'] {
  transform: translateX(30px);
}

@media (prefers-reduced-motion: reduce) {
  .thumb {
    transition: none;
  }
}
</style>
