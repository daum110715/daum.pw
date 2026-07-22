<template>
  <!-- tab 栏 = daum12569(Hero SVG 真身,飞上来后独立弹开)+ 数字行。
       同一个元素到底:1/2/5/6/9 的视觉就是 Hero SVG 数字路径,
       这里只做透明点击热区;3/4/7/8 从左到右依次滑入+淡入。
       飞行由 flyP(scrub)驱动;展开/收回由 flyEase(独立补间)驱动 -->
  <nav class="page-pager" :style="pillStyle" aria-label="页面分区导航">
    <span class="daum-spacer" aria-hidden="true" />
    <button
      v-for="n in total"
      :key="n"
      class="pager-btn"
      :class="{ 'is-new': isNew(n), 'is-active': activePage === n }"
      :style="isNew(n) ? { opacity: newO(n) } : undefined"
      :aria-label="`滚动到第 ${n} 页`"
      :aria-current="activePage === n ? 'page' : undefined"
      :tabindex="flyP >= 1 ? 0 : -1"
      @click="go(n)"
    ><span class="d" :style="isNew(n) ? { transform: `translateX(${slide(n)}px)` } : undefined">{{ n }}</span></button>
  </nav>
</template>

<script setup>
import { computed, onMounted, onBeforeUnmount } from 'vue'
import { dockGeo, flyP, flyEase, activePage, bootDone } from '@/composables/brandDock'

const total = 9
const NEW_DIGITS = [3, 4, 7, 8]
const isNew = (n) => NEW_DIGITS.includes(n)

/* 展开度 = flyEase(Hero 的独立展开/收回补间,到位 back.out 弹开):
   与 SVG 数字摊开同一驱动——槽宽撑开、3/4/7/8 补入,
   任意时刻都与数字位置严丝合缝 */
const ease = flyEase

/* 新数字入场:严格从左到右 3→4→7→8 依次滑入+淡入——
   每个数字延迟起步、各自走完剩余行程,0.45 槽宽短距滑正,
   不与邻居字形交叠 */
const NEW_DELAY = { 3: 0, 4: 0.12, 7: 0.24, 8: 0.36 }
function localT(n) {
  const d = NEW_DELAY[n] || 0
  return Math.min(1, Math.max(0, (ease.value - d) / (1 - d)))
}

function slide(n) {
  const slotW = dockGeo.advance + dockGeo.gap * ease.value
  return -(1 - localT(n)) * slotW * 0.45
}

/* 透明度:localT 前 45% 淡入,与滑入同步完成 */
function newO(n) {
  return Math.min(1, localT(n) / 0.45)
}

const pillStyle = computed(() => {
  if (!dockGeo.ready) return { opacity: 0 }
  const slotW = dockGeo.advance + dockGeo.gap * ease.value
  const w = dockGeo.spacer + 5 * slotW + 4 * slotW * ease.value + 8
  return {
    left: `${dockGeo.left - 4}px`,
    top: `${dockGeo.top - 4}px`,
    height: `${dockGeo.h + 8}px`,
    width: `${w}px`,
    opacity: bootDone.value && (flyP.value > 0.01 || ease.value > 0) ? 1 : 0,
    pointerEvents: flyP.value >= 1 ? 'auto' : 'none',
    '--slot-w': `${slotW}px`,
    '--new-w': `${slotW * ease.value}px`,
    '--new-o': ease.value,
    '--spacer-w': `${dockGeo.spacer}px`,
    '--digit-fs': `${dockGeo.digitH / 0.68}px`,
  }
})

let observer = null
let sections = []

onMounted(() => {
  sections = Array.from(document.querySelectorAll('main > section'))
  if (!('IntersectionObserver' in window) || !sections.length) return
  observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((e) => {
        if (e.isIntersecting) activePage.value = sections.indexOf(e.target) + 1
      })
    },
    { threshold: 0.5 },
  )
  sections.forEach((s) => observer.observe(s))
})

onBeforeUnmount(() => observer && observer.disconnect())

function go(n) {
  const el = sections[n - 1]
  if (!el) return
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  /* hero 被 GSAP pin 在 pin-spacer 里:scrollIntoView(block:'start') 对齐到
     pin 终点(≈pinRange)而非文档顶,品牌字保持停靠回不去首页 → 直接滚 0 */
  if (n === 1) {
    window.scrollTo({ top: 0, behavior: reduced ? 'auto' : 'smooth' })
    return
  }
  el.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'start' })
}
</script>

<style scoped>
.page-pager {
  position: fixed;
  z-index: 50;
  display: flex;
  align-items: center;
  padding: 0 4px;
  opacity: 0;
  pointer-events: none;
  overflow: hidden;
}
.daum-spacer {
  width: var(--spacer-w);
  flex: none;
}
.pager-btn {
  flex: none;
  width: var(--slot-w);
  height: 100%;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  font-family: var(--font-display);
  font-weight: 800;
  font-size: var(--digit-fs);
  line-height: 1;
  /* 1/2/5/6/9:文字透明(视觉=底下的 SVG 真身),仅作点击热区 */
  color: transparent;
  overflow: hidden;
  transition:
    color var(--dur) var(--ease),
    background var(--dur) var(--ease);
}
.pager-btn.is-new {
  width: var(--new-w);
  /* 不裁剪:字形向左探出按钮,被 SVG 邻居(z-55 的 hero)遮住 */
  overflow: visible;
  color: color-mix(in srgb, var(--accent-2) 55%, white);
}
/* 新数字字形:平移滑入的载体(inline-block 才可 transform) */
.pager-btn .d {
  display: inline-block;
}
</style>
