<template>
  <header class="nav-wrap">
    <nav class="nav neu" aria-label="主导航">
      <a href="#hero" class="nav-logo" aria-label="daum.pw 首页">
        <span class="logo-mark">d</span>
        <span class="logo-text">daum.pw</span>
      </a>
      <ul class="nav-links">
        <li v-for="item in navItems" :key="item.id">
          <a
            :href="`#${item.id}`"
            class="nav-link"
            :class="{ active: active === item.id, 'neu-inset': active === item.id }"
            :aria-current="active === item.id ? 'true' : undefined"
          >{{ item.label }}</a>
        </li>
      </ul>
      <ThemeToggle />
    </nav>
  </header>
</template>

<script setup>
import { useActiveSection } from '@/composables/useActiveSection'
import ThemeToggle from './ThemeToggle.vue'

const navItems = [
  { id: 'hero', label: '首页' },
  { id: 'about', label: '关于' },
  { id: 'skills', label: '技能' },
  { id: 'projects', label: '项目' },
  { id: 'journey', label: '历程' },
  { id: 'thanks', label: '感谢' },
  { id: 'contact', label: '联系' },
]

const { active } = useActiveSection(navItems.map((i) => i.id))
</script>

<style scoped>
.nav-wrap {
  position: sticky;
  top: 0;
  z-index: 50;
  padding: 14px var(--pad);
  display: flex;
  justify-content: center;
  pointer-events: none;
}
.nav {
  pointer-events: auto;
  width: 100%;
  max-width: var(--maxw);
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 9px 14px;
  border-radius: var(--radius-full);
}
.nav-logo {
  display: inline-flex;
  align-items: center;
  gap: 9px;
  font-family: var(--font-display);
  font-weight: 700;
  flex-shrink: 0;
}
.logo-mark {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 30px;
  height: 30px;
  border-radius: var(--radius-sm);
  background: linear-gradient(135deg, var(--accent), var(--accent-2));
  color: #fff;
  font-weight: 800;
  font-size: 1.05rem;
}
.logo-text {
  font-size: 0.95rem;
}
.nav-links {
  display: flex;
  align-items: center;
  gap: 2px;
  margin: 0 auto;
  overflow-x: auto;
  scrollbar-width: none;
}
.nav-links::-webkit-scrollbar {
  display: none;
}
.nav-link {
  display: inline-block;
  padding: 8px 14px;
  border-radius: var(--radius-full);
  font-size: 0.88rem;
  font-weight: 500;
  color: var(--text-dim);
  white-space: nowrap;
  transition:
    color var(--dur) var(--ease),
    box-shadow var(--dur) var(--ease);
}
.nav-link:hover {
  color: var(--text);
}
.nav-link.active {
  color: var(--accent-text);
}

@media (max-width: 640px) {
  .logo-text {
    display: none;
  }
  .nav {
    gap: 8px;
    padding: 7px 10px;
  }
  .nav-link {
    padding: 7px 10px;
    font-size: 0.82rem;
  }
}
</style>
