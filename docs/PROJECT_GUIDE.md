# 项目导航文档（PROJECT_GUIDE）

> 本文件用于快速定位代码位置、理解架构约定、评估改动影响范围。风格参照 `legacy/game/PROJECT_GUIDE.md`。

---

## 1. 项目概览

| 属性 | 说明 |
|------|------|
| 类型 | 纯前端静态站点（Vue 3 + Vite），无后端、无数据库 |
| 用途 | daum12569 的个人主页（数字客厅）：项目、技能、历程、感谢、联系方式 |
| 设计系统 | 新拟态（Neumorphism）命名，当前阶段为扁平表面 + 多层径向渐变背景；阴影令牌已就绪待启用 |
| 主题系统 | 亮 / 暗双主题，`<html data-theme>` 切换，`localStorage['daum-theme']` 持久化 |
| 图标 | Iconify 离线打包（lucide / phosphor / simple-icons），无运行时 API |
| 部署 | GitHub Pages，push 到 `master` 自动构建（`.github/workflows/deploy.yml`） |
| 许可证 | AGPL-3.0（`LICENSE`） |

---

## 2. 目录结构

```
daum.pw/
├── index.html                 # 入口：字体预载 + 防主题闪烁内联脚本 + #app
├── vite.config.js             # base:'./'（双部署兼容）+ '@' -> src 别名
├── package.json               # name: daum-pw-homepage, version 2.0.0
├── LICENSE                    # AGPL-3.0
├── .github/workflows/deploy.yml  # GitHub Pages CI
├── docs/                      # 项目文档（本文件 + DESIGN_SYSTEM + DEVELOPMENT）
├── legacy/                    # 旧版本归档（Node 服务版 + 小游戏合集），不参与构建
└── src/
    ├── main.js                # createApp(App).mount('#app')，引入 neu.css + icons.js
    ├── App.vue                # 根组件（见 §3.1）
    ├── styles/neu.css         # 【核心】设计系统：令牌 + 主题 + 工具类 + 重置
    ├── plugins/icons.js       # Iconify 图标手动注册（5 个）
    ├── assets/clawd.webm      # ThanksSection 用的 Claude Code 动画
    ├── components/
    │   ├── base/              # 基础组件：NeuCard / NeuButton / NeuChip / NeuIcon
    │   ├── HeroSection.vue
    │   ├── AboutSection.vue
    │   ├── StatsSection.vue
    │   ├── SkillsSection.vue
    │   ├── ProjectsSection.vue
    │   ├── JourneySection.vue
    │   ├── ThanksSection.vue
    │   ├── NowSection.vue
    │   ├── FriendsSection.vue
    │   ├── ContactSection.vue
    │   ├── AppFooter.vue
    │   └── ThemeToggle.vue
    ├── composables/
    │   ├── useTheme.js        # 主题状态单例 + toggle/set
    │   └── useReveal.js       # 滚动入场 IntersectionObserver
    └── data/                  # 内容数据（见 §5）
        ├── projects.js
        ├── signatures.js
        ├── skills.js
        ├── stats.js
        ├── journey.js
        ├── thanks.js
        ├── now.js
        ├── friends.js
        └── social.js
```

---

## 3. 核心机制

### 3.1 应用入口与组件树

`main.js` 创建应用、引入全局样式与图标注册，挂载到 `#app`。

**`App.vue` 当前实际挂载的组件**：

```
<App>
├── <ThemeToggle>          （fixed 浮动开关）
└── <main>
    └── <HeroSection>      （首屏）
</main>
```

> ⚠️ **重要现状**：`About / Stats / Skills / Projects / Journey / Thanks / Now / Friends / Contact / AppFooter` 这 10 个组件文件已完整实现，但**目前并未在 `App.vue` 中引入和渲染**。当前线上页面只展示首屏（Hero）+ 主题开关。如需启用其余区块，在 `App.vue` 中 `import` 并放入 `<main>` 即可（详见 [DEVELOPMENT.md §新增 Section](./DEVELOPMENT.md)）。`useReveal()` 在 `App.vue` 的 `onMounted` 中对全页 `.reveal` 元素生效，新接入的区块会自动获得滚动入场动画。

