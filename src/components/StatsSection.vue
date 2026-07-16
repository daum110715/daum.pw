<template>
  <section id="stats" class="section" aria-label="一些数字">
    <div class="container">
      <header class="section-head reveal">
        <span class="section-tag">#</span>
        <div>
          <h2 class="section-title">一些数字</h2>
          <p class="section-sub">不一定准,但挺真实</p>
        </div>
      </header>

      <div class="stats-grid">
        <NeuCard
          v-for="(s, i) in stats"
          :key="s.label"
          class="reveal stat-card"
          :style="{ transitionDelay: i * 0.08 + 's' }"
        >
          <div class="stat-value grad-text">{{ s.value }}</div>
          <div class="stat-label text-dim">{{ s.label }}</div>
        </NeuCard>
      </div>
    </div>
  </section>
</template>

<script setup>
import NeuCard from '@/components/base/NeuCard.vue'
import { stats } from '@/data/stats'
</script>

<style scoped>
.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 18px;
}
.stat-card {
  display: flex;
  flex-direction: column;
  gap: 6px;
  text-align: left;
}
.stat-value {
  font-family: var(--font-display);
  font-weight: 800;
  font-size: clamp(2rem, 5vw, 2.8rem);
  line-height: 1;
}
.stat-label {
  font-size: 0.9rem;
}

@media (max-width: 640px) {
  .stats-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}
</style>
