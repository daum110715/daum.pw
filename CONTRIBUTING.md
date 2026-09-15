# 代码规范

daum.pw 的协作约定。本文档只记录**已在本仓库落地的惯例**，新增代码请与现状保持一致；改动惯例时同步更新本文档。

## 技术栈

- Vue 3（Composition API，`<script setup lang="ts">`）+ TypeScript（strict）+ Vite 5，纯静态站点，无后端
- GSAP ScrollTrigger 驱动滚动叙事；WAAPI（`el.animate`）驱动一次性补间
- 图标：Iconify Vue（`@iconify/vue`，见 `src/plugins/icons.ts`）
- 托管：Cloudflare Pages（`wrangler.toml`），无 lint/格式化工具链（以本文件为准）；类型检查走 `npm run typecheck`（已并入 build）

## 目录结构

```
index.html          首帧内联样式 + preloader 静态副本(首帧不能等 ESM)
src/
  main.ts           入口:锁顶 → 挂载 → 虹膜 → boot 调度(描边→飞行→变形→分裂)
  boot/             开屏编排模块(timing/domFx/scrollLock/legacyVeil/toggleMorph/veilSplit/finishBoot/handoff)
  App.vue           页面骨架与分页
  components/       HeroSection / PagePager / PageSection / ThemeToggle / BrandSection
  composables/      跨组件共享状态与逻辑(brandDock / useTheme / useReveal / useCanvas2D /
                    useHeroDock / useSocialDock / useLegacyVeil / useBeamMerge / useBeamGrow)
  data/             静态数据(social 链接、品牌字形 SSOT)
  plugins/          全局注册(图标)
  styles/neu.css    唯一设计系统:tokens、主题、reset、全局元件
legacy/             旧版静态页,不受本规范约束,别再往里加东西
```

## 注释

- 一律中文；注释解释**为什么**，不复述代码在做什么
- 复杂时序/动效模块用横幅注释分节：

```js
/* ============================================================
 * 小节标题
 * 背景/根因 → 方案 → 关键约束,多行对齐
 * ============================================================ */
```

- 函数级用 JSDoc `/** */`；行内补充用 `/* */`，可跟随在语句后
- 修过的坑要把**根因**留在注释里（例：`boot/handoff.ts` 开屏衔接方案 D 的根因记录），防止后人回退成旧方案

## TypeScript

- ESM；单引号、不加分号（与现有文件一致）
- `tsconfig.json` 开 strict：标注以推断优先，能推断不写；DOM 查询用 `querySelector<HTMLElement>` 泛型 + 判空守卫，不裸 `as`、不裸 `any`
- `env.d.ts` 只管全局声明（`vite/client`、`window.__*` 兜底）；文件级接口就近写在各自模块并导出
- 常量大写蛇形并带单位后缀：`MOVE_MS`、`TARGET_FS`、`SOC_FADE_STAGGER_MS`
- 跨组件共享状态放 `composables/`，用模块单例 `ref`（例：`brandDock.ts` 的 `bootDone`、`useTheme.ts` 的 `theme`），不要挂 `window`——已存在的 `window.__finishBoot` 等是历史兜底，新代码勿效仿
- DOM 访问必须防御：元素可能不存在（非首页路径、兜底分支），先判空再用
- 异步时序兜底三件套：`transitionend` + `setTimeout` 双通道、`requestAnimationFrame` + `setTimeout(50)` 双通道（`nextFrame`）、所有 WAAPI `finished` 接 `.catch(() => {})`

## 动效（本仓库最敏感的部分）

1. **只动合成属性**：飞行/变形用 `transform` + WAAPI 几何插值（`boxKeyframes`），禁止逐帧改 `left/top/width/font-size`（会 layout + 重栅格，必抖）
2. **同源交接**：两处视觉若是同一东西，必须用同一份渲染源（例：preloader 与 Hero 共用 `BRAND_PATHS` SVG），跨渲染管线（HTML↔SVG）对齐是死路
3. **假层接管**：过渡用 body 级 fixed 假层（`pinFixedBox`），落地同帧「亮真身 + 卸假层」，同一 JS 任务内完成，不留已绘制帧
4. **WAAPI 收尾必须钉终态再 `cancel()`**：`fill:'forwards'` 的残留不随布局更新
5. **零跳变交接**：接管双方同位同色；颜色不一致时先同色再起幕，而不是靠颜色动画过渡
6. `prefers-reduced-motion`：所有动效路径都要有跳过分支
7. 滚动驱动的 pin/scrub 期间禁止 `scroll-behavior: smooth`（neu.css 已全局 `auto`，勿改）

