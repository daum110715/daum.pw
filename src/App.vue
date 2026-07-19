<template>
  <ThemeToggle class="theme-floating reveal reveal-after-boot" />
  <main :class="{ 'is-legacy-fading': legacyFading }">
    <HeroSection @enter-legacy="onEnterLegacy" />
  </main>
  <LegacyTransition ref="legacyRef" @fading="onLegacyFading" />
</template>

<script setup>
import { ref } from 'vue'
import ThemeToggle from './components/ThemeToggle.vue'
import HeroSection from './components/HeroSection.vue'
import LegacyTransition from './components/LegacyTransition.vue'
import { useReveal } from '@/composables/useReveal'

useReveal()

const legacyFading = ref(false)
const legacyRef = ref(null)

function onEnterLegacy(rect) {
  legacyRef.value?.enter(rect)
}
function onLegacyFading(v) {
  legacyFading.value = v
}
</script>

<style scoped>
main {
  transition: opacity 0.6s var(--ease); /* 纯 opacity 淡出,与 iframe 交叉(无遮罩) */
}
main.is-legacy-fading {
  opacity: 0;
}
.theme-floating {
  position: fixed;
  top: 18px;
  right: 18px;
  z-index: 50;
}
@media (max-width: 640px) {
  .theme-floating {
    top: 14px;
    right: 14px;
  }
}
</style>
