<template>
  <section id="friends" class="section" aria-label="友邻">
    <div class="container">
      <header class="section-head reveal">
        <span class="section-tag">&amp;</span>
        <div>
          <h2 class="section-title">友邻</h2>
          <p class="section-sub">互相串门</p>
        </div>
      </header>

      <div class="friends-grid">
        <a
          v-for="f in friends"
          :key="f.name"
          :href="f.url"
          class="friend-card neu neu-hover reveal"
          :target="f.url.startsWith('mailto:') ? undefined : '_blank'"
          :rel="f.url.startsWith('mailto:') ? undefined : 'noopener'"
        >
          <h3 class="friend-name">{{ f.name }}</h3>
          <p class="friend-desc text-dim">{{ f.desc }}</p>
          <span class="friend-go" aria-hidden="true">-&gt;</span>
        </a>
      </div>
    </div>
  </section>
</template>

<script setup>
import { friends } from '@/data/friends'
</script>

<style scoped>
.friends-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
  gap: 18px;
}
.friend-card {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: clamp(20px, 3vw, 28px);
  border-radius: var(--radius);
}
.friend-name {
  font-size: 1.08rem;
  font-family: var(--font-display);
}
.friend-desc {
  font-size: 0.88rem;
}
.friend-go {
  position: absolute;
  right: 20px;
  bottom: 18px;
  color: var(--accent-text);
  font-size: 1.1rem;
  opacity: 0;
  transform: translateX(-6px);
  transition:
    opacity var(--dur) var(--ease),
    transform var(--dur) var(--ease);
}
.friend-card:hover .friend-go {
  opacity: 1;
  transform: translateX(0);
}

@media (max-width: 640px) {
  .friends-grid {
    grid-template-columns: 1fr;
  }
}
</style>
