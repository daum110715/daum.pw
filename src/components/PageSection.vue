<template>
  <section :id="`page-${index}`" class="section page" :aria-label="`第 ${index} 页`">
    <div class="container page-inner">
      <span class="page-num" aria-hidden="true">{{ label }}</span>
    </div>
  </section>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  index: { type: Number, required: true },
})

const label = computed(() => String(props.index).padStart(2, '0'))
</script>

<style scoped>
.page {
  min-height: 100svh;
  display: flex;
  align-items: center;
}
.page-inner {
  display: flex;
  justify-content: center;
}
/* 占位水印:分区内容就绪后连同 .page-inner 一起替换掉 */
.page-num {
  font-family: var(--font-display);
  font-weight: 800;
  font-size: clamp(4rem, 14vw, 9rem);
  line-height: 1;
  color: var(--accent);
  opacity: 0.08;
  user-select: none;
}
</style>