### 3.2 主题系统

详见 [DESIGN_SYSTEM.md](./DESIGN_SYSTEM.md)。要点：

- 三处代码保持一致：`index.html` 内联脚本（防闪烁）↔ `useTheme.js`（状态 + 持久化）↔ `ThemeToggle.vue`（UI + 光带动画）。
- `localStorage` 键名固定 `daum-theme`，值 `light` | `dark`。
- 切换时 `useTheme.toggle()` 加 `html.theme-transition` 类做全页颜色过渡；`ThemeToggle` 额外叠一道斜向 `clip-path` 光带扫过。

### 3.3 滚动入场（useReveal）

```js
// src/composables/useReveal.js
useReveal(selector = '.reveal', options = {})
```

- 在 `App.vue` `onMounted` 调用一次，给所有 `.reveal` 注册 `IntersectionObserver`（threshold 0.12，rootMargin 下边 -8%）。
- 进入视口加 `.is-visible` 并 `unobserve`（一次性）。
- 不支持 `IntersectionObserver` → 全部直接显示。
- `prefers-reduced-motion: reduce` → CSS 层面把 `.reveal` 直接置为可见。

### 3.4 图标离线打包（icons.js）

```js
// src/plugins/icons.js
import { addIcon } from '@iconify/vue'
addIcon('simple-icons:bilibili', { width, height, ...icons.bilibili })
// ... 共 5 个
```

当前手动注册的图标：

| 图标名 | 来源集 | 许可证 | 用于 |
|--------|--------|--------|------|
| `simple-icons:bilibili` | simple-icons | CC0-1.0 | HeroSection 社交 |
| `simple-icons:github` | simple-icons | CC0-1.0 | HeroSection 社交 |
| `lucide:mail` | lucide | ISC | HeroSection 邮箱 |
| `ph:sun-thin` | phosphor | MIT | ThemeToggle 亮色 |
| `ph:moon-thin` | phosphor | MIT | ThemeToggle 暗色 |

**关键陷阱**：`@iconify-json/*` 的单图标对象通常只含 `body`，宽高在集合顶层。`addIcon()` 不会自动合并，所以必须手动补 `width` / `height`，否则 `viewBox` 退化为 16×16 导致图标被裁切（见 git 历史 `d56085e`）。新增图标时复制现有写法。

### 3.5 签名轮播（HeroSection）

- `signatures` 数据，`index` ref 指向当前条目，`<Transition name="sig" mode="out-in">` 淡入淡出。
- `setInterval(pickRandom, 7000)` 自动切换；`mouseenter` / `focusin` 暂停，离开恢复。
- `pickRandom()` 保证不与当前重复。
- `prefers-reduced-motion` 下不启动定时器，仅手动「换一条」。

---

## 4. 组件速查

### 4.1 基础组件（src/components/base/）

| 组件 | Props | 说明 |
|------|-------|------|
| `NeuCard` | `tag: 'div'`、`size: 'md' \| 'lg'`（lg → `.neu-lg`）、`hover: true`、`press: false` | 凸起卡片底座；用 `<component :is="tag">` 多态 |
| `NeuButton` | `tag: 'button' \| 'a'`、`type: 'button'`、`href: null` | 按钮；`tag='a'` 时绑 `href`；类 `neu-btn neu neu-hover neu-press` |
| `NeuChip` | （无） | 静态标签；类 `neu-chip neu`。筛选按钮请直接用 `.neu` / `.neu-inset` |
| `NeuIcon` | `size: '48px'` | 凸起方形容器托盘，内嵌 svg 取 50% 尺寸、`--accent` 着色；通过 `--icon-size` 控制大小 |

所有基础组件都是「类组合器」：在 `neu.css` 工具类之上加少量 scoped 样式（padding、flex 布局）。

### 4.2 业务组件（src/components/）

