# 开发指南（DEVELOPMENT）

> 本地开发、内容维护、新增区块、图标扩展与部署流程。架构与定位见 [PROJECT_GUIDE.md](./PROJECT_GUIDE.md)，样式令牌见 [DESIGN_SYSTEM.md](./DESIGN_SYSTEM.md)。

## 1. 环境要求

| 依赖 | 版本 |
|------|------|
| Node.js | ≥ 18（CI 使用 20） |
| npm | 随 Node 附带 |

无后端、无数据库，克隆后 `npm install` 即可。

## 2. 脚本

```bash
npm install      # 安装依赖
npm run dev      # 本地开发，默认 http://localhost:5173
npm run build    # 生产构建，输出到 dist/
npm run preview  # 本地预览构建产物
```

`package.json` 仅三个脚本，无额外工具链（无 lint / test / format 配置）。

## 3. 路径别名

`vite.config.js` 配置了 `@` -> `src`：

```js
import { useTheme } from '@/composables/useTheme'
import { projects } from '@/data/projects'
import NeuCard from '@/components/base/NeuCard.vue'
```

全项目统一用 `@/` 引用 src 内模块，避免相对路径层级混乱。

## 4. 维护内容数据

绝大多数文案内容在 `src/data/` 下，改数据即可，无需动组件。各文件结构与字段见 [PROJECT_GUIDE.md §5](./PROJECT_GUIDE.md#5-数据文件清单srcdata)。

示例--增删一个项目（`src/data/projects.js`）：

```js
export const projects = [
  // ...
  { num: '13', name: '新项目', desc: '一句话描述', url: 'https://x.daum.pw', status: '已上线', cat: 'done' },
]
```

- `cat` 必须是 `active` / `done` / `pending` 之一（与 `projectFilters` 的 `key` 对应），否则筛选取不到。
- `status` 是展示文案，可自定义。
- 设 `off: true` 会让卡片半透明（用于「跑路了」的项目）。

示例--加一条签名（`src/data/signatures.js`）：

```js
{ line1: '第一行', line2: '第二行' }
```

> ⚠️ `skills.js` / `journey.js` / `now.js` / `friends.js` 带有「待核对 / 待填写」注释，上线前务必替换为真实内容。

## 5. 新增 / 启用 Section

### 5.1 启用已实现但未挂载的区块

当前 `App.vue` 仅渲染 `ThemeToggle` + `HeroSection`。`About / Stats / Skills / Projects / Journey / Thanks / Now / Friends / Contact / AppFooter` 已实现，启用只需在 `App.vue` 引入：

```vue
<template>
  <ThemeToggle class="theme-floating" />
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
    <AppFooter />
  </main>
</template>

<script setup>
import ThemeToggle from './components/ThemeToggle.vue'
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
```

顺序即页面顺序；`AppFooter` 放最后。`useReveal()` 在 `onMounted` 一次性绑定全页 `.reveal`，新接入的区块会自动获得滚动入场动画，无需额外处理。

### 5.2 新建一个全新 Section

1. **建数据文件**（可选）：`src/data/xxx.js`，命名导出数组 / 对象。
2. **建组件**：`src/components/XxxSection.vue`，最小模板：

```vue
<template>
  <section id="xxx" class="section" aria-label="区块名">
    <div class="container">
      <header class="section-head reveal">
        <span class="section-tag">·</span>
        <div>
          <h2 class="section-title">区块名</h2>
          <p class="section-sub">一句话说明</p>
        </div>
      </header>

      <!-- 内容：用 NeuCard / .neu / .neu-inset 等工具类 -->
      <NeuCard class="reveal">
        <p>内容</p>
      </NeuCard>
    </div>
  </section>
</template>

<script setup>
import NeuCard from '@/components/base/NeuCard.vue'
// import { xxx } from '@/data/xxx'
</script>

<style scoped>
/* 区块专属样式；颜色/圆角/间距尽量用 neu.css 令牌 */
</style>
```

3. **挂载**：在 `App.vue` `import` 并放入 `<main>`（见 §5.1）。
4. **（可选）回到顶部锚点**：`AppFooter` 的「回到顶部」指向 `#hero`；如需锚点导航可自行加导航条链接到各 `section id`。

约定：
- `<section>` 必须有 `id`（锚点）和 `aria-label`（无障碍）。
- 标题行用 `.section-head.reveal` + `.section-tag` + `.section-title` + `.section-sub`，与现有区块一致。
- 内容容器加 `.reveal` 获得入场动画。
- 颜色、圆角、间距用 `neu.css` 令牌（`var(--accent-text)` 等），避免硬编码。

## 6. 新增图标

图标通过 `src/plugins/icons.js` 手动 `addIcon` 离线注册，不走运行时 API。

1. 确认对应图标集已安装（`package.json` 依赖：`@iconify-json/lucide` / `ph` / `simple-icons`）。如需新集，`npm i -D @iconify-json/xxx`。
2. 在 `icons.js` 仿照现有写法注册：

```js
import { addIcon } from '@iconify/vue'
import { icons as lucide } from '@iconify-json/lucide'

addIcon('lucide:arrow-up', {
  width: lucide.width,
  height: lucide.height,
  ...lucide.icons['arrow-up'],
})
```

3. 使用：`<Icon icon="lucide:arrow-up" width="22" height="22" />`（`Icon` 来自 `@iconify/vue`）。

> 必须手动展开集合顶层的 `width` / `height`，否则 `viewBox` 退化为 16×16 导致裁切（见 git `d56085e`）。

## 7. 主题与样式定制

- **改配色**：编辑 `src/styles/neu.css` 的 `:root, [data-theme='light']` 与 `[data-theme='dark']` 块中的 CSS 变量。全站通过 `var(--*)` 引用，改一处即全局生效。
- **恢复新拟态阴影**：见 [DESIGN_SYSTEM.md §5](./DESIGN_SYSTEM.md#5-重新启用新拟态阴影待办)。
- **新增工具类**：尽量加在 `neu.css` 全局，而非组件 scoped 样式，便于复用。
- **字体**：`index.html` 的 Google Fonts `<link>` 控制加载的字重；`--font-display` / `--font-body` 控制应用。

## 8. 部署

### 8.1 自动部署（GitHub Pages）

push 到 `master`（或 `main`）即触发 `.github/workflows/deploy.yml`：

1. `actions/checkout@v4`
2. `actions/setup-node@v4`（Node 20，`cache: npm`）
3. `npm ci`
4. `npm run build`
5. `actions/configure-pages@v5` -> `actions/upload-pages-artifact@v3`（上传 `dist/`）
6. `actions/deploy-pages@v4` 发布

需在仓库 **Settings -> Pages -> Build and deployment** 选 *GitHub Actions* 作为 Source。`permissions` 已在 workflow 中声明 `pages: write` + `id-token: write`。

### 8.2 双部署兼容（base: './'）

`vite.config.js` 用相对 `base: './'`，产物内资源路径为相对路径。因此同一份 `dist/`：

- 自定义域 `daum.pw`（根路径）：正常工作
- 项目页 `daum110715.github.io/daum.pw/`（子路径）：也正常工作

无需为两种部署分别构建。代价：深路径直接刷新依赖服务端回退到 `index.html`（GitHub Pages 默认支持）。

### 8.3 自定义域

仓库 **Settings -> Pages -> Custom domain** 配置 CNAME，DNS 将 `daum.pw` 指向 GitHub Pages。GitHub 会在构建产物中自动处理 CNAME 文件。

### 8.4 本地预览构建产物

```bash
npm run build
npm run preview   # 默认 http://localhost:4173，模拟生产环境
```

`preview` 用 Vite 内置预览服务器，行为接近生产（相对路径、压缩后的资源）。

## 9. 常见任务速查

| 任务 | 做法 |
|------|------|
| 改项目 / 技能 / 历程等文案 | 改 `src/data/*.js` |
| 改「关于」文案 | 改 `AboutSection.vue` 内的 `bio` / `overview` |
| 让页面显示更多区块 | 在 `App.vue` 引入并放入 `<main>`（见 §5.1） |
| 加新页面区块 | 新建组件 + 数据 + 挂载（见 §5.2） |
| 换主题色 | 改 `neu.css` 的 `[data-theme]` 变量 |
| 加图标 | `icons.js` `addIcon`（见 §6） |
| 本地调试 | `npm run dev` |
| 验证生产构建 | `npm run build && npm run preview` |
| 上线 | push 到 `master`，CI 自动部署 |
