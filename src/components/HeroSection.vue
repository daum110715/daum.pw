<template>
  <section id="hero" class="section hero" aria-label="首页">
    <div class="container hero-inner">
      <div class="hero-badge neu-inset reveal">
        <span class="dot" />
        <span>数字客厅 · 持续构建</span>
      </div>

      <h1 class="hero-title reveal">
        <span class="grad-text">daum12569</span>
      </h1>
      <p class="hero-role reveal">用好奇心建造,用时间打磨</p>

      <div
        class="hero-sig reveal neu-inset"
        @mouseenter="pauseTimer"
        @mouseleave="resumeTimer"
        @focusin="pauseTimer"
        @focusout="resumeTimer"
      >
        <Transition name="sig" mode="out-in">
          <div class="sig-text" :key="index">
            <p class="sig-line1">{{ current.line1 }}</p>
            <p class="sig-line2">{{ current.line2 }}</p>
          </div>
        </Transition>
        <button class="sig-next neu neu-hover neu-press" aria-label="换一条签名" @click="next">
          // 换一条
        </button>
      </div>

      <div class="hero-social reveal">
        <a
          v-for="s in social"
          :key="s.url"
          :href="s.url"
          class="social-icon neu neu-hover neu-press"
          :aria-label="s.name"
          :target="s.url.startsWith('mailto:') ? undefined : '_blank'"
          rel="noopener"
          v-html="icon(s.key)"
        />
      </div>

      <a href="#about" class="scroll-cue" aria-label="向下滚动">
        <span class="mouse neu-inset"><span class="wheel" /></span>
      </a>
    </div>
  </section>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { signatures } from '@/data/signatures'
import { social } from '@/data/social'

const index = ref(0)
const reducedMotion = ref(false)

function pickRandom() {
  if (signatures.length <= 1) {
    index.value = 0
    return
  }
  let n = index.value
  while (n === index.value) n = Math.floor(Math.random() * signatures.length)
  index.value = n
}
const current = computed(() => signatures[index.value])

let timer = null
function resetTimer() {
  if (timer) clearInterval(timer)
  timer = setInterval(pickRandom, 7000)
}
function pauseTimer() {
  if (timer) {
    clearInterval(timer)
    timer = null
  }
}
function resumeTimer() {
  if (!timer && !reducedMotion.value) resetTimer()
}
function next() {
  pickRandom()
  // 手动切换后重置自动计时
  if (!reducedMotion.value) resetTimer()
}

onMounted(() => {
  reducedMotion.value =
    window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches
  pickRandom()
  // reduced-motion 下不自动轮换(保留手动按钮),满足 WCAG 2.2.2 Pause/Stop/Hide
  if (!reducedMotion.value) resetTimer()
})
onUnmounted(() => timer && clearInterval(timer))

const ICONS = {
  bilibili: '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M17.813 4.653h.854c1.51.054 2.769.578 3.773 1.574 1.004.995 1.524 2.249 1.56 3.76v7.36c-.036 1.51-.556 2.769-1.56 3.773s-2.262 1.524-3.773 1.56H5.333c-1.51-.036-2.769-.556-3.773-1.56S.036 18.858 0 17.347v-7.36c.036-1.511.556-2.765 1.56-3.76 1.004-.996 2.262-1.52 3.773-1.574h.774l-1.174-1.12a1.234 1.234 0 0 1-.373-.906c0-.356.124-.658.373-.907l.027-.027c.267-.249.573-.373.92-.373.347 0 .653.124.92.373L9.653 4.44c.071.071.134.142.187.213h4.267a.836.836 0 0 1 .16-.213l2.853-2.747c.267-.249.573-.373.92-.373.347 0 .662.151.929.4.267.249.391.551.391.907 0 .355-.124.657-.373.906zM5.333 7.24c-.746.018-1.373.276-1.88.773-.506.498-.769 1.13-.786 1.894v7.52c.017.764.28 1.395.786 1.893.507.498 1.134.756 1.88.773h13.334c.746-.017 1.373-.275 1.88-.773.506-.498.769-1.129.786-1.893v-7.52c-.017-.765-.28-1.396-.786-1.894-.507-.497-1.134-.755-1.88-.773zM8 11.107c.373 0 .684.124.933.373.25.249.383.569.4.96v1.173c-.017.391-.15.711-.4.96-.249.25-.56.374-.933.374s-.684-.125-.933-.374c-.25-.249-.383-.569-.4-.96V12.44c0-.373.129-.689.386-.947.258-.257.574-.386.947-.386zm8 0c.373 0 .684.124.933.373.25.249.383.569.4.96v1.173c-.017.391-.15.711-.4.96-.249.25-.56.374-.933.374s-.684-.125-.933-.374c-.25-.249-.383-.569-.4-.96V12.44c.017-.391.15-.711.4-.96.249-.249.56-.373.933-.373Z"/></svg>',
  email: '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M24 5.457v13.909c0 .904-.732 1.636-1.636 1.636h-3.819V11.73L12 16.64l-6.545-4.91v9.273H1.636A1.636 1.636 0 0 1 0 19.366V5.457c0-2.023 2.309-3.178 3.927-1.964L5.455 4.64 12 9.548l6.545-4.91 1.528-1.145C21.69 2.28 24 3.434 24 5.457z"/></svg>',
  github: '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z"/></svg>',
}
function icon(key) {
  return ICONS[key] || ''
}
</script>

