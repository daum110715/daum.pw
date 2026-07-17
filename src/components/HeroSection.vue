<template>
  <section id="hero" class="section hero" aria-label="首页">
    <div class="container hero-inner">
      <h1 class="hero-title reveal">
        <span class="grad-text">daum12569</span>
      </h1>
      <p class="hero-role reveal">用好奇心建造,用时间打磨</p>

      <div
        class="hero-sig reveal"
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
        <button class="sig-next" aria-label="换一条签名" @click="next">
          // 换一条
        </button>
      </div>

      <div class="hero-social reveal">
        <a
          v-for="s in social"
          :key="s.url"
          :href="s.url"
          class="social-icon"
          :aria-label="s.name"
          :target="s.url.startsWith('mailto:') ? undefined : '_blank'"
          rel="noopener"
        >
          <Icon
            :icon="s.key === 'email' ? 'lucide:mail' : `simple-icons:${s.key}`"
            width="22"
            height="22"
          />
        </a>
      </div>

    </div>
  </section>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { Icon } from '@iconify/vue'
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
  if (!reducedMotion.value) resetTimer()
}

onMounted(() => {
  reducedMotion.value =
    window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches
  pickRandom()
  if (!reducedMotion.value) resetTimer()
})
onUnmounted(() => timer && clearInterval(timer))

</script>

<style scoped>
/* 首屏用扁平设计(实色填充 + 边框)而非新拟态阴影,风格在滚动后才揭晓 */
.hero {
  min-height: 92vh;
  display: flex;
  align-items: center;
  padding-top: clamp(80px, 14vw, 140px);
}
.hero-inner {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  text-align: left;
  gap: 22px;
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
  background: var(--bg-2);
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
  background: var(--accent-soft);
  color: var(--accent-text);
  font-size: 0.8rem;
  font-family: var(--font-display);
  font-weight: 600;
  white-space: nowrap;
  padding: 8px 14px;
  border-radius: var(--radius-full);
  transition: background var(--dur) var(--ease);
}
.sig-next:hover {
  background: rgba(245, 184, 66, 0.26);
}

.hero-social {
  display: flex;
  gap: 12px;
  margin-top: 8px;
}
.social-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 48px;
  height: 48px;
  border-radius: var(--radius);
  background: var(--bg-2);
  color: var(--text);
  overflow: visible;
  transition:
    color var(--dur) var(--ease),
    background var(--dur) var(--ease);
}
.social-icon:hover {
  color: var(--accent);
  background: var(--accent-soft);
}
.social-icon :deep(svg) {
  width: 22px;
  height: 22px;
  overflow: visible;
}

@media (max-width: 640px) {
  .hero-sig {
    flex-direction: column;
    gap: 10px;
  }
  .sig-text {
    text-align: left;
  }
}
</style>
