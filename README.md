# daum.pw

> daum12569 的数字客厅 -- 一个新拟态（Neumorphism）风格的个人主页。
> 项目、技能、历程、感谢、联系方式，持续学习，持续构建。

🌐 在线访问：<https://daum.pw>（自定义域）/ <https://daum110715.github.io/daum.pw/>（项目页）

## 特性

- **新拟态设计系统** -- 纯 CSS 设计令牌 + 工具类（`src/styles/neu.css`），统一卡片 / 按钮 / 标签质感。当前阶段为扁平表面 + 柔和的多层径向渐变背景，新拟态阴影令牌（`--shadow-light` / `--shadow-dark`）已定义、待重新启用（见 [DESIGN_SYSTEM.md](./docs/DESIGN_SYSTEM.md)）。
- **亮 / 暗双主题** -- `index.html` 首帧前内联脚本按 `localStorage` / 系统偏好设定 `data-theme`，**防主题闪烁**；切换时一道斜向光带扫过页面、颜色平滑过渡，并尊重 `prefers-reduced-motion`。
- **滚动入场动画** -- `useReveal` 基于 `IntersectionObserver`，元素进入视口时淡入上浮，不支持时降级为直接显示。
- **签名轮播** -- Hero 区每 7 秒切换一条程序员段子，hover / focus 暂停，`prefers-reduced-motion` 下不自动播放。
- **项目筛选与搜索** -- 按状态分类筛选 + 关键词搜索，实时过滤项目卡片。
- **图标离线打包** -- 通过 `@iconify-json/*` 本地按需注册 lucide / phosphor / simple-icons，无需运行时请求图标 API。
- **双部署兼容** -- `vite` 使用相对 `base: './'`，同一份构建产物同时适配自定义域（根路径）与项目页（子路径）。
- **自动部署** -- push 到 `master` 即触发 GitHub Actions 构建并发布到 GitHub Pages。

## 技术栈

| 类别 | 选型 |
|------|------|
| 框架 | Vue 3（`<script setup>`） |
| 构建 | Vite 5 |
| 图标 | Iconify（`@iconify/vue` + `@iconify-json/lucide` / `ph` / `simple-icons`） |
| 样式 | 纯 CSS 设计系统（无 UI 库） |
| 部署 | GitHub Pages + GitHub Actions |

## 快速开始

```bash
npm install      # 安装依赖
npm run dev      # 本地开发  http://localhost:5173
npm run build    # 构建到 dist/
npm run preview  # 本地预览构建产物
```

> 要求 Node.js ≥ 18（CI 使用 20）。无后端、无数据库，纯静态站点。

## 项目结构

```
daum.pw/
├─ index.html              # 入口 HTML（含防主题闪烁内联脚本、字体预载）
├─ vite.config.js          # 相对 base + @ 别名
├─ .github/workflows/      # GitHub Pages 自动部署
├─ src/
│  ├─ main.js              # 应用入口
│  ├─ App.vue              # 根组件（挂载 ThemeToggle + HeroSection）
│  ├─ styles/neu.css       # 【核心】设计系统：令牌 + 工具类 + 主题
│  ├─ plugins/icons.js     # Iconify 离线图标注册
│  ├─ components/
│  │  ├─ base/             # NeuCard / NeuButton / NeuChip / NeuIcon
│  │  └─ *.vue             # Hero/About/Stats/Skills/Projects/Journey/Thanks/Now/Friends/Contact/Footer/ThemeToggle
│  ├─ composables/         # useTheme / useReveal
│  ├─ assets/              # 静态资源（clawd.webm）
│  └─ data/                # 内容数据（项目/签名/技能/统计/历程/感谢/Now/友邻/社交）
├─ legacy/                 # 旧版本归档（Node 服务版 + 小游戏合集）
└─ docs/                   # 项目文档
```

## 文档

更深入的说明见 [`docs/`](./docs)：

| 文档 | 内容 |
|------|------|
| [PROJECT_GUIDE.md](./docs/PROJECT_GUIDE.md) | 项目导航：目录详解、核心机制、组件速查表、修改影响速查、陷阱 |
| [DESIGN_SYSTEM.md](./docs/DESIGN_SYSTEM.md) | 设计系统：设计令牌、工具类、主题切换、动画 |
| [DEVELOPMENT.md](./docs/DEVELOPMENT.md) | 开发指南：环境、脚本、扩展数据、新增 Section、CI/CD 部署 |

## 部署

站点通过 GitHub Actions 自动部署到 GitHub Pages（见 [`.github/workflows/deploy.yml`](./.github/workflows/deploy.yml)）：

1. push 到 `master`（或 `main`）分支
2. CI 安装依赖 -> `npm run build` -> 上传 `dist/` 产物
3. 发布到 GitHub Pages

`vite.config.js` 中 `base: './'` 使产物使用相对路径，因此**同一份构建**既能跑在自定义域 `daum.pw`（根路径），也能跑在项目页 `daum110715.github.io/daum.pw/`（子路径），无需为两种部署分别构建。

如需自定义域，在仓库 Settings -> Pages 中配置 CNAME 即可。

## 浏览器支持

面向现代浏览器（Chrome / Edge / Firefox / Safari 近两年版本）。用到 `IntersectionObserver`、CSS 自定义属性、`color-mix()` 等特性；`useReveal` 在不支持 `IntersectionObserver` 的环境会降级为直接显示，动画在 `prefers-reduced-motion: reduce` 下基本关闭。

## 旧版本

历史版本归档于 [`legacy/`](./legacy)：早期为 Node 服务版个人主页，内含一个小游戏合集（8 款经典游戏，独立 `PROJECT_GUIDE.md`）。当前 `master` 根目录是 Vue 3 重写版，与 `legacy/` 相互独立、不参与构建。

## 许可证

[GNU Affero General Public License v3.0](./LICENSE)（AGPL-3.0）。沿用旧版本的协议选择。
