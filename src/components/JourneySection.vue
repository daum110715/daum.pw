<template>
  <section id="journey" class="section" aria-label="历程">
    <div class="container">
      <header class="section-head reveal">
        <span class="section-tag">-&gt;</span>
        <div>
          <h2 class="section-title">历程</h2>
          <p class="section-sub">一条不直的线</p>
        </div>
      </header>

      <ol class="timeline">
        <li
          v-for="(item, i) in journey"
          :key="i"
          class="timeline-item reveal"
        >
          <span class="timeline-dot neu" aria-hidden="true" />
          <NeuCard tag="article" class="timeline-card">
            <p class="timeline-period">{{ item.period }}</p>
            <h3 class="timeline-title">{{ item.title }}</h3>
            <p v-if="item.desc" class="timeline-desc text-dim">{{ item.desc }}</p>
          </NeuCard>
        </li>
      </ol>
    </div>
  </section>
</template>

<script setup>
import { journey } from '@/data/journey'
import NeuCard from '@/components/base/NeuCard.vue'
</script>

<style scoped>
/* 竖线:容器左侧 2px 暗色线,圆点叠在其上 */
.timeline {
  position: relative;
  padding-left: 36px;
}
.timeline::before {
  content: '';
  position: absolute;
  left: 8px; /* 线中心 9px,与 18px 圆点中心对齐 */
  top: 6px;
  bottom: 6px;
  width: 2px;
  background: var(--shadow-dark);
  border-radius: var(--radius-full);
}
.timeline-item {
  position: relative;
  padding-bottom: 24px;
}
.timeline-item:last-child {
  padding-bottom: 0;
}
/* 凸起小圆点:absolute 在竖线上,顶部与卡片首行对齐 */
.timeline-dot {
  position: absolute;
  left: -36px; /* 圆点左缘落到时间线左缘,中心 9px 落在竖线上 */
  top: clamp(20px, 3vw, 28px); /* 镜像 NeuCard 内边距,对齐首行 */
  width: 18px;
  height: 18px;
  border-radius: 50%;
}
.timeline-card {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.timeline-period {
  font-family: var(--font-display);
  font-weight: 700;
  font-size: 0.8rem;
  letter-spacing: 0.02em;
  color: var(--accent-text);
}
.timeline-title {
  font-size: 1.08rem;
}
.timeline-desc {
  font-size: 0.9rem;
}

@media (max-width: 640px) {
  .timeline {
    padding-left: 28px;
  }
  .timeline-dot {
    left: -28px;
  }
}
</style>