## CSS

- 设计令牌集中在 `neu.css` 的 `:root` / `[data-theme]`：**颜色一律 `var(--token)`，禁止写死色值**；深浅双主题必须同时定义
- 色值派生用 `color-mix(in srgb, ...)`，不写第三份近似色
- 组件样式写在 SFC `<style>` 内，跨组件深度选择用 `:deep()`
- 命名：kebab-case，语义化（`.hero-social`、`.boot-veil-piece`）

### z-index 层级表（占用即登记）

| 层级 | 用途 |
| --- | --- |
| 40 | 社交横梁 .social-beam(body 级 fixed,钉在 hero 原位,待下页接管) |
| 50 | PagePager tab 栏 |
| 55 / 60 | Hero section / Hero 标题(盖 pager 数字) |
| 70 | App 级浮层 |
| 9998 | boot veil / 社交底块假块 |
| 9999 | #preloader / Hero 内临时浮层 |
| 10002 / 10003 | 进度条轨道 / 填充变形假层 |
| 10004 | 品牌字飞行克隆 |
| 10010 | 旧版回流到达幕布 body::after |

## 双端同步点（改了 A 必须改 B）

| 数据 | A | B | 保障 |
| --- | --- | --- | --- |
| 品牌字形 path | `src/data/brandGlyph.ts` | `index.html` 内联 preloader SVG | `boot/domFx.ts` `assertBrandSync` dev 断言 |
| `--brand-ink` 等主题变量 | `neu.css` | `index.html` head 内联副本 | 人工，首帧不能等 CSS |
| body 背景渐变 | `neu.css` `body` | `index.html` head 内联 `body` | 人工，首帧兜底 |

**禁止**把主题色写进 `html` 内联 style 钉死（会盖住 `data-theme` 切换），主题色只能由 CSS 变量承载。

## Vue 组件

- Composition API + 模块级常量表驱动时序（毫秒常量集中在文件顶部）
- 生命周期清理成对出现：`IntersectionObserver` / 事件监听 / `setTimeout` 在 `onUnmounted` 或播完收尾中释放
- 动效播完清全部内联样式 + `cancel()` WAAPI，**DOM 交还纯净**，后续 hover/dock 零残留

## 文件体量红线（防止往单文件堆代码）

本项目不是单文件小脚本——开屏动效编排、滚动叙事、主题系统都是独立关注点，**新功能默认新建文件或抽入 `composables/`，而不是塞进已有大文件**。

| 体量 | 规则 |
| --- | --- |
| ≤ 400 行 | 健康区间 |
| 400–800 行 | 警戒线：新功能不得再往里加，只做针对性修复 |
| > 800 行 | 红线：禁止堆新功能；改动时顺手把相关逻辑块抽成独立模块 |

- 拆分去向：跨组件状态/逻辑 → `composables/use*.ts`；静态数据 → `data/`；独立 UI → `components/`；纯工具函数 → 就近新建模块
- 拆分原则按**关注点**切（一块代码回答「我管什么」只能有一个答案），不按「第几百行切一刀」
- 历史超标已拆分：原 `main.ts`（~940 行）→ `boot/` 8 模块 + ~55 行入口；原 `HeroSection.vue`（~1200 行）→ `useHeroDock.ts` / `useSocialDock.ts` / `useLegacyVeil.ts` + ~400 行 SFC。`useHeroDock.ts`/`useSocialDock.ts` 仍处警戒线——只做针对性修复，新功能另立模块

## 术语表（动效资产命名，注释/代码统一用这套）

| 术语 | 含义 | 代码 |
| --- | --- | --- |
| veil（幕布） | 开屏 loading 的全屏背景层 | `.boot-veil`（`boot/handoff.ts`） |
| bar（横梁） | 合并态的整条圆角长方形。开屏 = veil 收回态（`barRect`）；滚动 = 社交底块合并态（`.social-beam`，`useBeamMerge.ts`） | — |
| pieces（假块） | bar 分裂成的 5 个图标底块（动画期假层） | `.boot-veil-piece`（`boot/veilSplit.ts`） |
| beamDock | 横梁钉视口后的状态/接管入口（下一页变形用） | `useBeamMerge.ts` 导出 |
| bake（烘焙） | 动画末帧把元素提升为 body 级 fixed 钉住 | `bakeSocDock` / `bake` |

## 提交前

- `npm run build` 必须通过
- 动了开屏/动效路径：浅色 + 深色主题各过一遍完整 boot，再测一次非首页刷新（滚动恢复路径）
- `dist/` 是构建产物，不提交改动说明之外的用途
