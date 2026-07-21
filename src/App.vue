<template>
  <ThemeToggle class="theme-floating reveal reveal-after-boot" />
  <PagePager />
  <main>
    <HeroSection />
    <PageSection v-for="n in 8" :key="n" :index="n + 1" />
  </main>
</template>

<script setup>
import ThemeToggle from './components/ThemeToggle.vue'
import HeroSection from './components/HeroSection.vue'
import PageSection from './components/PageSection.vue'
import PagePager from './components/PagePager.vue'
import { useReveal } from '@/composables/useReveal'

useReveal()
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
