<template>
  <!-- tab 栏 = daum(Hero SVG 真身,钉在最左)+ 数字行。
       数字是同字体 Outfit 800 的 DOM 按钮:落位瞬间 1/2/5/6/9 在 SVG
       数字原位淡入(SVG 数字同步淡出,零跳变),随后 3/4/7/8 左→右
       依次撑开,12569 展开成 123456789;daum 全程不动 -->
  <nav
    class="page-pager"
    :class="{
      'is-on': dockState !== 'hero',
      'is-docked': dockState === 'docked',
      'is-collapsing': dockState === 'collapsing',
      'is-loose': loose,
    }"
    :style="pillStyle"
    aria-label="页面分区导航"
  >
    <span class="daum-spacer" aria-hidden="true" />
    <button
      v-for="n in total"
      :key="n"
      class="pager-btn"
      :class="{ 'is-new': isNew(n), 'is-active': activePage === n }"
      :aria-label="`滚动到第 ${n} 页`"
      :aria-current="activePage === n ? 'page' : undefined"
      :tabindex="dockState === 'docked' ? 0 : -1"
      @click="go(n)"
    >{{ n }}</button>
  </nav>
</template>

<script setup>
import { ref, computed, watch, onMounted, onBeforeUnmount } from 'vue'
import { dockGeo, dockState, activePage } from '@/composables/brandDock'

const total = 9
const NEW_DIGITS = [3, 4, 7, 8]
const isNew = (n) => NEW_DIGITS.includes(n)

/* 两阶段:docked = 1/2/5/6/9 原位接替(紧凑槽,与 SVG 数字对齐零跳变);
   250ms 后 loose = 全部槽加宽 + 3/4/7/8 撑开,数字行宽松化 */
const loose = ref(false)
let looseTimer = null
watch(dockState, (s) => {
  clearTimeout(looseTimer)
  if (s === 'docked') looseTimer = setTimeout(() => (loose.value = true), 250)
  else loose.value = false
})

/* 胶囊:左缘钉死(daum 不动),接替时紧凑,loose 后向右长到 9 宽松槽 */
const pillStyle = computed(() => {
  if (!dockGeo.ready) return {}
  return {
    left: `${dockGeo.left - 4}px`,
    top: `${dockGeo.top - 4}px`,
    height: `${dockGeo.h + 8}px`,
    '--slot-w': `${dockGeo.advance}px`,
    '--slot-w2': `${dockGeo.slotLoose}px`,
    '--spacer-w': `${dockGeo.spacer}px`,
    '--w-compact': `${dockGeo.wCompact}px`,
    '--w-full': `${dockGeo.wFull}px`,
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

onBeforeUnmount(() => {
  observer && observer.disconnect()
  clearTimeout(looseTimer)
})

function go(n) {
  const el = sections[n - 1]
  if (!el) return
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  el.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'start' })
}
</script>

<style scoped>
.page-pager {
  position: fixed;
  z-index: 50;
  display: flex;
  align-items: center;
  width: var(--w-compact);
  padding: 0 4px;
  opacity: 0;
  pointer-events: none;
  overflow: hidden;
  transition:
    opacity 0.45s var(--ease),
    width 0.5s cubic-bezier(0.45, 0.05, 0.25, 1);
}
.page-pager.is-on {
  opacity: 1;
  pointer-events: auto;
}
.page-pager.is-loose {
  width: var(--w-full);
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
  color: color-mix(in srgb, var(--accent-2) 55%, white);
  overflow: hidden;
  opacity: 0;
  transition:
    width 0.5s cubic-bezier(0.45, 0.05, 0.25, 1),
    opacity 0.3s var(--ease),
    color var(--dur) var(--ease),
    background var(--dur) var(--ease);
}
/* 落位后 1/2/5/6/9 立即淡入(紧凑槽原位接替 SVG 数字);
   loose 后所有槽加宽、3/4/7/8 宽 0 → 宽松槽,数字行整体左→右宽松化。
   collapsing(收回):1/2/5/6/9 保持可见、随槽宽滑回紧凑位,3/4/7/8 收没 */
.is-docked .pager-btn,
.is-collapsing .pager-btn:not(.is-new) {
  opacity: 1;
}
.is-loose .pager-btn {
  width: var(--slot-w2);
}
.pager-btn.is-new {
  width: 0;
}
.is-loose .pager-btn.is-new {
  width: var(--slot-w2);
  opacity: 1;
}
.pager-btn:hover {
  background: var(--accent-soft);
}
.pager-btn.is-active {
  color: var(--accent);
}
@media (prefers-reduced-motion: reduce) {
  .page-pager,
  .pager-btn {
    transition: none;
  }
}
</style>
