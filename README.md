# daum.pw

daum12569 的数字客厅 —— 新拟态（Neumorphism）个人主页。

## 技术栈

- Vue 3 (`<script setup>`) + Vite
- 纯 CSS 新拟态设计系统（`src/styles/neu.css`）
- 部署：GitHub Pages（push 到 master 自动构建）

## 开发

```bash
npm install      # 安装依赖
npm run dev      # 本地开发 http://localhost:5173
npm run build    # 构建到 dist/
npm run preview  # 预览构建产物
```

## 结构

```
src/
├─ styles/neu.css        # 新拟态设计系统(token + 工具类 .neu/.neu-inset/.reveal…)
├─ components/base/      # NeuCard / NeuButton / NeuChip / NeuIcon
├─ components/           # Hero/About/Stats/Skills/Projects/Journey/Thanks/Now/Friends/Contact/Footer
├─ composables/          # useTheme / useReveal / useActiveSection
└─ data/                 # 内容数据(项目/签名/技能/统计/历程/感谢/Now/友邻/社交)
```

旧版本归档于 `legacy/`。