| 组件 | `<section id>` | aria-label | 数据源 | 特殊交互 / 备注 |
|------|----------------|------------|--------|------------------|
| `HeroSection` | `hero` | 首页 | `signatures`、`social` | 签名轮播 7s；社交图标 `key==='email'→lucide:mail` 否则 `simple-icons:${key}`；首屏扁平设计 |
| `AboutSection` | `about` | 关于 | 组件内硬编码 `bio` / `overview` | `2fr 1fr` 网格；速览用 `<dl>` |
| `StatsSection` | `stats` | 一些数字 | `stats` | `grad-text` 数值；`transitionDelay: i*0.08s` 错峰入场 |
| `SkillsSection` | `skills` | 技能与折腾 | `skills` | `NeuCard` + `NeuChip` |
| `ProjectsSection` | `projects` | 做过的小玩意 | `projects`、`projectFilters` | 筛选按钮（激活态 `.neu-inset`）+ 搜索框（内联放大镜 svg）；`filtered` computed；`off` 态 `opacity:.7`；hover 显 `->` |
| `JourneySection` | `journey` | 历程 | `journey` | `<ol>` 时间线，`::before` 竖线（`--shadow-dark`）+ `.neu` 圆点；`NeuCard tag="article"` |
| `ThanksSection` | `thanks` | 特别感谢与收藏 | `thanks` | `video:true` → 渲染 `clawd.webm`（`neu-inset` 框，reduced-motion 不自动播）；`icon:'cloud'` → `NeuIcon` + 内联云 svg；`white-space: pre-line` 保留 `\n` |
| `NowSection` | `now` | Now | `now` | `NeuCard size="lg"`；`now-tag` 用 `.neu-inset`；底部「更新于」 |
| `FriendsSection` | `friends` | 友邻 | `friends` | `<a>` 卡片；`mailto:` 不开新页；hover 显 `->` |
| `ContactSection` | `contact` | 找到我 | `contact`（来自 `social.js`） | 居中布局；图标为文字字符（`/` `@` `B`）放 `.neu` 托盘 |
| `AppFooter` | （`<footer>`） | — | 无 | 座右铭 `grad-text` + `© 2026` + 回到顶部 `#hero` |
| `ThemeToggle` | — | 动态「切换到亮/暗色主题」 | `useTheme` | `fixed` 浮动；track+thumb 滑动；斜向光带（见 §3.2） |

> 多数业务组件当前未挂载，见 §3.1 现状说明。

---

## 5. 数据文件清单（src/data/）

| 文件 | 导出 | 结构 | 备注 |
|------|------|------|------|
| `projects.js` | `projects`、`projectFilters` | `[{ num, name, desc, url, status, cat, off? }]` / `[{ key, label }]` | `cat`: `active` / `done` / `pending`；`off` 为真时卡片半透明 |
| `signatures.js` | `signatures` | `[{ line1, line2 }]` | 26 条程序员段子 |
| `skills.js` | `skills` | `[{ category, items[] }]` | ⚠️ 待核对（按项目推断） |
| `stats.js` | `stats` | `[{ value, label }]` | `value` 为字符串（如 `'12'` `'∞'`） |
| `journey.js` | `journey` | `[{ period, title, desc }]` | ⚠️ 待核对（理念性表述） |
| `thanks.js` | `thanks` | `[{ title, desc, icon? \| video? }]` | `video:true` 渲染 `clawd.webm`；`icon:'cloud'` 渲染云图标 |
| `now.js` | `now` | `{ updated, items: [{ text, tag }] }` | ⚠️ 待核对 |
| `friends.js` | `friends` | `[{ name, url, desc }]` | ⚠️ 待填写（当前为占位） |
| `social.js` | `social`、`contact` | `[{ key, name, url }]` / `[{ label, url, icon }]` | `social` 供 HeroSection（`key` 映射图标）；`contact` 供 ContactSection |

数据全部为 ES module 命名导出，纯静态、构建时打包。

---

## 6. 修改影响速查

