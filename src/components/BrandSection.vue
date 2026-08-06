<template>
  <!-- 第二页:品牌卡。左侧正方形卡由 beam 平滑展开演化(useBeamGrow),
       右侧暂留白。真卡 opacity 由 composable 内联接管,不加 .reveal;
       卡内品牌字与 preloader/Hero 同源(BRAND_PATHS + g-stop 渐变),
       .is-born 后淡入;卡纯装饰,不可点 -->
  <section id="page-2" class="section page brand-page" aria-label="第 2 页">
    <div class="container brand-inner">
      <div ref="cardEl" class="brand-card">
        <svg
          class="brand-card-svg"
          :viewBox="BRAND_VIEWBOX"
          aria-hidden="true"
          focusable="false"
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            <linearGradient id="brandCardGrad" x1="0" y1="0" x2="5295.5" y2="0" gradientUnits="userSpaceOnUse">
              <stop offset="0" class="g-stop-1" />
              <stop offset="1" class="g-stop-2" />
            </linearGradient>
          </defs>
          <g :transform="BRAND_GROUP_TRANSFORM" fill="url(#brandCardGrad)">
            <path v-for="(p, i) in BRAND_PATHS" :key="i" :d="p.d" />
          </g>
        </svg>
        <span class="visually-hidden">{{ BRAND_TEXT }}</span>
      </div>
    </div>
  </section>
</template>

<script setup>
import { onMounted, onBeforeUnmount, ref } from 'vue'
import { BRAND_TEXT, BRAND_VIEWBOX, BRAND_GROUP_TRANSFORM, BRAND_PATHS } from '@/data/brandGlyph'
import { initBeamGrow } from '@/composables/useBeamGrow'

const cardEl = ref(null)
let destroy = null

onMounted(() => {
  const sectionEl = document.getElementById('page-2')
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  destroy = initBeamGrow({ cardEl: cardEl.value, sectionEl, trigger: '#page-2', reduced })
})

onBeforeUnmount(() => {
  if (destroy) destroy()
})
</script>

<style scoped>
.brand-page {
  min-height: 100svh;
  display: flex;
  align-items: center;
}
.brand-inner {
  display: flex;
  align-items: center;
}

/* 方卡:beam 展开落定的真身。与 beam 同 var(--bg-2)/var(--radius),
   同色全盖交接零跳变;初始 opacity:0 由 useBeamGrow 内联接管 */
.brand-card {
  flex: none;
  width: clamp(240px, 30vw, 380px);
  aspect-ratio: 1 / 1;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--radius);
  background: var(--bg-2);
  box-shadow:
    8px 8px 20px var(--shadow-dark),
    -8px -8px 20px var(--shadow-light);
}
.brand-card-svg {
  width: 62%;
  display: block;
  overflow: visible;
}

/* ---------- 内容淡入(.is-born 由 useBeamGrow 阈值切换) ---------- */
.brand-card-svg {
  opacity: 0;
  transform: translateY(12px);
  transition:
    opacity 0.5s var(--ease),
    transform 0.5s var(--ease);
}
.is-born .brand-card-svg {
  opacity: 1;
  transform: none;
}

/* ---------- 响应式:右侧本就留白,卡居中即可 ---------- */
@media (max-width: 640px) {
  .brand-inner {
    justify-content: center;
  }
}
</style>
