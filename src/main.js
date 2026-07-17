import { createApp } from 'vue'
import App from './App.vue'
import './styles/neu.css'
import './plugins/icons.js'

createApp(App).mount('#app')

// 隐藏首屏 preloader:Vue 挂载完成 + 字体就绪(或超时兜底)+ 最小展示时间后,平滑淡出并移除
function hidePreloader() {
  const el = document.getElementById('preloader')
  if (!el || el.dataset.done === '1') return
  el.dataset.done = '1'
  el.classList.add('is-done')
  el.setAttribute('aria-hidden', 'true')
  document.body.setAttribute('aria-busy', 'false')
  let timer
  const remove = () => {
    clearTimeout(timer)
    if (el.parentNode) el.parentNode.removeChild(el)
  }
  el.addEventListener('transitionend', remove, { once: true })
  timer = window.setTimeout(remove, 900) // 兜底:transitionend 未触发也移除
}

const prefersReduced =
  window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches
const fontReady = (document.fonts && document.fonts.ready) || Promise.resolve()
const cap = prefersReduced ? 600 : 2000
const minDisplay = prefersReduced ? 0 : 1500 // 最小展示时间,让逐字描边书写动画完成后再淡出
Promise.all([
  Promise.race([fontReady, new Promise((r) => setTimeout(r, cap))]),
  new Promise((r) => setTimeout(r, minDisplay)),
]).then(hidePreloader)