<style scoped>
.hero {
  min-height: 92vh;
  display: flex;
  align-items: center;
  padding-top: clamp(80px, 14vw, 140px);
}
.hero-inner {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  gap: 22px;
}
.hero-badge {
  display: inline-flex;
  align-items: center;
  gap: 9px;
  padding: 8px 18px;
  border-radius: var(--radius-full);
  font-size: 0.85rem;
  color: var(--text-dim);
}
.hero-badge .dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--accent);
  box-shadow: 0 0 10px var(--accent);
}
.hero-title {
  font-size: clamp(2.8rem, 11vw, 6rem);
  font-weight: 800;
  letter-spacing: -0.03em;
  line-height: 1;
}
.hero-role {
  color: var(--text-dim);
  font-size: clamp(1rem, 2.5vw, 1.2rem);
  font-family: var(--font-display);
}
.hero-sig {
  display: flex;
  align-items: center;
  gap: 18px;
  padding: 16px 22px;
  border-radius: var(--radius);
  max-width: 520px;
  width: 100%;
  margin-top: 6px;
}
.sig-text {
  flex: 1;
  text-align: left;
  min-width: 0;
}
.sig-line1 {
  font-family: var(--font-display);
  font-weight: 600;
  font-size: 1rem;
}
.sig-line2 {
  color: var(--text-dim);
  font-size: 0.85rem;
  margin-top: 2px;
}
/* 签名淡入淡出 */
.sig-enter-active,
.sig-leave-active {
  transition: opacity 0.3s var(--ease);
}
.sig-enter-from,
.sig-leave-to {
  opacity: 0;
}
.sig-next {
  flex-shrink: 0;
  color: var(--accent-text);
  font-size: 0.8rem;
  font-family: var(--font-display);
  white-space: nowrap;
  padding: 8px 12px;
  border-radius: var(--radius-full);
}

.hero-social {
  display: flex;
  gap: 14px;
  margin-top: 8px;
}
.social-icon {
  width: 50px;
  height: 50px;
  border-radius: var(--radius);
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text);
}
.social-icon:hover {
  color: var(--accent);
}
.social-icon :deep(svg) {
  width: 22px;
  height: 22px;
}

.scroll-cue {
  margin-top: clamp(28px, 6vw, 48px);
  display: flex;
  justify-content: center;
}
.mouse {
  width: 26px;
  height: 42px;
  border-radius: 14px;
  display: flex;
  justify-content: center;
  padding-top: 7px;
}
.wheel {
  width: 4px;
  height: 8px;
  border-radius: 2px;
  background: var(--accent);
  animation: wheel 1.8s var(--ease) infinite;
}
@keyframes wheel {
  0% { opacity: 0; transform: translateY(-4px); }
  40% { opacity: 1; }
  100% { opacity: 0; transform: translateY(8px); }
}

@media (max-width: 640px) {
  .hero-sig {
    flex-direction: column;
    gap: 10px;
  }
  .sig-text {
    text-align: center;
  }
}
</style>
