<template>
  <span class="neu-chip neu">
    <slot />
  </span>
</template>

<script setup>
/** 新拟态芯片:用于技能标签等静态展示。筛选按钮请直接在模板用 .neu / .neu-inset 类。 */
</script>

<style scoped>
.neu-chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 9px 16px;
  border-radius: var(--radius-full);
  font-size: 0.85rem;
  font-weight: 500;
  color: var(--text);
}
</style>
