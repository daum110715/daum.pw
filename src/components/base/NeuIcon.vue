<template>
  <span class="neu-icon neu" :style="{ '--icon-size': size }">
    <slot />
  </span>
</template>

<script setup>
/** 新拟态图标托盘:凸起方形容器,内嵌 svg(默认取 50% 尺寸,主色着色)。 */
defineProps({
  size: { type: String, default: '48px' },
})
</script>

<style scoped>
.neu-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: var(--icon-size, 48px);
  height: var(--icon-size, 48px);
  border-radius: var(--radius);
  color: var(--accent);
  flex-shrink: 0;
}
.neu-icon :deep(svg) {
  width: 48%;
  height: 48%;
}
</style>
