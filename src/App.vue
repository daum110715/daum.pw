<template>
  <ThemeToggle class="theme-floating reveal reveal-after-boot" />
  <main>
    <HeroSection @enter-legacy="onEnterLegacy" />
  </main>
  <LegacyTransition
    ref="legacyRef"
    :active="legacyActive"
    @exit="legacyActive = false"
  />
</template>

<script setup>
import { ref } from 'vue'
import ThemeToggle from './components/ThemeToggle.vue'
import HeroSection from './components/HeroSection.vue'
import LegacyTransition from './components/LegacyTransition.vue'
import { useReveal } from '@/composables/useReveal'

useReveal()

const legacyActive = ref(false)
const legacyRef = ref(null)

function onEnterLegacy(rect) {
  legacyActive.value = true
  legacyRef.value?.enter(rect)
}
</script>

<style scoped>
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
