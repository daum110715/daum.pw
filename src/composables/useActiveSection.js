import { ref, onMounted, onUnmounted } from 'vue'

/**
 * 追踪当前可视 section id,用于导航高亮。
 * 当某 section 跨过视口中部时设为 active。
 */
export function useActiveSection(ids = []) {
  const active = ref(ids[0] || '')
  let observer = null

  onMounted(() => {
    const els = ids.map((id) => document.getElementById(id)).filter(Boolean)
    if (!els.length || !('IntersectionObserver' in window)) return

    observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) active.value = entry.target.id
        })
      },
      { rootMargin: '-45% 0px -50% 0px', threshold: 0 }
    )

    els.forEach((el) => observer.observe(el))
  })

  onUnmounted(() => observer && observer.disconnect())

  return { active }
}
