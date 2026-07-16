<template>
  <component
    :is="tag"
    class="neu-btn neu neu-hover neu-press"
    :type="tag === 'button' ? type : undefined"
    :href="tag === 'a' ? href : undefined"
  >
    <slot />
  </component>
</template>

<script setup>
/**
 * 新拟态按钮:凸起 -> hover 抬升 -> active 内陷。
 * tag='button'(默认)或 'a'(配合 href)。
 */
defineProps({
  tag: { type: String, default: 'button' },
  type: { type: String, default: 'button' },
  href: { type: String, default: null },
})
</script>

<style scoped>
.neu-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 12px 22px;
  border-radius: var(--radius-full);
  font-family: var(--font-display);
  font-weight: 600;
  font-size: 0.95rem;
  color: var(--text);
  white-space: nowrap;
}
.neu-btn :deep(svg) {
  width: 1.1em;
  height: 1.1em;
}
</style>
