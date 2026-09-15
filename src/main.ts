import { createApp } from 'vue'
import App from './App.vue'
import './styles/neu.css'
import './plugins/icons'
import { initBootScroll, lockBootScroll } from './boot/scrollLock'
import { initLegacyVeil } from './boot/legacyVeil'
import { syncInk, killPreloader, assertBrandSync } from './boot/domFx'
import { runProgressFill, revealToggle } from './boot/toggleMorph'
import { finishBoot } from './boot/finishBoot'
import { handoff } from './boot/handoff'
import { reduced, wait, DRAW_MS, HOLD_MS } from './boot/timing'

/* 非首页刷新:scrollRestoration=manual + sessionStorage 兜底 + boot 全程锁顶,
   防自动滚位让 Hero 离屏、ST 直接 progress=1 钉停靠(根因详见 scrollLock.ts) */
initBootScroll()

createApp(App).mount('#app')
/* 挂载后文档变高,再钉一次顶,避免测量/ST 建在中段 */
lockBootScroll()

/* 旧版回流虹膜揭示(reduced 直接揭盖;bfcache 恢复按会话标记补开) */
initLegacyVeil()

/* boot */
syncInk()
assertBrandSync()
const bootFill = document.querySelector<HTMLElement>('.preloader__progress-fill')
const bootCatch = () => {
  document.querySelectorAll('.pl-fly-svg').forEach((n) => n.remove())
  document.querySelectorAll('.boot-veil, .boot-veil-piece').forEach((n) => n.remove())
  document.querySelectorAll('body > .preloader__progress, body > .preloader__progress-fill').forEach((n) => n.remove())
  killPreloader(document.getElementById('preloader'))
  /* 不 skipSocial:veil 中断时社交胶囊回退通用级联,HeroSection 观察兜底播显现 */
  finishBoot(document.querySelector('.hero-title'))
  revealToggle()
}
if (reduced) {
  if (bootFill) {
    bootFill.style.transition = 'none'
    bootFill.style.width = '100%'
  }
  wait(0).then(handoff).catch(bootCatch)
} else {
  // 等:字体 + 描边窗 + 进度条真正 transition 到 100% → 停顿 0.5s → 再飞/变形
  Promise.all([
    Promise.race([(document.fonts && document.fonts.ready) || Promise.resolve(), wait(2000)]),
    wait(DRAW_MS),
    runProgressFill(bootFill),
  ])
    .then(async () => {
      await wait(HOLD_MS)
      return handoff()
    })
    .catch(bootCatch)
}
