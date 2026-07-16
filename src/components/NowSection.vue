<template>
  <section id="now" class="section" aria-label="Now">
    <div class="container">
      <header class="section-head reveal">
        <span class="section-tag">●</span>
        <div>
          <h2 class="section-title">Now</h2>
          <p class="section-sub">此刻在做的事</p>
        </div>
      </header>

      <NeuCard size="lg" tag="article" class="now-card reveal">
        <ul class="now-list">
          <li
            v-for="(item, i) in now.items"
            :key="i"
            class="now-item"
          >
            <span class="now-text">{{ item.text }}</span>
            <span class="now-tag neu-inset">{{ item.tag }}</span>
          </li>
        </ul>
        <p class="now-updated text-dim">更新于 {{ now.updated }}</p>
      </NeuCard>
    </div>
  </section>
</template>

<script setup>
import { now } from '@/data/now'
import NeuCard from '@/components/base/NeuCard.vue'
</script>

<style scoped>
.now-card {
  max-width: 640px;
  margin-inline: auto;
}
.now-list {
  display: flex;
  flex-direction: column;
}
.now-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 14px 0;
}
.now-item:first-child {
  padding-top: 0;
}
.now-item:last-child {
  padding-bottom: 0;
}
.now-item + .now-item {
  border-top: 1px solid var(--shadow-dark);
}
.now-text {
  font-size: 0.96rem;
}
/* 凹陷圆角徽章:激活态点缀色 */
.now-tag {
  flex-shrink: 0;
  padding: 5px 14px;
  border-radius: var(--radius-full);
  font-family: var(--font-display);
  font-weight: 600;
  font-size: 0.78rem;
  color: var(--accent-text);
}
.now-updated {
  margin-top: 22px;
  font-size: 0.82rem;
  text-align: right;
}

@media (max-width: 640px) {
  .now-item {
    gap: 12px;
  }
}
</style>
