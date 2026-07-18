import { onMounted, onUnmounted } from 'vue'

/**
 * 滚动入场:为所有匹配 selector 的元素在进入视口时加 .is-visible。
 * .reveal-after-boot 由开屏 handoff 结束后由 main.js 级联点亮,这里跳过。
 */
export function useReveal(selector = '.reveal', options = {}) {
  let observer = null

  onMounted(() => {
    const els = Array.from(document.querySelectorAll(selector)).filter(
      (el) => !el.classList.contains('reveal-after-boot'),
    )
    if (!els.length) return

    if (!('IntersectionObserver' in window)) {
      els.forEach((el) => el.classList.add('is-visible'))
      return
    }

    observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-visible')
            observer.unobserve(entry.target)
          }
        })
      },
      { threshold: 0.12, rootMargin: '0px 0px -8% 0px', ...options },
    )

    els.forEach((el) => observer.observe(el))
  })

  onUnmounted(() => observer && observer.disconnect())
}