| 你想改什么 | 应该改哪里 | 影响范围 |
|------------|-----------|----------|
| 增删 / 修改项目 | `src/data/projects.js` | ProjectsSection |
| 增删签名段子 | `src/data/signatures.js` | HeroSection |
| 修改技能分类 | `src/data/skills.js` | SkillsSection |
| 修改统计数字 | `src/data/stats.js` | StatsSection |
| 修改历程时间线 | `src/data/journey.js` | JourneySection |
| 修改感谢 / 收藏 | `src/data/thanks.js` | ThanksSection |
| 修改 Now 列表 | `src/data/now.js` | NowSection |
| 修改友链 | `src/data/friends.js` | FriendsSection |
| 修改社交 / 联系方式 | `src/data/social.js`（`social` + `contact`） | HeroSection + ContactSection |
| 修改「关于」文案 | `src/components/AboutSection.vue`（组件内 `bio` / `overview`） | AboutSection |
| 切换主题配色 | `src/styles/neu.css` 的 `[data-theme]` 块 | 全站 |
| 恢复新拟态阴影 | `src/styles/neu.css` 的 `.neu` / `.neu-inset` 补 `box-shadow` | 全站表面 |
| 新增图标 | `src/plugins/icons.js` `addIcon`（手动补 width/height）+ 确认对应 `@iconify-json/*` 已装 | 用到该图标的组件 |
| 启用未挂载的 Section | `src/App.vue` 引入并放入 `<main>` | 全站结构 |
| 调整区块顺序 | `src/App.vue` | 全站 |
| 修改部署流程 | `.github/workflows/deploy.yml` | CI |
| 修改构建（别名 / base / target） | `vite.config.js` | 全站构建 |

---

## 7. 注意事项与陷阱

1. **多数 Section 组件未挂载**：`App.vue` 当前仅渲染 `ThemeToggle` + `HeroSection`。`About / Stats / Skills / Projects / Journey / Thanks / Now / Friends / Contact / AppFooter` 已实现但未引入。这是当前最需要注意的现状，接入方法见 [DEVELOPMENT.md](./DEVELOPMENT.md)。
2. **表面工具类当前扁平**：`.neu` / `.neu-lg` / `.neu-inset` 只有 `background` + `border-radius`，无 `box-shadow`。新拟态阴影令牌（`--shadow-light` / `--shadow-dark` / `--dist` / `--blur`）已定义但未应用。详见 [DESIGN_SYSTEM.md §5](./DESIGN_SYSTEM.md#5-重新启用新拟态阴影待办)。
3. **图标必须手动补 viewBox**：`icons.js` 中 `addIcon()` 需手动展开集合顶层的 `width` / `height`，否则图标被裁切。新增图标复制现有写法。
4. **`social.js` 导出两份数据**：`social`（带 `key`，供 HeroSection 图标映射）与 `contact`（带文字 `icon`，供 ContactSection）。改联系方式时两处都要看。
5. **数据文件多处待核对**：`skills.js` / `journey.js` / `now.js` / `friends.js` 源码带 `⚠️ 待核对/待填写` 注释，上线前应替换为真实内容。
6. **`useReveal` 一次性绑定**：它在 `App.vue` `onMounted` 时 `querySelectorAll('.reveal')` 一次性注册。若后续动态加载含 `.reveal` 的内容，需再次调用 `useReveal()` 或手动观察。
7. **`legacy/` 不参与构建**：旧版本（Node 服务版 + 小游戏合集）仅作归档，与当前 Vue 3 版独立。小游戏合集有自己的 `legacy/game/PROJECT_GUIDE.md`。
8. **相对 `base` 的代价**：`base: './'` 让产物用相对路径，兼容自定义域与项目页；但深路径下刷新依赖服务端正确回退到 `index.html`（GitHub Pages 默认支持）。
9. **`prefers-reduced-motion` 多处尊重**：主题过渡、光带、签名轮播、Thanks 视频自动播放、CSS 动画时长均在降级下关闭 / 跳过。新增动效时请同步处理。

---

*文档对应：`master` 分支，Vue 3 重写版（package.json v2.0.0）。*
