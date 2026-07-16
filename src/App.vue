<template>
  <TheNav />
  <main>
    <HeroSection />
    <AboutSection />
    <StatsSection />
    <SkillsSection />
    <ProjectsSection />
    <JourneySection />
    <ThanksSection />
    <NowSection />
    <FriendsSection />
    <ContactSection />
  </main>
  <AppFooter />
</template>

<script setup>
import TheNav from './components/TheNav.vue'
import HeroSection from './components/HeroSection.vue'
import AboutSection from './components/AboutSection.vue'
import StatsSection from './components/StatsSection.vue'
import SkillsSection from './components/SkillsSection.vue'
import ProjectsSection from './components/ProjectsSection.vue'
import JourneySection from './components/JourneySection.vue'
import ThanksSection from './components/ThanksSection.vue'
import NowSection from './components/NowSection.vue'
import FriendsSection from './components/FriendsSection.vue'
import ContactSection from './components/ContactSection.vue'
import AppFooter from './components/AppFooter.vue'
import { useReveal } from '@/composables/useReveal'

useReveal()
</script>
