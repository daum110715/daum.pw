<template>
  <section id="contact" class="section">
    <div class="container contact-wrap">
      <header class="section-head center reveal">
        <span class="section-tag">@</span>
        <div>
          <h2 class="section-title">找到我</h2>
          <p class="section-sub">邮箱最快</p>
        </div>
      </header>

      <div class="contact-list">
        <a
          v-for="c in contact"
          :key="c.url"
          :href="c.url"
          class="contact-item neu neu-hover reveal"
          :target="c.url.startsWith('mailto:') ? undefined : '_blank'"
          :rel="c.url.startsWith('mailto:') ? undefined : 'noopener'"
        >
          <span class="contact-icon neu" aria-hidden="true">{{ c.icon }}</span>
          <span class="contact-label">{{ c.label }}</span>
          <span class="contact-go" aria-hidden="true">-&gt;</span>
        </a>
      </div>
    </div>
  </section>
</template>

<script setup>
import { contact } from '@/data/social'
</script>

<style scoped>
.contact-wrap {
  display: flex;
  flex-direction: column;
  align-items: center;
}
.contact-list {
  width: 100%;
  max-width: 560px;
  display: flex;
  flex-direction: column;
  gap: 14px;
}
.contact-item {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 14px 18px;
  border-radius: var(--radius);
}
.contact-icon {
  width: 48px;
  height: 48px;
  border-radius: var(--radius);
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--accent-text);
  font-family: var(--font-display);
  font-weight: 700;
  font-size: 1.2rem;
  flex-shrink: 0;
}
.contact-label {
  flex: 1;
  font-size: 0.98rem;
  word-break: break-all;
}
.contact-go {
  color: var(--accent-text);
  font-size: 1.1rem;
  flex-shrink: 0;
  transition: transform var(--dur) var(--ease);
}
.contact-item:hover .contact-go {
  transform: translateX(4px);
}

@media (max-width: 640px) {
  .contact-item {
    gap: 12px;
    padding: 12px 14px;
  }
  .contact-icon {
    width: 42px;
    height: 42px;
    font-size: 1.05rem;
  }
}
</style>
