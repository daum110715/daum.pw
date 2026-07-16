<template>
  <section id="thanks" class="section" aria-label="特别感谢与收藏">
    <div class="container">
      <header class="section-head reveal">
        <span class="section-tag">♥</span>
        <div>
          <h2 class="section-title">特别感谢与收藏</h2>
          <p class="section-sub">撑起这一切的工具与人</p>
        </div>
      </header>

      <div class="thanks-grid">
        <NeuCard
          v-for="(item, i) in thanks"
          :key="i"
          tag="article"
          class="thanks-card reveal"
        >
          <div v-if="item.video" class="thanks-video neu-inset">
            <video
              ref="videoRef"
              :src="clawdVideo"
              :autoplay="!reducedMotion"
              muted
              :loop="!reducedMotion"
              playsinline
              preload="auto"
              aria-label="Claude Code 动画"
            />
          </div>
          <NeuIcon v-else-if="item.icon === 'cloud'" size="56px" class="thanks-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
              <path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z" />
            </svg>
          </NeuIcon>
          <h3 class="thanks-title">{{ item.title }}</h3>
          <p class="thanks-desc text-dim">{{ item.desc }}</p>
        </NeuCard>
      </div>
    </div>
  </section>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { thanks } from '@/data/thanks'
import clawdVideo from '@/assets/clawd.webm'
import NeuCard from '@/components/base/NeuCard.vue'
import NeuIcon from '@/components/base/NeuIcon.vue'

const videoRef = ref(null)
const reducedMotion = ref(false)
onMounted(() => {
  reducedMotion.value =
    window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches
  // reduced-motion 下不自动播放,避免持续动效干扰前庭敏感用户
  if (reducedMotion.value && videoRef.value) videoRef.value.pause()
})
</script>

<style scoped>
.thanks-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 18px;
}
.thanks-card {
  display: flex;
  flex-direction: column;
  gap: 14px;
}
/* 凹陷视频框:内嵌托盘,视频铺满并圆角 */
.thanks-video {
  padding: 10px;
}
.thanks-video video {
  width: 100%;
  border-radius: var(--radius-sm);
  display: block;
}
.thanks-icon {
  align-self: flex-start;
}
.thanks-title {
  font-size: 1.1rem;
}
.thanks-desc {
  font-size: 0.9rem;
  white-space: pre-line; /* 保留 data 中的 \n 换行 */
}

@media (max-width: 640px) {
  .thanks-grid {
    grid-template-columns: 1fr;
  }
}
</style>
