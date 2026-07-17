# 设计系统（neu.css）

> `src/styles/neu.css` 是全站唯一的样式来源：设计令牌 + 主题 + 工具类 + 基础重置。无 UI 库、无 CSS-in-JS、无预处理器。

## 1. 当前阶段说明

文件以「新拟态（Neumorphism）」命名并预留了完整的阴影令牌，但**表面工具类当前是扁平的**——`.neu` / `.neu-lg` / `.neu-inset` 只设置 `background` 与 `border-radius`，未应用 `box-shadow`。源码注释原文：

```
/* ---------- Surface utilities (currently flat; neumorphism to be re-added later) ---------- */
```

视觉质感当前来自 `body` 上的多层径向渐变背景 + 卡片底色（`--bg-2`）与页面底色（`--bg`）的对比。如需恢复新拟态阴影，见 [§5 重新启用阴影](#5-重新启用新拟态阴影待办)。

## 2. 设计令牌

所有令牌定义在 `:root`，主题色在 `[data-theme]` 块中覆盖。

### 2.1 字体

| 令牌 | 值 | 用途 |
|------|----|------|
| `--font-display` | `'Outfit', 'Noto Sans SC', sans-serif` | 标题、数字、强调 |
| `--font-body` | `'Noto Sans SC', 'Outfit', sans-serif` | 正文 |

字体通过 `index.html` 的 Google Fonts `<link>` 预载（Outfit 400–800 / Noto Sans SC 400–700），并 `preconnect` 到 `fonts.googleapis.com` / `fonts.gstatic.com`。

### 2.2 圆角

| 令牌 | 值 |
|------|----|
| `--radius-sm` | 12px |
| `--radius` | 18px |
| `--radius-lg` | 24px |
| `--radius-xl` | 32px |
| `--radius-full` | 9999px |

### 2.3 过渡

| 令牌 | 值 |
|------|----|
| `--dur` | 0.35s |
| `--ease` | `cubic-bezier(0.4, 0, 0.2, 1)` |

### 2.4 布局

| 令牌 | 值 | 用途 |
|------|----|------|
| `--maxw` | 1120px | `.container` 最大宽度 |
| `--pad` | `clamp(20px, 5vw, 48px)` | 容器左右内边距 |
| `--section-gap` | `clamp(64px, 10vw, 120px)` | 区块间距（预留） |

### 2.5 新拟态阴影参数（已定义、当前未使用）

| 令牌 | 值 |
|------|----|
| `--dist` | 3px |
| `--blur` | 8px |
| `--dist-lg` | 5px |
| `--blur-lg` | 12px |

配合主题色 `--shadow-light` / `--shadow-dark`（见下）即可拼出双向阴影。

## 3. 主题色

亮色为默认（`:root` 与 `[data-theme='light']`），暗色在 `[data-theme='dark']` 覆盖。每个 `[data-theme]` 块同时设 `color-scheme` 以同步原生控件（滚动条、表单等）。

| 令牌 | 亮色 | 暗色 | 说明 |
|------|------|------|------|
| `--bg` | `#f5f2ec` | `#2b2e35` | 页面底色 |
| `--bg-2` | `#fffcfa` | `#31343c` | 卡片 / 凸起表面底色 |
| `--text` | `#3a3a3a` | `#e8e8ec` | 正文 |
| `--text-dim` | `#7d7a75` | `#9a9aa3` | 次要文字 |
| `--accent` | `#9fb4cc`（柔和灰蓝） | `#f5b842`（金） | 主强调色 |
| `--accent-2` | `#d8a47f`（柔和桃） | `#e8723a`（橙） | 渐变第二色 |
| `--accent-text` | `#5c6f7f` | `#f5b842` | 浅底强调文字（保证对比度） |
| `--accent-soft` | `rgba(159,180,204,.16)` | `rgba(245,184,66,.14)` | 强调色低透明填充 |
| `--shadow-light` | `#ffffff` | `#363a42` | 阴影亮边 |
| `--shadow-dark` | `#d7d4cc` | `#21242b` | 阴影暗边 |
| `--ring` | `rgba(159,180,204,.5)` | `rgba(245,184,66,.55)` | 聚焦环（预留） |

> 暗色主题的 `--accent` 由亮色的灰蓝切换为暖金，是有意的「昼冷夜暖」对比。

## 4. 主题切换机制

主题切换涉及三处代码，逻辑必须保持一致：

| 位置 | 职责 |
|------|------|
| `index.html` 内联 `<script>` | **首帧前**读 `localStorage['daum-theme']` > 系统偏好 > `light`，写 `data-theme`，防闪烁 |
| `src/composables/useTheme.js` | 模块单例 `theme` ref；`toggle()` / `set(t)`；`watch` 同步 DOM + 持久化 |
| `src/components/ThemeToggle.vue` | 浮动开关 UI；切换时叠加斜向光带动画 |

### 4.1 防闪烁

`index.html` 的内联脚本在 Vue 挂载前就设定了 `<html data-theme="...">`，避免页面先以默认主题渲染再跳变。`useTheme` 初始化时复用同一套优先级逻辑，保证 SSR/CSR 一致。

### 4.2 切换过渡

`useTheme.toggle()` 在非 `prefers-reduced-motion` 下：

1. 给 `<html>` 加 `theme-transition` 类
2. 下一帧（`requestAnimationFrame`）翻转 `theme.value`
3. 450ms 后移除 `theme-transition` 类

`html.theme-transition` 选择器临时给**全页所有元素**的 `background-color` / `background-image` / `color` / `border-color` / `fill` / `stroke` / `transform` / `opacity` / `clip-path` 加 0.4s 过渡（`!important`），让主题色平滑切换而非瞬变。

### 4.3 斜向光带（ThemeToggle）

`toggleWithTransition()` 在切换瞬间创建一个临时 `<div>` 覆盖全屏：

- `background: linear-gradient(90deg, transparent, rgba(159,180,204,.35), transparent)`
- `clip-path` 从左侧屏外（`polygon(-20% 0, 0 0, -20% 100%, -40% 100%)`）动画到右侧屏外
- 0.45s 扫过后 `transitionend` 自移除（并有 550ms 兜底 `setTimeout`）
- `pointer-events: none`，不阻塞交互

光带颜色用的是亮色主题的灰蓝 `rgba(159,180,204,...)`，在两种主题下都可见。

### 4.4 持久化

`localStorage` 键名固定为 `daum-theme`，值 `'light'` | `'dark'`。`useTheme` 与 `index.html` 内联脚本必须使用同一键名。

## 5. 重新启用新拟态阴影（待办）

令牌已就绪，恢复阴影只需给表面工具类补 `box-shadow`。参考写法：

```css
/* 凸起表面 */
.neu {
  background: var(--bg-2);
  border-radius: var(--radius);
  box-shadow:
    var(--dist) var(--dist) var(--blur) var(--shadow-dark),
    calc(-1 * var(--dist)) calc(-1 * var(--dist)) var(--blur) var(--shadow-light);
}
.neu-lg {
  /* 同上，用 --dist-lg / --blur-lg */
}

/* 内凹表面 */
.neu-inset {
  background: var(--bg);
  border-radius: var(--radius);
  box-shadow:
    inset var(--dist) var(--dist) var(--blur) var(--shadow-dark),
    inset calc(-1 * var(--dist)) calc(-1 * var(--dist)) var(--blur) var(--shadow-light);
}
```

注意事项：
- 嵌套表面（`.neu .neu` 等）当前回退到 `--bg` 以保证对比度，加阴影后需重新评估嵌套层级的阴影方向。
- `theme-transition` 的全量过渡会让阴影切换也参与动画，通常符合预期；若觉得卡顿，可把 `box-shadow` 排除在过渡之外。
- `.neu-hover` 的 `translateY(-2px)` 与 `.neu-press` 的 `scale(0.98)` 在有阴影时视觉效果更明显。

## 6. 表面工具类

| 类 | 当前行为 | 用途 |
|----|----------|------|
| `.neu` | `background: var(--bg-2)` + `--radius` | 卡片、按钮、标签底座 |
| `.neu-lg` | `background: var(--bg-2)` + `--radius-lg` | 大卡片 |
| `.neu-inset` | `background: var(--bg)` + `--accent-text` 文字色 + `--radius` | 凹陷态：输入框、激活的筛选按钮、徽章 |
| `.neu-hover` | `:hover` 时 `translateY(-2px)` | 悬停抬升 |
| `.neu-press` | `:active` 时 `scale(0.98)` | 按下内陷 |

嵌套回退规则（避免同色叠同色失去层次）：

```css
.neu .neu, .neu-lg .neu, .neu-lg .neu-lg { background: var(--bg); }
.neu .neu-inset, .neu-lg .neu-inset { background: var(--bg); }
```

## 7. 布局工具类

| 类 | 作用 |
|----|------|
| `.container` | 居中、`max-width: var(--maxw)`、左右 `--pad` 内边距 |
| `.section` | 区块垂直内边距 `clamp(56px, 9vw, 96px)` |
| `.section-head` | 区块标题行（flex baseline）；`.center` 居中 |
| `.section-tag` | 标题前缀符号（如 `·` `#` `+` `/` `->` `♥` `●` `&` `@`），`--accent-text` 色 |
| `.section-title` | `clamp(1.4rem, 3.6vw, 2rem)` |
| `.section-sub` | 次要说明，`--text-dim`，`max-width: 56ch` |

## 8. 动画

### 8.1 滚动入场 `.reveal`

```css
.reveal { opacity: 0; transform: translateY(26px); transition: opacity .6s, transform .6s; }
.reveal.is-visible { opacity: 1; transform: none; }
```

由 `useReveal()`（`src/composables/useReveal.js`）在 `App.vue` 挂载时一次性给所有 `.reveal` 元素注册 `IntersectionObserver`，进入视口（threshold 0.12）后加 `.is-visible` 并取消观察。不支持 `IntersectionObserver` 时直接全部显示。

### 8.2 降级 `prefers-reduced-motion`

```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }
  .reveal { opacity: 1; transform: none; }
}
```

此外 `useTheme.toggle()` 与 `ThemeToggle.toggleWithTransition()` 都会检测该偏好，跳过光带动画与过渡类。`HeroSection` 的签名轮播在降级下不自动播放；`ThanksSection` 的视频在降级下不自动播放。

## 9. 辅助类

| 类 | 作用 |
|----|------|
| `.text-dim` | `color: var(--text-dim)` |
| `.accent` | `color: var(--accent-text)` |
| `.mono` | 显示字体 + 微调字距 |
| `.grad-text` | `linear-gradient(135deg, --accent-text, --accent-2)` 文字渐变（`background-clip: text`） |

## 10. 全局基础

- **重置**：清零 margin/padding、`box-sizing: border-box`；`a` 去下划线、`button` 重置、`img/svg/video/canvas` block、`ul` 去点。
- **背景**：`body` 叠加四层径向渐变（暖桃 / 灰蓝 / 米色 / 顶到底渐变），`background-attachment: fixed`，随主题色变量自动切换。
- **滚动条**：8px 宽，滑块用 `--shadow-dark`，全圆角。
- **选区**：`::selection` 用 `--accent-soft` 底 + `--text` 字。
- **聚焦**：`:focus-visible` 用 `--accent-text` 2px outline + 3px offset，保证键盘可达性。
- **排版**：`h1–h4` 统一用 `--font-display`、700、`line-height: 1.15`、负字距；`html` 开启 `scroll-behavior: smooth` + `scroll-padding-top: 24px`（锚点跳转留出顶部空间）。
