<template>
  <section id="skills" class="section">
    <div class="container">
      <header class="section-head reveal">
        <span class="section-tag">+</span>
        <div>
          <h2 class="section-title">技能与折腾</h2>
          <p class="section-sub">会用一点,折腾过一些</p>
        </div>
      </header>

      <div class="skills-grid">
        <NeuCard
          v-for="cat in skills"
          :key="cat.category"
          class="reveal skill-card"
        >
          <h3 class="skill-cat">{{ cat.category }}</h3>
          <div class="skill-chips">
            <NeuChip v-for="it in cat.items" :key="it">{{ it }}</NeuChip>
          </div>
        </NeuCard>
      </div>
    </div>
  </section>
</template>

<script setup>
import NeuCard from '@/components/base/NeuCard.vue'
import NeuChip from '@/components/base/NeuChip.vue'
import { skills } from '@/data/skills'
</script>

<style scoped>
.skills-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
  gap: 18px;
}
.skill-card {
  display: flex;
  flex-direction: column;
  gap: 14px;
}
.skill-cat {
  font-size: 1.05rem;
}
.skill-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

@media (max-width: 640px) {
  .skills-grid {
    grid-template-columns: 1fr;
  }
}
</style>
