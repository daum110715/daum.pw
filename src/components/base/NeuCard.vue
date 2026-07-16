<template>
  <component
    :is="tag"
    class="neu-card"
    :class="[size === 'lg' ? 'neu-lg' : 'neu', { 'neu-hover': hover, 'neu-press': press }]"
  >
    <slot />
  </component>
</template>

<script setup>
/**
 * 新拟态卡片:凸起表面,可选 hover 抬升 / active 内陷。
 * 如需"按下"的凹面(input / 激活态),直接在模板用 .neu-inset 类。
 */
defineProps({
  tag: { type: String, default: 'div' },
  size: { type: String, default: 'md' }, // 'md' | 'lg'
  hover: { type: Boolean, default: true },
  press: { type: Boolean, default: false },
})
</script>

<style scoped>
.neu-card {
  padding: clamp(20px, 3vw, 28px);
}
</style>
