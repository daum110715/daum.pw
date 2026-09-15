/* ============================================================
 * 共享收尾:揭示 Hero 标题 + 级联 reveal-after-boot + 还原滚动。
 * 挂 window.__finishBoot 供 index.html 4.5s 兜底复用。
 * ============================================================ */
import { bootDone } from '@/composables/brandDock'
import { bootResumeY, restoreScrollAfterBoot } from './scrollLock'
import { revealToggle } from './toggleMorph'

/**
 * 主题切换按钮(.theme-floating)不在此级联:正常路径由进度条变形归位后 revealToggle 点亮。
 * opts.resume: 非首页刷新——保持 handoff-pending,还原 scroll 并按进度停靠后再亮标题。
 * 返回 Promise(restore/sync 完成),首页路径立即 resolve。
 */
export function finishBoot(
  heroTitle: Element | null,
  opts: { resume?: boolean; skipSocial?: boolean; hold?: Promise<unknown> } = {},
) {
  document.documentElement.classList.add('boot-done')
  document.body.setAttribute('aria-busy', 'false')
  bootDone.value = true /* 放行 PagePager(防透过透明 preloader 抢跑) */
  const resume = !!(opts.resume || bootResumeY > 1)
  if (heroTitle && !resume) {
    heroTitle.classList.remove('handoff-pending')
    heroTitle.classList.add('is-landed')
  }
  document
    .querySelectorAll('.reveal-after-boot:not(.is-visible):not(.theme-floating)')
    .forEach((node, i) => {
      /* veil 路径:社交胶囊由假块分裂到位后手动点亮,不走通用级联 */
      if (opts.skipSocial && node.classList.contains('hero-social')) return
      window.setTimeout(() => node.classList.add('is-visible'), 80 + i * 90)
    })
  return restoreScrollAfterBoot({ landTitle: resume, hold: opts.hold })
}

window.__finishBoot = function () {
  finishBoot(document.querySelector('.hero-title'))
  revealToggle()
}
