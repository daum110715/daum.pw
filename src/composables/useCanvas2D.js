import { onMounted, onBeforeUnmount } from 'vue'

/**
 * Canvas 2D 程序化动画基座:任何复杂 2D 动画(粒子/流场/物理/分形)
 * 只需提供一个 draw 回调,其余样板全部托管——
 *   · DPR 适配 + ResizeObserver 尺寸跟随(canvas 以 CSS 尺寸为准,内部按 dpr 放大)
 *   · rAF 主循环,回调拿到 { ctx, w, h, t, dt, frame }(t 为启动以来秒数)
 *   · fps 上限节流(默认 60,低端机可降 30)
 *   · prefers-reduced-motion:只画一帧静态画面,不起循环
 *   · 标签页隐藏时暂停,回来续播(t 不因暂停而跳变)
 *   · IntersectionObserver:滚出视口自动暂停(可选,默认开)
 * 卸载时全部清理,无泄漏。
 *
 * 用法:
 *   const canvasRef = ref(null)
 *   useCanvas2D(canvasRef, ({ ctx, w, h, t, dt }) => { ... })
 *
 * 返回 { start, stop, resize, running } 供需要手动控制的场景(如滚到才播)。
 */
export function useCanvas2D(canvasRef, draw, options = {}) {
  const {
    maxDpr = 2, // DPR 上限:高分屏全 dpr 会让填充率爆炸,2 足够锐利
    fps = 60,
    pauseOffscreen = true,
  } = options

  let ctx = null
  let rafId = 0
  let resizeObserver = null
  let io = null
  let startTime = 0 // 累计已播时长对应的 performance 基准
  let accPaused = 0 // 暂停累计时长,t = (now - startTime - accPaused)/1000
  let pauseStamp = 0
  let lastFrame = 0
  let frameCount = 0
  let w = 0
  let h = 0
  let running = false
  let visible = true
  let inView = true
  const frameInterval = 1000 / fps
  let reducedMotion = false

  function resize() {
    const canvas = canvasRef.value
    if (!canvas || !ctx) return
    const rect = canvas.getBoundingClientRect()
    if (rect.width === 0 || rect.height === 0) return
    const dpr = Math.min(window.devicePixelRatio || 1, maxDpr)
    /* 仅尺寸变化才重设宽高(重设会清空画布,trail 类动画会被打断) */
    const pw = Math.round(rect.width * dpr)
    const ph = Math.round(rect.height * dpr)
    if (canvas.width !== pw || canvas.height !== ph) {
      canvas.width = pw
      canvas.height = ph
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    w = rect.width
    h = rect.height
  }

  function tick(now) {
    if (!running) return
    rafId = requestAnimationFrame(tick)
    /* fps 节流:未到间隔的帧直接跳过,rAF 链不断 */
    if (now - lastFrame < frameInterval - 0.5) return
    lastFrame = now
    const t = (now - startTime - accPaused) / 1000
    draw({ ctx, w, h, t, dt: frameInterval / 1000, frame: frameCount++ })
  }

  function start() {
    if (running || reducedMotion) return
    running = true
    if (pauseStamp) {
      accPaused += performance.now() - pauseStamp
      pauseStamp = 0
    }
    lastFrame = 0 // 复播后首帧立即画
    rafId = requestAnimationFrame(tick)
  }

  function stop() {
    running = false
    if (rafId) cancelAnimationFrame(rafId)
    rafId = 0
    if (!pauseStamp) pauseStamp = performance.now()
  }

  /* 可见性/视口任一不满足即停,都满足则播 */
  function syncPlayState() {
    if (visible && inView) start()
    else stop()
  }

  function onVisibility() {
    visible = !document.hidden
    syncPlayState()
  }

  onMounted(() => {
    const canvas = canvasRef.value
    if (!canvas) return
    ctx = canvas.getContext('2d')
    reducedMotion =
      window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches

    resize()
    resizeObserver = new ResizeObserver(resize)
    resizeObserver.observe(canvas)

    if (pauseOffscreen && 'IntersectionObserver' in window) {
      io = new IntersectionObserver(
        (entries) => {
          inView = entries[0].isIntersecting
          syncPlayState()
        },
        { threshold: 0.01 },
      )
      io.observe(canvas)
    }
    document.addEventListener('visibilitychange', onVisibility)

    if (reducedMotion) {
      /* 静态一帧:t=0 的画面,给动画作者一个收敛的初态 */
      draw({ ctx, w, h, t: 0, dt: 0, frame: 0 })
    } else {
      startTime = performance.now()
      start()
    }
  })

  onBeforeUnmount(() => {
    stop()
    if (resizeObserver) resizeObserver.disconnect()
    if (io) io.disconnect()
    document.removeEventListener('visibilitychange', onVisibility)
  })

  return { start, stop, resize, get running() { return running } }
}
