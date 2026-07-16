<template>
  <footer class="section app-footer">
    <div class="container footer-inner reveal">
      <p class="footer-motto grad-text">用好奇心建造,用时间打磨</p>
      <p class="footer-copy text-dim">© 2026 daum12569</p>
      <a href="#hero" class="neu neu-hover neu-press back-to-top" aria-label="回到顶部">
        回到顶部 ↑
      </a>
    </div>
  </footer>
</template>

<script setup>
/** 页脚:座右铭 + 版权 + 回到顶部。 */
</script>

<style scoped>
.app-footer {
  text-align: center;
}
.footer-inner {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 14px;
}
.footer-motto {
  font-family: var(--font-display);
  font-weight: 700;
  font-size: clamp(1.3rem, 3.5vw, 1.8rem);
  letter-spacing: -0.01em;
}
.footer-copy {
  font-size: 0.82rem;
}
.back-to-top {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  margin-top: 6px;
  padding: 10px 22px;
  border-radius: var(--radius-full);
  font-family: var(--font-display);
  font-weight: 600;
  font-size: 0.9rem;
  color: var(--text);
}

@media (max-width: 640px) {
  .back-to-top {
    padding: 9px 18px;
    font-size: 0.85rem;
  }
}
</style>
