# AGENTS.md — daum.pw

个人主页，**不是单文件小项目**。Vue 3 + Vite 纯静态站，核心是开屏动效编排（描边→飞行→变形→分裂）、GSAP 滚动叙事、深浅双主题。动效交接全部要求「同源、同位、同色、同帧接管」，改错一处就是肉眼可见的跳变。

## 首轮汇报（必须执行）

加载到本文件的会话，**第一条回复必须明确汇报「已加载 AGENTS.md」**（并简述关键约束一句话），让用户确认规则已生效；未汇报视为未加载。

## 开工前必读

1. 先读 [CONTRIBUTING.md](CONTRIBUTING.md)（完整规范），再动代码
2. 改动涉及开屏/动效/主题色时，重点看其中的「双端同步点」和「z-index 层级表」

## 硬性规则

- **动效编排是高危区**：原炸弹文件已按关注点拆分——`main.ts` 仅入口，开屏编排在 `src/boot/`（handoff/scrollLock/toggleMorph/veilSplit 等），Hero 停靠编排在 `composables/useHeroDock.ts` / `useSocialDock.ts`（仍处 400–800 警戒线）。只改需求直接相关的行；时序/几何里的根因注释必须保留，防回退成旧方案，详见 CONTRIBUTING.md「文件体量红线」
- 颜色只用 `var(--token)`，深浅双主题同步定义；禁止写死色值、禁止 html 内联钉主题色
- 动效只动合成属性（transform/WAAPI 几何插值），禁止逐帧 layout 属性
- WAAPI `fill:'forwards'` 收尾必须钉终态 + `cancel()`，DOM 交还纯净
- 异步时序必须带兜底（transitionend + timeout 双通道，`finished.catch(() => {})`）
- 修改品牌字形必须同步 `src/data/brandGlyph.ts` 与 `index.html` 内联 SVG

## 验证

```bash
npm run build
```

动了开屏/动效路径：浅色+深色各过一遍完整 boot，再测非首页刷新（滚动恢复）。
