<template>
  <section id="projects" class="section" aria-label="做过的小玩意">
    <div class="container">
      <header class="section-head reveal">
        <span class="section-tag">/</span>
        <div>
          <h2 class="section-title">做过的小玩意</h2>
          <p class="section-sub">一些跑得起来,一些跑路了。点卡片去现场。</p>
        </div>
      </header>

      <div class="projects-controls reveal">
        <div class="filters">
          <button
            v-for="f in filters"
            :key="f.key"
            class="filter-btn"
            :class="filter === f.key ? 'neu-inset' : 'neu'"
            :aria-pressed="filter === f.key"
            @click="filter = f.key"
          >{{ f.label }}</button>
        </div>
        <label class="search neu-inset">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input v-model="query" type="text" placeholder="搜索项目…" aria-label="搜索项目" />
        </label>
      </div>

      <div class="projects-grid">
        <a
          v-for="p in filtered"
          :key="p.num"
          :href="p.url"
          class="project-card neu neu-hover"
          :class="{ off: p.off }"
          target="_blank"
          rel="noopener"
        >
          <div class="project-top">
            <span class="project-num">{{ p.num }}</span>
            <span class="project-status" :class="p.cat">{{ p.status }}</span>
          </div>
          <div class="project-info">
            <h3>{{ p.name }}</h3>
            <p>{{ p.desc }}</p>
          </div>
          <span class="project-go" aria-hidden="true">-&gt;</span>
        </a>
      </div>
      <p v-if="!filtered.length" class="empty">没找到匹配的项目,换个关键词试试?</p>
    </div>
  </section>
</template>

<script setup>
import { ref, computed } from 'vue'
import { projects, projectFilters } from '@/data/projects'

const filters = projectFilters
const filter = ref('all')
const query = ref('')

const filtered = computed(() => {
  const q = query.value.trim().toLowerCase()
  return projects.filter((p) => {
    const okFilter = filter.value === 'all' || p.cat === filter.value
    const okSearch = !q || p.name.toLowerCase().includes(q) || p.desc.toLowerCase().includes(q)
    return okFilter && okSearch
  })
})
</script>

<style scoped>
.projects-controls {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 16px;
  margin-bottom: 32px;
}
.filters {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}
.filter-btn {
  padding: 9px 16px;
  border-radius: var(--radius-full);
  font-size: 0.85rem;
  font-weight: 500;
  color: var(--text-dim);
  background: var(--bg);
  transition:
    color var(--dur) var(--ease),
    box-shadow var(--dur) var(--ease);
}
.filter-btn:hover {
  color: var(--text);
}
.filter-btn.neu-inset {
  color: var(--accent-text);
}
.search {
  margin-left: auto;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 8px 16px;
  border-radius: var(--radius-full);
  min-width: 200px;
}
.search svg {
  width: 16px;
  height: 16px;
  color: var(--text-dim);
  flex-shrink: 0;
}
.search input {
  border: none;
  background: none;
  color: var(--text);
  font: inherit;
  font-size: 0.88rem;
  width: 100%;
}
.search input::placeholder {
  color: var(--text-dim);
}

.projects-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 18px;
}
.project-card {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 14px;
  padding: clamp(20px, 3vw, 28px);
  border-radius: var(--radius);
}
.project-card.off {
  opacity: 0.7;
}
.project-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.project-num {
  font-family: var(--font-display);
  font-weight: 800;
  font-size: 1.4rem;
  color: var(--accent-text);
  opacity: 0.7;
}
.project-status {
  font-size: 0.72rem;
  font-weight: 600;
  padding: 4px 10px;
  border-radius: var(--radius-full);
  color: var(--text-dim);
}
.project-status.active {
  color: var(--accent-text);
}
.project-status.done {
  color: var(--text);
}
.project-status.pending {
  color: var(--text-dim);
  opacity: 0.7;
}
.project-info h3 {
  font-size: 1.08rem;
  font-family: var(--font-display);
}
.project-info p {
  color: var(--text-dim);
  font-size: 0.88rem;
  margin-top: 4px;
}
.project-go {
  position: absolute;
  right: clamp(20px, 3vw, 28px);
  bottom: 18px;
  color: var(--accent-text);
  font-size: 1.1rem;
  opacity: 0;
  transform: translateX(-6px);
  transition:
    opacity var(--dur) var(--ease),
    transform var(--dur) var(--ease);
}
.project-card:hover .project-go {
  opacity: 1;
  transform: translateX(0);
}
.empty {
  text-align: center;
  color: var(--text-dim);
  padding: 40px 0;
}

@media (max-width: 640px) {
  .search {
    margin-left: 0;
    width: 100%;
  }
}
</style>
