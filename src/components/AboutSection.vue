<template>
  <section id="about" class="section" aria-label="关于">
    <div class="container">
      <header class="section-head reveal">
        <span class="section-tag">·</span>
        <div>
          <h2 class="section-title">关于</h2>
          <p class="section-sub">数字客厅的主人</p>
        </div>
      </header>

      <div class="about-grid">
        <div class="about-bio neu-lg reveal">
          <p v-for="(p, i) in bio" :key="i">{{ p }}</p>
        </div>

        <aside class="about-overview neu reveal">
          <h3 class="overview-title">速览</h3>
          <dl class="overview-list">
            <div v-for="row in overview" :key="row.k" class="overview-row">
              <dt class="text-dim">{{ row.k }}</dt>
              <dd>{{ row.v }}</dd>
            </div>
          </dl>
        </aside>
      </div>
    </div>
  </section>
</template>

<script setup>
// bio 可编辑
const bio = [
  '这里是 daum12569 的数字客厅。把散落各处的小玩意儿拢到一起--有的还在跑,有的早跑路了。',
  '白天写代码,深夜也写代码。喜欢把奇怪的想法做成能用的小工具:加解密、短链、交易查看器、AI 小应用,甚至赛博墓碑。',
  '不追求宏大,只追求"它跑起来了,还挺好玩"。',
]

// 速览键值,可编辑
const overview = [
  { k: '身份', v: '业余造物者' },
  { k: '域名', v: 'daum.pw' },
  { k: '状态', v: '持续构建中' },
]
</script>

<style scoped>
.about-grid {
  display: grid;
  grid-template-columns: 2fr 1fr;
  gap: 18px;
  align-items: start;
}
.about-bio {
  padding: clamp(24px, 4vw, 36px);
}
.about-bio p {
  line-height: 1.8;
  font-size: 1rem;
}
.about-bio p + p {
  margin-top: 18px;
}
.about-overview {
  padding: clamp(20px, 3vw, 28px);
}
.overview-title {
  font-size: 1.05rem;
  margin-bottom: 16px;
}
.overview-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.overview-row {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 12px;
}
.overview-row dt {
  font-size: 0.88rem;
}
.overview-row dd {
  font-size: 0.92rem;
  font-weight: 500;
}

@media (max-width: 640px) {
  .about-grid {
    grid-template-columns: 1fr;
  }
}
</style>
